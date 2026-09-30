"""
Last.fm: my most played track and most played artist of the last seven days,
for the "on repeat" and "most played" rows of the home page's now box
(user.getTopTracks and user.getTopArtists, period=7day, limit=1).

The track is matched on Deezer for its preview, and the artist for a photo,
since Last.fm stopped serving artist images (scripts/deezer.py).
"""

from __future__ import annotations

from typing import TypedDict

import requests

from scripts.common import TIMEOUT_SECONDS, FeedResult, ImageSaver, JsonObject, require_env, utc_now
from scripts.deezer import lookup_artist, lookup_track_id
from scripts.site_config import require_setting

API = "https://ws.audioscrobbler.com/2.0/"


class TopTrack(TypedDict):
    title: str
    artist: str
    url: str
    playcount: int
    #: The same recording on Deezer, for its 30-second preview, or None.
    deezer_id: int | None


class TopArtist(TypedDict):
    name: str
    url: str
    playcount: int
    #: A square photo from Deezer under /media/feeds/lastfm/, or None.
    image: str | None


class LastfmFeed(TypedDict):
    fetched_at: str
    #: None when nothing was scrobbled in the last seven days.
    top_track: TopTrack | None
    top_artist: TopArtist | None


class LastfmError(Exception):
    """Last.fm answered with an error; carries its code and message, never the API key."""


def _text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _playcount(value: object) -> int:
    text = str(value if value is not None else "0")
    return int(text) if text.isdigit() else 0


def _entries(data: object, collection: str, item: str) -> list[JsonObject]:
    """
    The entries of a top-list response. Last.fm's JSON turns a one-element list
    into a bare object, so both are accepted.
    """
    if not isinstance(data, dict):
        raise LastfmError(f"unexpected response ({type(data).__name__})")
    if "error" in data:
        raise LastfmError(f"Last.fm error {data.get('error')}: {data.get('message', '')}")
    top = data.get(collection)
    listed = top.get(item) if isinstance(top, dict) else None
    if isinstance(listed, dict):
        return [listed]
    if not isinstance(listed, list):
        return []
    return [entry for entry in listed if isinstance(entry, dict)]


def parse_top_track(data: object) -> TopTrack | None:
    """
    The first track of a user.getTopTracks response, or None for an empty week.
    The artist is named either `name` or `#text`, so both are accepted.
    """
    for track in _entries(data, "toptracks", "track"):
        artist = track.get("artist")
        artist_name = (
            _text(artist.get("name")) or _text(artist.get("#text"))
            if isinstance(artist, dict)
            else _text(artist)
        )
        title = _text(track.get("name"))
        if not title or not artist_name:
            continue
        return {
            "title": title,
            "artist": artist_name,
            "url": _text(track.get("url")) or "",
            "playcount": _playcount(track.get("playcount")),
            "deezer_id": None,
        }
    return None


def parse_top_artist(data: object) -> TopArtist | None:
    """
    The first artist of a user.getTopArtists response, or None for an empty week.
    Last.fm's own `image` entries are all the same grey star placeholder, so
    they are ignored.
    """
    for artist in _entries(data, "topartists", "artist"):
        name = _text(artist.get("name"))
        if not name:
            continue
        return {
            "name": name,
            "url": _text(artist.get("url")) or "",
            "playcount": _playcount(artist.get("playcount")),
            "image": None,
        }
    return None


def _top_list(session: requests.Session, method: str, user: str, api_key: str) -> JsonObject:
    response = session.get(
        API,
        params={
            "method": method,
            "user": user,
            "period": "7day",
            "limit": "1",
            "api_key": api_key,
            "format": "json",
        },
        timeout=TIMEOUT_SECONDS,
    )
    try:
        data: JsonObject = response.json()
    except ValueError as error:
        raise LastfmError(f"HTTP {response.status_code}, not JSON") from error
    return data


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    user = require_setting(config, "lastfmUsername")
    api_key = require_env("LASTFM_API_KEY")
    top_track = parse_top_track(_top_list(session, "user.gettoptracks", user, api_key))
    top_artist = parse_top_artist(_top_list(session, "user.gettopartists", user, api_key))

    # Deezer failures only cost the preview or the photo, never the feed.
    if top_track:
        top_track["deezer_id"] = lookup_track_id(session, top_track["title"], [top_track["artist"]])
    if top_artist:
        deezer_artist = lookup_artist(session, top_artist["name"])
        if deezer_artist:
            top_artist["image"] = images.save(
                deezer_artist["picture"], key=f"deezer-artist:{deezer_artist['id']}"
            )

    feed: LastfmFeed = {"fetched_at": utc_now(), "top_track": top_track, "top_artist": top_artist}
    parts = [
        f"{top_track['title']} ({top_track['playcount']} plays)" if top_track else "no plays",
        f"{top_artist['name']} ({top_artist['playcount']} plays)" if top_artist else "no artist",
    ]
    return FeedResult(feed, ", ".join(parts))
