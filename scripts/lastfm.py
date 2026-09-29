"""
Last.fm: my most played track of the last seven days, for the "on repeat" row
of the home page's now box (user.getTopTracks, period=7day, limit=1).
"""

from __future__ import annotations

from typing import TypedDict

import requests

from scripts.common import TIMEOUT_SECONDS, FeedResult, ImageSaver, JsonObject, require_env, utc_now
from scripts.site_config import require_setting

API = "https://ws.audioscrobbler.com/2.0/"


class TopTrack(TypedDict):
    title: str
    artist: str
    url: str
    playcount: int


class LastfmFeed(TypedDict):
    fetched_at: str
    #: None when nothing was scrobbled in the last seven days.
    top_track: TopTrack | None


class LastfmError(Exception):
    """Last.fm answered with an error; carries its code and message, never the API key."""


def _text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def parse_top_track(data: object) -> TopTrack | None:
    """
    The first track of a user.getTopTracks response, or None for an empty week.
    Last.fm's JSON turns a one-element list into a bare object, and names the
    artist either `name` or `#text`, so both are accepted.
    """
    if not isinstance(data, dict):
        raise LastfmError(f"unexpected response ({type(data).__name__})")
    if "error" in data:
        raise LastfmError(f"Last.fm error {data.get('error')}: {data.get('message', '')}")
    top = data.get("toptracks")
    listed = top.get("track") if isinstance(top, dict) else None
    tracks = [listed] if isinstance(listed, dict) else listed if isinstance(listed, list) else []
    for track in tracks:
        if not isinstance(track, dict):
            continue
        artist = track.get("artist")
        artist_name = (
            _text(artist.get("name")) or _text(artist.get("#text"))
            if isinstance(artist, dict)
            else _text(artist)
        )
        title = _text(track.get("name"))
        if not title or not artist_name:
            continue
        playcount = str(track.get("playcount", "0"))
        return {
            "title": title,
            "artist": artist_name,
            "url": _text(track.get("url")) or "",
            "playcount": int(playcount) if playcount.isdigit() else 0,
        }
    return None


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    user = require_setting(config, "lastfmUsername")
    api_key = require_env("LASTFM_API_KEY")
    response = session.get(
        API,
        params={
            "method": "user.gettoptracks",
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
    top_track = parse_top_track(data)
    feed: LastfmFeed = {"fetched_at": utc_now(), "top_track": top_track}
    detail = f"{top_track['title']} ({top_track['playcount']} plays)" if top_track else "no plays"
    return FeedResult(feed, detail)
