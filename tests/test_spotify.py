from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import pytest
import requests

from scripts.spotify import (
    _playlist_pages,
    embedded_track_ids,
    first_track_id,
    parse_playlist_items,
    parse_track,
    playlist_paging,
)
from tests.conftest import FakeImages, fixture_json

# ---------- the real response shape (trimmed from a live dump) ----------


def test_parses_the_playlist_object_spotify_actually_returns(images: FakeImages) -> None:
    tracks = parse_playlist_items([fixture_json("spotify_playlist.json")], images)

    assert [t["title"] for t in tracks] == [
        "Can II",
        "Captains Flat",
        "Wake Me if I'm Asleep",
        "I Lived in Trees",
        "2close2farr - BBC Maida Vale Session",
        "My Ideal",
        "Helpless",
    ]
    first = tracks[0]
    assert first["id"] == "7uIy4cNPvKpDYaXfCcmuSe"
    assert first["artists"] == ["Hana Stretton"]
    assert first["url"] == "https://open.spotify.com/track/7uIy4cNPvKpDYaXfCcmuSe"
    assert tracks[3]["artists"] == ["Mark Fry", "The A. Lords"]


def test_picks_the_300px_cover(images: FakeImages) -> None:
    parse_playlist_items([fixture_json("spotify_playlist.json")], images)
    url, key = images.saved[0]
    assert url == "https://i.scdn.co/image/ab67616d00001e02452734fc18ad0cd05db9aea5"
    assert key == "album:7uIy4cNPvKpDYaXfCcmuSe"


def test_finds_the_paging_in_every_shape() -> None:
    playlist = fixture_json("spotify_playlist.json")
    paging = playlist["items"]
    assert playlist_paging(playlist) is paging
    assert playlist_paging(paging) is paging
    assert playlist_paging({"type": "playlist", "tracks": paging}) is paging
    assert playlist_paging({"items": "nope"}) is None
    assert playlist_paging(["a list"]) is None


def test_parses_a_tracks_endpoint_response(images: FakeImages) -> None:
    track = parse_track(fixture_json("spotify_track.json"), images)
    assert track is not None
    assert track["title"] == "I Lived in Trees"
    assert track["artists"] == ["Mark Fry", "The A. Lords"]


def test_first_track_id_reads_the_real_shape() -> None:
    assert first_track_id(fixture_json("spotify_playlist.json")) == "7uIy4cNPvKpDYaXfCcmuSe"


# ---------- edge cases: local files, episodes, removed tracks, odd values ----------


def test_keeps_only_usable_tracks_and_warns_about_the_rest(
    images: FakeImages, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING, logger="fetchers"):
        tracks = parse_playlist_items([fixture_json("spotify_playlist_edge_cases.json")], images)

    assert [t["title"] for t in tracks] == [
        "Helpless",
        "My Ideal",
        "2close2farr - BBC Maida Vale Session",
    ]
    warnings = caplog.text
    assert "skipped playlist entry 2: a local file" in warnings
    assert "skipped playlist entry 3: not a track (type: episode)" in warnings
    assert "skipped playlist entry 4: the track was removed or is unavailable" in warnings
    assert "skipped playlist entry 6: not an object (str)" in warnings
    assert "skipped playlist entry 7: no id or title" in warnings
    assert "skipped playlist entry 9: unexpected track value (str)" in warnings


def test_reads_the_older_track_key(images: FakeImages) -> None:
    tracks = parse_playlist_items([fixture_json("spotify_playlist_edge_cases.json")], images)
    assert tracks[1]["id"] == "2B8BmgVUQKTWIOwWGr13Mh"


def test_tolerates_null_and_malformed_fields(images: FakeImages) -> None:
    tracks = parse_playlist_items([fixture_json("spotify_playlist_edge_cases.json")], images)
    session = tracks[2]
    assert session["artists"] == ["Momoko Gill"]  # null names and bare strings dropped
    assert session["cover"] is None  # "images": null
    assert session["url"] == "https://open.spotify.com/track/2FB0FzUWRmVKNBNWPhre8d"


