"""
Spotify: the tracks of the "last week's finds" playlist, plus every track
embedded with <Track id="…"> anywhere in src/content, so those embeds keep
working after a song leaves the playlist. Spotify no longer gives new apps
preview clips, so each playlist track is matched on Deezer instead
(scripts/deezer.py), and its Deezer id is stored for the site's player.

    python -m scripts.spotify --check

checks the three Spotify secrets locally (the client ID and secret on their own,
then one token refresh and one playlist read) and prints only OK/failed with
Spotify's error and a hint, never the values.

    python -m scripts.spotify --dump

saves the raw JSON of the playlist's first page and of one track to
.debug/spotify/ (gitignored), for comparing Spotify's real responses with the
parser. It prints only the file paths.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import sys
import time
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import TypedDict

import requests

from scripts.common import (
    ROOT,
    TIMEOUT_SECONDS,
    FeedResult,
    ImageSaver,
    JsonObject,
    SkipFetcher,
    http_session,
    log,
    require_env,
    utc_now,
)
from scripts.deezer import PAUSE_SECONDS, lookup_track_id
from scripts.site_config import load_site_config, require_setting

TOKEN_URL = "https://accounts.spotify.com/api/token"
API = "https://api.spotify.com/v1"
CONTENT_DIR = ROOT / "src" / "content"
DEBUG_DIR = ROOT / ".debug" / "spotify"

_TRACK_EMBED = re.compile(r"<Track\b[^>]*?\bid=[\"']([A-Za-z0-9]+)[\"']")
# Spotify ids are 22 base62 characters; anything else gets "400 Invalid base62 id".
_SPOTIFY_ID = re.compile(r"[0-9A-Za-z]{22}")
_HEX_32 = re.compile(r"[0-9a-f]{32}")

TOKEN_HINTS = {
    "invalid_client": (
        "the client ID or secret is wrong, or the secret was rotated in the Spotify "
        "dashboard but SPOTIFY_CLIENT_SECRET still holds the old one"
    ),
    "invalid_grant": (
        "the refresh token was revoked, has expired, or was issued for a different "
        "client ID; create a new one with `python -m scripts.spotify_auth`"
    ),
}

# The client credentials grant needs no user token, so its answer isolates the
# client ID + secret pair. Spotify words the two failures differently.
CLIENT_HINTS = {
    "Failed to get client": (
        "Spotify doesn't know this client ID: check SPOTIFY_CLIENT_ID for typos, and "
        "that the app still exists in the dashboard"
    ),
    "Invalid client": (
        "Spotify knows this client ID but rejects the secret: copy the current client "
        "secret from the app's Settings in the dashboard (rotating it replaces the old "
        "one) into SPOTIFY_CLIENT_SECRET"
    ),
}

# The refresh was refused as invalid_client although the ID and secret pass on
# their own: Spotify checks the token first, so the token belongs to another app.
TOKEN_FROM_OTHER_APP = (
    "the client ID and secret are valid together, so the refresh token was issued "
    "for a different app (for example another repo's .spotify_cache): create one for "
    "this app with `python -m scripts.spotify_auth`"
)

API_HINTS = {
    401: "the access token was rejected; run the check again",
    403: (
        "this Spotify account may not use the app: in development mode the app owner "
        "needs Premium, and the account must be the owner or be added under User Management"
    ),
    404: (
        "check spotifyPlaylistId in site.config.ts; the playlist must be owned by the "
        "account that authorized the app"
    ),
}


class Track(TypedDict):
    id: str
    title: str
    artists: list[str]
    url: str
    cover: str | None
    #: The same recording on Deezer, for its 30-second preview, or None.
    deezer_id: int | None


class SpotifyFeed(TypedDict):
    fetched_at: str
    playlist_url: str
    tracks: list[Track]
    embedded: list[Track]


class SpotifyAuthError(Exception):
    """The token endpoint refused a request. Carries Spotify's error, never credentials."""

    def __init__(
        self,
        status: int,
        error: str,
        description: str,
        *,
        hint: str | None = None,
        stage: str = "token refresh",
    ) -> None:
        self.status = status
        self.error = error
        self.description = description
        self.stage = stage
        self.hint = hint or TOKEN_HINTS.get(error, description)
        message = f"{stage} failed (HTTP {status}): {error}: {description}"
        if self.hint != description:
            message += f". Hint: {self.hint}"
        super().__init__(message)


