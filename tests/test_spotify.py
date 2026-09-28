from __future__ import annotations

from pathlib import Path

from scripts.spotify import embedded_track_ids, parse_playlist_items, parse_track
from tests.conftest import FakeImages, fixture_json


def test_parses_playlist_items(images: FakeImages) -> None:
    tracks = parse_playlist_items([fixture_json("spotify_playlist_items.json")], images)

    assert [t["title"] for t in tracks] == ["Harvest Moon", "Blinding Lights", "Mr. Brightside"]
    first = tracks[0]
    assert first["id"] == "4uLU6hMCjMI75M1A2tKUQC"
    assert first["artists"] == ["Neil Young"]
    assert first["url"] == "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
    assert tracks[1]["artists"] == ["The Weeknd", "Rosalía"]


def test_skips_local_files_and_episodes(images: FakeImages) -> None:
    tracks = parse_playlist_items([fixture_json("spotify_playlist_items.json")], images)
    assert "voice memo" not in [t["title"] for t in tracks]
    assert "A podcast episode" not in [t["title"] for t in tracks]


def test_reads_the_older_track_key_too(images: FakeImages) -> None:
    tracks = parse_playlist_items([fixture_json("spotify_playlist_items.json")], images)
    assert tracks[-1]["id"] == "3n3Ppam7vgaVa1iaRUc9Lp"


def test_picks_a_300px_cover_and_falls_back_to_the_largest(images: FakeImages) -> None:
    tracks = parse_playlist_items([fixture_json("spotify_playlist_items.json")], images)
    urls = [url for url, _ in images.saved]
    assert urls == ["https://i.scdn.co/image/medium300", "https://i.scdn.co/image/only200"]
    assert tracks[0]["cover"] is not None
    assert tracks[1]["cover"] is None  # the album has no images


def test_parses_a_single_track(images: FakeImages) -> None:
    raw = fixture_json("spotify_playlist_items.json")["items"][0]["item"]
    track = parse_track(raw, images)
    assert track is not None
    assert track["title"] == "Harvest Moon"


def test_finds_embedded_track_ids(tmp_path: Path) -> None:
    (tmp_path / "journal").mkdir()
    (tmp_path / "journal" / "a.mdx").write_text(
        'Intro\n\n<Track id="4uLU6hMCjMI75M1A2tKUQC" />\n'
        "<Track label=\"on repeat\" id='0VjIjW4GlUZAMYd2vXMi3b' />\n",
        encoding="utf-8",
    )
    (tmp_path / "b.mdx").write_text('<Track id="4uLU6hMCjMI75M1A2tKUQC"/>', encoding="utf-8")
    (tmp_path / "notes.md").write_text('<Track id="ignoredBecauseNotMdx" />', encoding="utf-8")

    assert sorted(embedded_track_ids(tmp_path)) == [
        "0VjIjW4GlUZAMYd2vXMi3b",
        "4uLU6hMCjMI75M1A2tKUQC",
    ]