def test_falls_back_to_the_largest_cover_when_none_is_300px(images: FakeImages) -> None:
    parse_playlist_items([fixture_json("spotify_playlist_edge_cases.json")], images)
    urls = [url for url, _ in images.saved]
    assert "https://i.scdn.co/image/ab67616d0000b2732f85ae8b43438af45adbbd51" in urls


def test_an_unrecognised_response_fails_with_its_keys(images: FakeImages) -> None:
    with pytest.raises(ValueError, match=r"unexpected playlist response.*\['error'\]"):
        parse_playlist_items([{"error": {"status": 500}}], images)


def test_non_track_objects_are_not_tracks(images: FakeImages) -> None:
    assert parse_track(None, images) is None
    assert parse_track("spotify:track:x", images) is None
    assert parse_track({"type": "episode", "id": "x", "name": "y"}, images) is None
    assert parse_track({"type": "track", "id": "x", "name": "y", "is_local": True}, images) is None


# ---------- paging ----------


class PagedStub(requests.Session):
    """Serves playlist pages by URL, counting requests."""

    def __init__(self, pages: dict[str, Any]) -> None:
        super().__init__()
        self.pages = pages
        self.requested: list[str] = []

    def send(self, request: requests.PreparedRequest, **kwargs: Any) -> requests.Response:  # noqa: ANN401
        url = str(request.url)
        self.requested.append(url)
        response = requests.Response()
        response.status_code = 200
        response._content = json.dumps(self.pages[url]).encode()
        response.url = url
        return response


FIRST = "https://api.spotify.com/v1/playlists/p/items?limit=50"
SECOND = "https://api.spotify.com/v1/playlists/p/items?offset=50&limit=50"


def entry(track_id: str, name: str) -> dict[str, Any]:
    return {"item": {"type": "track", "id": track_id, "name": name, "artists": []}}


def test_follows_next_in_the_nested_paging(images: FakeImages) -> None:
    session = PagedStub(
        {
            FIRST: {
                "type": "playlist",
                "items": {"items": [entry("a" * 22, "One")], "next": SECOND},
            },
            SECOND: {"items": [entry("b" * 22, "Two")], "next": None},
        }
    )
    tracks = parse_playlist_items(_playlist_pages(session, "p", {}), images)
    assert [t["title"] for t in tracks] == ["One", "Two"]
    assert session.requested == [FIRST, SECOND]


def test_stops_when_next_points_back(images: FakeImages) -> None:
    session = PagedStub({FIRST: {"items": [entry("a" * 22, "One")], "next": FIRST}})
    tracks = parse_playlist_items(_playlist_pages(session, "p", {}), images)
    assert len(tracks) == 1
    assert session.requested == [FIRST]


# ---------- <Track id="…"> embeds ----------


def test_finds_embedded_track_ids_and_skips_invalid_ones(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    (tmp_path / "journal").mkdir()
    (tmp_path / "journal" / "a.mdx").write_text(
        'Intro\n\n<Track id="7uIy4cNPvKpDYaXfCcmuSe" />\n'
        "<Track label=\"on repeat\" id='0RfczquLPHCwq7FuNDVLWi' />\n"
        '<Track id="placeholder1" />\n',
        encoding="utf-8",
    )
    (tmp_path / "b.mdx").write_text('<Track id="7uIy4cNPvKpDYaXfCcmuSe"/>', encoding="utf-8")
    (tmp_path / "notes.md").write_text('<Track id="0lsj8PU1ANb1Vwb07CZuAS" />', encoding="utf-8")

    with caplog.at_level(logging.WARNING, logger="fetchers"):
        ids = embedded_track_ids(tmp_path)

    assert sorted(ids) == ["0RfczquLPHCwq7FuNDVLWi", "7uIy4cNPvKpDYaXfCcmuSe"]
    assert 'skipped <Track id="placeholder1"> in a.mdx: not a Spotify track id' in caplog.text