class SpotifyApiError(Exception):
    """A Web API call failed. Carries Spotify's message and, where known, a hint."""

    def __init__(self, status: int, what: str, message: str) -> None:
        self.status = status
        self.message = message
        self.hint = API_HINTS.get(status, "")
        text = f"reading {what} failed (HTTP {status}): {message}"
        if self.hint:
            text += f". Hint: {self.hint}"
        super().__init__(text)


def _json_object(body: str) -> JsonObject | None:
    try:
        payload = json.loads(body)
    except ValueError:
        return None
    return payload if isinstance(payload, dict) else None


def parse_token_error(status: int, body: str) -> SpotifyAuthError:
    """
    Spotify's token endpoint answers errors with `{"error": …, "error_description": …}`.
    Anything else (an HTML error page, say) is summarised rather than echoed.
    """
    payload = _json_object(body) or {}
    error = str(payload.get("error") or "unknown_error")
    description = str(payload.get("error_description") or "no description in the response")
    return SpotifyAuthError(status, error, description[:300])


def api_error_message(body: str) -> str:
    """The message from a Web API error body, `{"error": {"status": …, "message": …}}`."""
    payload = _json_object(body) or {}
    error = payload.get("error")
    if isinstance(error, dict) and error.get("message"):
        return str(error["message"])[:300]
    return "no message in the response"


def credential_warnings(name: str, value: str) -> list[str]:
    """
    Shape checks for a credential that describe what looks wrong without ever
    repeating the value, so they are safe for logs and terminals.
    """
    warnings: list[str] = []
    if any(char.isspace() for char in value):
        warnings.append(f"{name} contains spaces or line breaks inside the value")
    if name in ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET") and not _HEX_32.fullmatch(value):
        warnings.append(f"{name} doesn't look like a Spotify key (32 lowercase hex characters)")
    if name == "SPOTIFY_REFRESH_TOKEN":
        if value.startswith("{") or '"' in value:
            warnings.append(
                f"{name} looks like JSON: paste only the refresh_token value, "
                "not the whole .spotify_cache file"
            )
        elif value.startswith("BQ"):
            warnings.append(f"{name} looks like an access token, not a refresh token")
        elif len(value) < 100:
            warnings.append(f"{name} is shorter than Spotify refresh tokens usually are")
    return warnings


def embedded_track_ids(content_dir: Path = CONTENT_DIR) -> list[str]:
    """
    Ids from every <Track id="…"> in the content, in first-seen order. Ids that
    can't be Spotify ids (like the draft example's placeholder) are skipped with
    a warning rather than costing a failed request.
    """
    ids: dict[str, None] = {}
    for path in sorted(content_dir.rglob("*.mdx")):
        for track_id in _TRACK_EMBED.findall(path.read_text(encoding="utf-8")):
            if _SPOTIFY_ID.fullmatch(track_id):
                ids.setdefault(track_id, None)
            else:
                log.warning(
                    'spotify: skipped <Track id="%s"> in %s: not a Spotify track id',
                    track_id,
                    path.name,
                )
    return list(ids)


def _text(value: object) -> str | None:
    """A non-empty string, or None for anything else (null, numbers, blanks)."""
    return value.strip() if isinstance(value, str) and value.strip() else None


