"""
Spotify: the tracks of the "last week's finds" playlist, plus every track
embedded with <Track id="…"> anywhere in src/content, so those embeds keep
working after a song leaves the playlist.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from pathlib import Path
from typing import TypedDict

import requests

from scripts.common import (
    ROOT,
    TIMEOUT_SECONDS,
    FeedResult,
    ImageSaver,
    JsonObject,
    get,
    log,
    require_env,
    utc_now,
)
from scripts.site_config import require_setting

TOKEN_URL = "https://accounts.spotify.com/api/token"
API = "https://api.spotify.com/v1"
CONTENT_DIR = ROOT / "src" / "content"

_TRACK_EMBED = re.compile(r"<Track\b[^>]*?\bid=[\"']([A-Za-z0-9]+)[\"']")


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
    response = session.post(
        TOKEN_URL,
        data={"grant_type": "refresh_token", "refresh_token": refresh},
        auth=(client_id, secret),
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return str(response.json()["access_token"])


def _playlist_pages(
    session: requests.Session, playlist_id: str, headers: dict[str, str]
) -> Iterable[JsonObject]:
    url: str | None = f"{API}/playlists/{playlist_id}/items?limit=50"
    while url:
        page: JsonObject = get(session, url, headers=headers).json()
        yield page
        url = page.get("next")


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    playlist_id = require_setting(config, "spotifyPlaylistId")
    client_id = require_env("SPOTIFY_CLIENT_ID")
    secret = require_env("SPOTIFY_CLIENT_SECRET")
    refresh = require_env("SPOTIFY_REFRESH_TOKEN")

    headers = {"Authorization": f"Bearer {access_token(session, client_id, secret, refresh)}"}
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
            raw: JsonObject = get(session, f"{API}/tracks/{track_id}", headers=headers).json()
        except requests.HTTPError as error:
            log.warning("spotify: embedded track %s not found (%s)", track_id, error)
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
