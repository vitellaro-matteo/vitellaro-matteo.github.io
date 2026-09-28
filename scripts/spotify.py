"""
Spotify: the tracks of the "last week's finds" playlist, plus every track
embedded with <Track id="…"> anywhere in src/content, so those embeds keep
working after a song leaves the playlist.

    python -m scripts.spotify --check

checks the three Spotify secrets locally (one token refresh, one playlist read)
and prints only OK/failed with Spotify's error and a hint, never the values.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import sys
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
from scripts.site_config import load_site_config, require_setting

TOKEN_URL = "https://accounts.spotify.com/api/token"
API = "https://api.spotify.com/v1"
CONTENT_DIR = ROOT / "src" / "content"

_TRACK_EMBED = re.compile(r"<Track\b[^>]*?\bid=[\"']([A-Za-z0-9]+)[\"']")
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


class SpotifyFeed(TypedDict):
    fetched_at: str
    playlist_url: str
    tracks: list[Track]
    embedded: list[Track]


class SpotifyAuthError(Exception):
    """The token endpoint refused the refresh. Carries Spotify's error, never credentials."""

    def __init__(self, status: int, error: str, description: str) -> None:
        self.status = status
        self.error = error
        self.description = description
        self.hint = TOKEN_HINTS.get(error, description)
        message = f"token refresh failed (HTTP {status}): {error}: {description}"
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
    """Ids from every <Track id="…"> in the content, in first-seen order."""
    ids: dict[str, None] = {}
    for path in sorted(content_dir.rglob("*.mdx")):
        for track_id in _TRACK_EMBED.findall(path.read_text(encoding="utf-8")):
            ids.setdefault(track_id, None)
    return list(ids)


def _cover_url(album: JsonObject) -> str | None:
    """The smallest album image that is still at least 300px, else the largest."""
    images = sorted(
        (image for image in album.get("images") or [] if image.get("url")),
        key=lambda image: image.get("width") or 0,
    )
    for image in images:
        if (image.get("width") or 0) >= 300:
            return str(image["url"])
    return str(images[-1]["url"]) if images else None


def parse_track(raw: JsonObject, images: ImageSaver) -> Track | None:
    """A track object from the Web API, or None for local files and podcast episodes."""
    track_id = raw.get("id")
    if raw.get("type", "track") != "track" or not track_id:
        return None
    return {
        "id": str(track_id),
        "title": str(raw.get("name", "")),
        "artists": [str(artist["name"]) for artist in raw.get("artists") or []],
        "url": str((raw.get("external_urls") or {}).get("spotify", "")),
        "cover": images.save(_cover_url(raw.get("album") or {}), key=f"album:{track_id}"),
    }


def parse_playlist_items(pages: Iterable[JsonObject], images: ImageSaver) -> list[Track]:
    tracks: list[Track] = []
    for page in pages:
        for entry in page.get("items") or []:
            # Since February 2026 each entry holds the track under "item"; apps on
            # the older API shape still get "track".
            raw = entry.get("item") or entry.get("track")
            track = parse_track(raw, images) if raw else None
            if track:
                tracks.append(track)
    return tracks


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
    while url:
        page = _api_get(session, url, headers, "the playlist")
        yield page
        url = page.get("next")


def _credentials() -> tuple[str, str, str]:
    names = ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN")
    client_id, secret, refresh = (require_env(name) for name in names)
    for name, value in zip(names, (client_id, secret, refresh), strict=True):
        for warning in credential_warnings(name, value):
            log.warning("spotify: %s", warning)
    return client_id, secret, refresh


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    playlist_id = require_setting(config, "spotifyPlaylistId")
    client_id, secret, refresh = _credentials()

    try:
        token = access_token(session, client_id, secret, refresh)
    except SpotifyAuthError as error:
        log.error("spotify: hint: %s", error.hint)
        raise
    headers = {"Authorization": f"Bearer {token}"}
    tracks = parse_playlist_items(_playlist_pages(session, playlist_id, headers), images)

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

    feed: SpotifyFeed = {
        "fetched_at": utc_now(),
        "playlist_url": f"https://open.spotify.com/playlist/{playlist_id}",
        "tracks": tracks,
        "embedded": embedded,
    }
    return FeedResult(feed, f"{len(tracks)} tracks, {len(embedded)} embedded")


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


def run_check(
    session: requests.Session,
    playlist_id: str,
    prompt: Prompt = getpass.getpass,
    say: Callable[[str], None] = print,
) -> bool:
    """Refreshes a token and reads one playlist item, reporting only outcomes."""
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
        token = access_token(session, client_id, secret, refresh)
    except SpotifyAuthError as error:
        say("token refresh: failed")
        say(f"  error: {error.error}")
        say(f"  description: {error.description}")
        say(f"  hint: {error.hint}")
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
    say(f"playlist read: OK ({page.get('total', '?')} items)")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.spotify",
        description="Check the Spotify secrets without printing them.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        required=True,
        help="refresh a token and read the playlist from site.config.ts",
    )
    parser.parse_args(argv)
    try:
        playlist_id = require_setting(load_site_config(), "spotifyPlaylistId")
    except SkipFetcher as reason:
        print(f"failed: {reason}")
        return 1
    return 0 if run_check(http_session(), playlist_id) else 1


if __name__ == "__main__":
    sys.exit(main())