def _cover_url(album: object) -> str | None:
    """The smallest album image that is still at least 300px, else the largest."""
    raw_images = album.get("images") if isinstance(album, dict) else None
    images: list[tuple[int, str]] = []
    for image in raw_images if isinstance(raw_images, list) else []:
        url = _text(image.get("url")) if isinstance(image, dict) else None
        if url:
            width = image.get("width")
            images.append((width if isinstance(width, int) else 0, url))
    images.sort()
    for width, url in images:
        if width >= 300:
            return url
    return images[-1][1] if images else None


def parse_track(raw: object, images: ImageSaver) -> Track | None:
    """
    A track object, from a playlist entry or /tracks/{id}. None when it isn't a
    playable track (a podcast episode, a local file) or lacks an id or title.
    """
    if not isinstance(raw, dict):
        return None
    if raw.get("type", "track") != "track" or raw.get("is_local") is True:
        return None
    track_id = _text(raw.get("id"))
    title = _text(raw.get("name"))
    if not track_id or not title:
        return None
    raw_artists = raw.get("artists")
    artists = [
        name
        for artist in (raw_artists if isinstance(raw_artists, list) else [])
        if isinstance(artist, dict) and (name := _text(artist.get("name")))
    ]
    links = raw.get("external_urls")
    url = _text(links.get("spotify")) if isinstance(links, dict) else None
    return {
        "id": track_id,
        "title": title,
        "artists": artists,
        "url": url or f"https://open.spotify.com/track/{track_id}",
        "cover": images.save(_cover_url(raw.get("album")), key=f"album:{track_id}"),
        "deezer_id": None,
    }


def playlist_paging(page: object) -> JsonObject | None:
    """
    The paging object (`{"items": [...], "next": …, "total": …}`) in a playlist
    response. /playlists/{id}/items is documented to return one, but in practice
    it returns the whole playlist object with the paging nested under "items"
    ("tracks" before February 2026), so all three shapes are accepted.
    """
    if not isinstance(page, dict):
        return None
    if isinstance(page.get("items"), list):
        return page
    for key in ("items", "tracks"):
        nested = page.get(key)
        if isinstance(nested, dict) and isinstance(nested.get("items"), list):
            return nested
    return None


def _entry_track(entry: JsonObject) -> object:
    """The track in a playlist entry: under "item" since February 2026, "track" before."""
    raw = entry.get("item")
    return raw if raw is not None else entry.get("track")


def _skip_reason(entry: object) -> str:
    """Why a playlist entry yields no track, for the warning."""
    if not isinstance(entry, dict):
        return f"not an object ({type(entry).__name__})"
    if entry.get("is_local") is True:
        return "a local file"
    raw = _entry_track(entry)
    if raw is None:
        return "the track was removed or is unavailable"
    if not isinstance(raw, dict):
        return f"unexpected track value ({type(raw).__name__})"
    kind = raw.get("type", "track")
    if kind != "track":
        return f"not a track (type: {kind})"
    return "no id or title"


def parse_playlist_items(pages: Iterable[object], images: ImageSaver) -> list[Track]:
    """
    Tracks from playlist responses, in order. An entry that isn't a usable track
    is skipped with a warning; one odd entry never costs the whole feed.
    """
    tracks: list[Track] = []
    position = 0
    for page in pages:
        paging = playlist_paging(page)
        if paging is None:
            keys = sorted(page) if isinstance(page, dict) else type(page).__name__
            raise ValueError(f"unexpected playlist response from Spotify: {keys}")
        for entry in paging["items"]:
            position += 1
            raw = _entry_track(entry) if isinstance(entry, dict) else None
            local = isinstance(entry, dict) and entry.get("is_local") is True
            track = None if local else parse_track(raw, images)
            if track:
                tracks.append(track)
            else:
                log.warning("spotify: skipped playlist entry %d: %s", position, _skip_reason(entry))
    return tracks


