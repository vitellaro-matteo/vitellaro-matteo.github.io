"""
Deezer's public search API (no key), shared by the fetchers that match
something from another service to Deezer: a track, for its 30-second preview,
or an artist, for their picture (Last.fm no longer serves artist images).

Only a track's id is ever stored, never its preview URL: those are signed and
expire 15 minutes after they're issued, so the site asks for a fresh one when a
preview is played.
"""

from __future__ import annotations

import re
import unicodedata
from typing import TypedDict

import requests

from scripts.common import TIMEOUT_SECONDS, JsonObject, log

TRACK_SEARCH = "https://api.deezer.com/search"
ARTIST_SEARCH = "https://api.deezer.com/search/artist"
# Deezer allows 50 requests per 5 seconds; a short pause keeps long playlists under it.
PAUSE_SECONDS = 0.12


class DeezerArtist(TypedDict):
    id: int
    name: str
    #: A 250 by 250 photo, or None when Deezer only has its placeholder.
    picture: str | None


def _text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _id(value: object) -> int | None:
    # bool is an int subclass, and JSON true is never an id.
    if isinstance(value, int) and not isinstance(value, bool) and value > 0:
        return value
    return None


def normalise(text: str) -> str:
    """Lowercase ASCII words for comparing titles and names across services."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    words = re.findall(r"[a-z0-9]+", plain)
    if words[:1] == ["the"]:
        words = words[1:]
    return " ".join(words)


def base_title(title: str) -> str:
    """A title without its version: "Song - Live" and "Song (Live)" both become "Song"."""
    base = re.split(r"\s+-\s+|\s*[(\[]", title, maxsplit=1)[0].strip()
    return base or title


def _results(results: object) -> list[JsonObject]:
    data = results.get("data") if isinstance(results, dict) else None
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []


def match_track_id(results: object, title: str, artists: list[str]) -> int | None:
    """
    The id of the Deezer search result that is the same recording and has a
    preview: the artist must match, and the exact title wins over one that only
    matches without its version (so "Song - Live" prefers "Song (Live)" to "Song").
    """
    wanted_artists = {normalise(artist) for artist in artists}
    full, base = normalise(title), normalise(base_title(title))
    candidates: list[tuple[str, str, int]] = []
    for item in _results(results):
        artist = item.get("artist")
        name = _text(artist.get("name")) if isinstance(artist, dict) else None
        deezer_id = _id(item.get("id"))
        has_preview = _text(item.get("preview")) is not None
        found_title = _text(item.get("title"))
        if name and deezer_id and has_preview and found_title and normalise(name) in wanted_artists:
            candidates.append(
                (normalise(found_title), normalise(base_title(found_title)), deezer_id)
            )
    for found_full, _, deezer_id in candidates:
        if found_full == full:
            return deezer_id
    for _, found_base, deezer_id in candidates:
        if found_base == base:
            return deezer_id
    return None


def _picture(value: object) -> str | None:
    url = _text(value)
    # An artist without a photo gets a placeholder whose image hash is empty.
    if url is None or "/images/artist//" in url or not url.startswith("https://"):
        return None
    return url


def match_artist(results: object, name: str) -> DeezerArtist | None:
    """The first Deezer artist result whose normalised name is the same as `name`."""
    wanted = normalise(name)
    for item in _results(results):
        found_name = _text(item.get("name"))
        deezer_id = _id(item.get("id"))
        if found_name and deezer_id and normalise(found_name) == wanted:
            return {
                "id": deezer_id,
                "name": found_name,
                "picture": _picture(item.get("picture_medium")),
            }
    return None


def _search(session: requests.Session, url: str, query: str, what: str) -> object | None:
    """A search response, or None (logged) when Deezer fails or answers with an error."""
    try:
        results: object = session.get(url, params={"q": query}, timeout=TIMEOUT_SECONDS).json()
    except (requests.RequestException, ValueError) as error:
        log.warning("deezer: no match for %s (%s)", what, type(error).__name__)
        return None
    error_body = results.get("error") if isinstance(results, dict) else None
    if isinstance(error_body, dict):
        log.warning("deezer: no match for %s (Deezer: %s)", what, error_body.get("message"))
        return None
    return results


def lookup_track_id(session: requests.Session, title: str, artists: list[str]) -> int | None:
    """The track's Deezer id, or None when there's no match or Deezer fails."""
    query = " ".join([*artists[:1], base_title(title)])
    results = _search(session, TRACK_SEARCH, query, title)
    return match_track_id(results, title, artists) if results is not None else None


def lookup_artist(session: requests.Session, name: str) -> DeezerArtist | None:
    """The artist on Deezer, or None when there's no match or Deezer fails."""
    results = _search(session, ARTIST_SEARCH, name, name)
    return match_artist(results, name) if results is not None else None
