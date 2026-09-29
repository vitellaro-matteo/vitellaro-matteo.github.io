from __future__ import annotations

import pytest

from scripts.lastfm import LastfmError, parse_top_track
from tests.conftest import fixture_json


def test_reads_the_most_played_track() -> None:
    track = parse_top_track(fixture_json("lastfm_top_tracks.json"))
    assert track == {
        "title": "Can II",
        "artist": "Hana Stretton",
        "url": "https://www.last.fm/music/Hana+Stretton/_/Can+II",
        "playcount": 14,
    }


def test_an_empty_week_has_no_track() -> None:
    assert parse_top_track(fixture_json("lastfm_top_tracks_empty.json")) is None


def test_accepts_a_single_track_as_an_object_and_artist_as_text() -> None:
    data = {
        "toptracks": {"track": {"name": "Helpless", "artist": {"#text": "The Cleaners From Venus"}}}
    }
    track = parse_top_track(data)
    assert track is not None
    assert track["artist"] == "The Cleaners From Venus"
    assert track["playcount"] == 0
    assert track["url"] == ""


def test_skips_tracks_without_a_title_or_artist() -> None:
    data = {
        "toptracks": {
            "track": [
                {"name": "", "artist": {"name": "Someone"}},
                "not a track",
                {"name": "My Ideal", "artist": {"name": "Mei Semones"}, "playcount": "3"},
            ]
        }
    }
    track = parse_top_track(data)
    assert track is not None
    assert track["title"] == "My Ideal"


def test_last_fm_errors_carry_their_code_and_message() -> None:
    with pytest.raises(LastfmError, match=r"Last.fm error 6: User not found"):
        parse_top_track(fixture_json("lastfm_error_user_not_found.json"))


def test_non_object_responses_are_errors() -> None:
    with pytest.raises(LastfmError, match="unexpected response"):
        parse_top_track(["a list"])