def playlist_id_from(value: str) -> str:
    """
    The playlist id from `spotifyPlaylistId`, which may be the bare id, a share
    link (`https://open.spotify.com/playlist/<id>?si=…`) or a URI. A leftover
    `?si=…` would otherwise turn /playlists/<id>/items into a different request.
    """
    candidate = value.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1].rsplit(":", 1)[-1]
    if not _SPOTIFY_ID.fullmatch(candidate):
        raise SkipFetcher("spotifyPlaylistId in site.config.ts is not a playlist id or link")
    return candidate


def add_previews(
    session: requests.Session,
    tracks: list[Track],
    pause: Callable[[float], None] = time.sleep,
) -> int:
    """Fills in each track's Deezer id; returns how many were found."""
    found = 0
    for index, track in enumerate(tracks):
        if index:
            pause(PAUSE_SECONDS)
        track["deezer_id"] = lookup_track_id(session, track["title"], track["artists"])
        found += track["deezer_id"] is not None
    return found


def verify_client(
    session: requests.Session, client_id: str, secret: str
) -> SpotifyAuthError | None:
    """
    Checks the client ID and secret on their own with the client credentials
    grant. Returns the error if Spotify rejects the pair, else None.
    """
    response = session.post(
        TOKEN_URL,
        data={"grant_type": "client_credentials"},
        auth=(client_id, secret),
        timeout=TIMEOUT_SECONDS,
    )
    if response.ok:
        return None
    error = parse_token_error(response.status_code, response.text)
    return SpotifyAuthError(
        error.status,
        error.error,
        error.description,
        hint=CLIENT_HINTS.get(error.description, error.hint),
        stage="client ID + secret check",
    )


def refresh_access_token(
    session: requests.Session, client_id: str, secret: str, refresh: str
) -> str:
    """
    An access token from the refresh token. When Spotify answers invalid_client,
    it doesn't say whether the secret is wrong or the token belongs to another
    app, so the pair is checked on its own to raise the error that says which.
    """
    try:
        return access_token(session, client_id, secret, refresh)
    except SpotifyAuthError as error:
        if error.error != "invalid_client":
            raise
        client_error = verify_client(session, client_id, secret)
        if client_error is not None:
            raise client_error from error
        raise SpotifyAuthError(
            error.status, error.error, error.description, hint=TOKEN_FROM_OTHER_APP
        ) from error


def access_token(session: requests.Session, client_id: str, secret: str, refresh: str) -> str:
    """
    The refresh token grant: a form-encoded POST with `grant_type=refresh_token`
    and HTTP Basic auth from `client_id:client_secret` (requests builds the header).
    """
    response = session.post(
        TOKEN_URL,
        data={"grant_type": "refresh_token", "refresh_token": refresh},
        auth=(client_id, secret),
        timeout=TIMEOUT_SECONDS,
    )
    if not response.ok:
        raise parse_token_error(response.status_code, response.text)
    return str(response.json()["access_token"])


def _api_get(session: requests.Session, url: str, headers: dict[str, str], what: str) -> JsonObject:
    response = session.get(url, headers=headers, timeout=TIMEOUT_SECONDS)
    if not response.ok:
        raise SpotifyApiError(response.status_code, what, api_error_message(response.text))
    page: JsonObject = response.json()
    return page


def _playlist_pages(
    session: requests.Session, playlist_id: str, headers: dict[str, str]
) -> Iterable[JsonObject]:
    url: str | None = f"{API}/playlists/{playlist_id}/items?limit=50"
    seen: set[str] = set()
    while url and url not in seen:
        seen.add(url)
        page = _api_get(session, url, headers, "the playlist")
        yield page
        paging = playlist_paging(page)
        url = _text(paging.get("next")) if paging else None


def _credentials() -> tuple[str, str, str]:
    names = ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN")
    client_id, secret, refresh = (require_env(name) for name in names)
    for name, value in zip(names, (client_id, secret, refresh), strict=True):
        for warning in credential_warnings(name, value):
            log.warning("spotify: %s", warning)
    return client_id, secret, refresh


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    playlist_id = playlist_id_from(require_setting(config, "spotifyPlaylistId"))
    client_id, secret, refresh = _credentials()

    try:
        token = refresh_access_token(session, client_id, secret, refresh)
    except SpotifyAuthError as error:
        log.error("spotify: hint: %s", error.hint)
        raise
    headers = {"Authorization": f"Bearer {token}"}
    tracks = parse_playlist_items(_playlist_pages(session, playlist_id, headers), images)
    previews = add_previews(session, tracks)

    # Get Several Tracks was removed for development-mode apps, so embeds are
    # fetched one by one. A bad id is logged, never fatal: the site build then
    # reports the embed with a clear message.
    in_playlist = {track["id"] for track in tracks}
    embedded: list[Track] = []
    for track_id in embedded_track_ids():
        if track_id in in_playlist:
            continue
        try:
            raw = _api_get(session, f"{API}/tracks/{track_id}", headers, f"track {track_id}")
        except SpotifyApiError as error:
            log.warning("spotify: embedded %s", error)
            continue
        track = parse_track(raw, images)
        if track:
            embedded.append(track)
        else:
            log.warning("spotify: embedded track %s is not a playable track", track_id)

    feed: SpotifyFeed = {
        "fetched_at": utc_now(),
        "playlist_url": f"https://open.spotify.com/playlist/{playlist_id}",
        "tracks": tracks,
        "embedded": embedded,
    }
    detail = f"{len(tracks)} tracks ({previews} with previews), {len(embedded)} embedded"
    return FeedResult(feed, detail)


# ---------- local check: python -m scripts.spotify --check ----------

Prompt = Callable[[str], str]


def _read_credential(name: str, prompt: Prompt, say: Callable[[str], None]) -> str:
    raw = os.environ.get(name, "")
    if raw.strip():
        note = " (surrounding whitespace stripped)" if raw != raw.strip() else ""
        say(f"  {name}: from the environment{note}")
        return raw.strip()
    value = prompt(f"{name} (input hidden): ").strip()
    say(f"  {name}: entered at the prompt")
    return value


def _report(say: Callable[[str], None], step: str, error: SpotifyAuthError) -> None:
    say(f"{step}: failed")
    say(f"  error: {error.error}")
    say(f"  description: {error.description}")
    say(f"  hint: {error.hint}")


def run_check(
    session: requests.Session,
    playlist_id: str,
    prompt: Prompt = getpass.getpass,
    say: Callable[[str], None] = print,
) -> bool:
    """
    Checks the client ID and secret on their own, then refreshes a token and
    reads one playlist item, reporting only outcomes.
    """
    say("Spotify check (values are never printed)")
    names = ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN")
    values = [_read_credential(name, prompt, say) for name in names]
    if not all(values):
        say("failed: every value is required")
        return False
    for name, value in zip(names, values, strict=True):
        for warning in credential_warnings(name, value):
            say(f"  warning: {warning}")

    client_id, secret, refresh = values
    try:
        client_error = verify_client(session, client_id, secret)
    except requests.RequestException as error:
        say(f"client ID + secret: failed ({type(error).__name__}: could not reach Spotify)")
        return False
    if client_error is not None:
        _report(say, "client ID + secret", client_error)
        return False
    say("client ID + secret: OK")

    try:
        token = access_token(session, client_id, secret, refresh)
    except SpotifyAuthError as error:
        if error.error == "invalid_client":
            error = SpotifyAuthError(
                error.status, error.error, error.description, hint=TOKEN_FROM_OTHER_APP
            )
        _report(say, "token refresh", error)
        return False
    except requests.RequestException as error:
        say(f"token refresh: failed ({type(error).__name__}: could not reach Spotify)")
        return False
    say("token refresh: OK")

    url = f"{API}/playlists/{playlist_id}/items?limit=1"
    try:
        page = _api_get(session, url, {"Authorization": f"Bearer {token}"}, "the playlist")
    except SpotifyApiError as error:
        say(f"playlist read: failed (HTTP {error.status})")
        say(f"  description: {error.message}")
        if error.hint:
            say(f"  hint: {error.hint}")
        return False
    except requests.RequestException as error:
        say(f"playlist read: failed ({type(error).__name__}: could not reach Spotify)")
        return False
    paging = playlist_paging(page)
    if paging is None:
        say("playlist read: failed (Spotify's response has no list of items)")
        return False
    say(f"playlist read: OK ({paging.get('total', '?')} items)")
    return True


# ---------- raw responses: python -m scripts.spotify --dump ----------


def first_track_id(page: object) -> str | None:
    """The id of the first real track on a playlist page, in any of its shapes."""
    paging = playlist_paging(page)
    for entry in paging["items"] if paging else []:
        raw = _entry_track(entry) if isinstance(entry, dict) else None
        if isinstance(raw, dict) and raw.get("type", "track") == "track":
            track_id = _text(raw.get("id"))
            if track_id and _SPOTIFY_ID.fullmatch(track_id):
                return track_id
    return None


def _save_raw(response: requests.Response, path: Path, say: Callable[[str], None]) -> None:
    """Writes a response body as indented JSON (or as-is if it isn't JSON)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        body = json.dumps(response.json(), ensure_ascii=False, indent=2) + "\n"
    except ValueError:
        body = response.text
    path.write_text(body, encoding="utf-8")
    status = "" if response.ok else f" (HTTP {response.status_code})"
    say(f"{path}{status}")


def run_dump(
    session: requests.Session,
    playlist_id: str,
    out_dir: Path = DEBUG_DIR,
    prompt: Prompt = getpass.getpass,
    say: Callable[[str], None] = print,
) -> bool:
    """
    Saves the raw playlist page and one track response. Credentials come from
    the environment or a hidden prompt and are never printed or written.
    """
    names = ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN")
    client_id, secret, refresh = (_read_credential(name, prompt, lambda _: None) for name in names)
    try:
        token = refresh_access_token(session, client_id, secret, refresh)
    except SpotifyAuthError as error:
        say(f"failed: {error}")
        return False
    headers = {"Authorization": f"Bearer {token}"}

    playlist = session.get(
        f"{API}/playlists/{playlist_id}/items?limit=50", headers=headers, timeout=TIMEOUT_SECONDS
    )
    _save_raw(playlist, out_dir / "playlist_items.json", say)

    try:
        page: object = playlist.json()
    except ValueError:
        page = None
    track_id = first_track_id(page) or next(iter(embedded_track_ids()), None)
    if track_id is None:
        say("no track id found in the playlist or the content; skipped /tracks/{id}")
        return playlist.ok
    track = session.get(f"{API}/tracks/{track_id}", headers=headers, timeout=TIMEOUT_SECONDS)
    _save_raw(track, out_dir / f"track_{track_id}.json", say)
    return playlist.ok and track.ok


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.spotify",
        description="Check the Spotify secrets or save raw responses, without printing secrets.",
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--check",
        action="store_true",
        help="check the credentials, refresh a token and read the playlist from site.config.ts",
    )
    mode.add_argument(
        "--dump",
        action="store_true",
        help=f"save the raw playlist and track JSON to {DEBUG_DIR.relative_to(ROOT).as_posix()}/",
    )
    args = parser.parse_args(argv)
    try:
        playlist_id = playlist_id_from(require_setting(load_site_config(), "spotifyPlaylistId"))
    except SkipFetcher as reason:
        print(f"failed: {reason}")
        return 1
    run = run_dump if args.dump else run_check
    return 0 if run(http_session(), playlist_id) else 1


if __name__ == "__main__":
    sys.exit(main())
