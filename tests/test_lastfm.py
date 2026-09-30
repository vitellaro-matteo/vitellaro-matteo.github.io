from __future__ import annotations

from typing import Any, cast
from urllib.parse import parse_qs, urlsplit

import pytest
import requests

from scripts.lastfm import LastfmError, LastfmFeed, fetch, parse_top_artist, parse_top_track
from tests.conftest import FakeImages, fixture_json, fixture_text

HANA_PHOTO = (
    "https://cdn-images.dzcdn.net/images/artist/a8f14ed6bfbcff4024c27808ed718886"
    "/250x250-000000-80-0-0.jpg"
)


class Services(requests.Session):
    """Answers Last.fm by method and Deezer by path with saved responses."""

    def __init__(self, answers: dict[str, str]) -> None:
        super().__init__()
        self.answers = answers
        self.requests: list[str] = []

    def send(self, request: requests.PreparedRequest, **kwargs: Any) -> requests.Response:  # noqa: ANN401
        url = urlsplit(str(request.url))
        query = parse_qs(url.query)
        key = query["method"][0] if "method" in query else url.path
        self.requests.append(key)
        response = requests.Response()
        response.status_code = 200
        response._content = self.answers[key].encode()
        response.url = str(request.url)
        return response


def services(overrides: dict[str, str] | None = None) -> Services:
    answers = {
        "user.gettoptracks": fixture_text("lastfm_top_tracks.json"),
        "user.gettopartists": fixture_text("lastfm_top_artists.json"),
        "/search": fixture_text("deezer_search_can_ii.json"),
        "/search/artist": fixture_text("deezer_artist_hana_stretton.json"),
    }
    answers.update(overrides or {})
    return Services(answers)


def fetched(session: Services, images: FakeImages) -> tuple[LastfmFeed, str]:
    result = fetch(session, CONFIG, images)
    return cast(LastfmFeed, result.data), result.detail


@pytest.fixture(autouse=True)
def lastfm_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LASTFM_API_KEY", "test-key")


CONFIG = {"lastfmUsername": "example"}


def test_reads_the_most_played_track() -> None:
    track = parse_top_track(fixture_json("lastfm_top_tracks.json"))
    assert track == {
        "title": "Can II",
        "artist": "Hana Stretton",
        "url": "https://www.last.fm/music/Hana+Stretton/_/Can+II",
        "playcount": 14,
        "deezer_id": None,
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


def test_reads_the_most_played_artist_and_ignores_last_fm_placeholders() -> None:
    assert parse_top_artist(fixture_json("lastfm_top_artists.json")) == {
        "name": "Hana Stretton",
        "url": "https://www.last.fm/music/Hana+Stretton",
        "playcount": 23,
        "image": None,
    }


def test_an_empty_week_has_no_artist() -> None:
    assert parse_top_artist(fixture_json("lastfm_top_artists_empty.json")) is None
    assert parse_top_artist({"topartists": {"artist": {"name": "", "playcount": "2"}}}) is None


def test_top_artist_errors_are_last_fm_errors() -> None:
    with pytest.raises(LastfmError, match=r"Last.fm error 6: User not found"):
        parse_top_artist(fixture_json("lastfm_error_user_not_found.json"))


# ---------- the whole fetch, with Deezer ----------


def test_fetch_matches_the_track_and_the_artist_on_deezer() -> None:
    session, images = services(), FakeImages()
    feed, _ = fetched(session, images)

    assert feed["top_track"] is not None
    assert feed["top_track"]["deezer_id"] == 2113267347
    assert feed["top_artist"] == {
        "name": "Hana Stretton",
        "url": "https://www.last.fm/music/Hana+Stretton",
        "playcount": 23,
        "image": "/media/feeds/test/1.jpg",
    }
    assert images.saved == [(HANA_PHOTO, "deezer-artist:167184437")]
    assert session.requests == [
        "user.gettoptracks",
        "user.gettopartists",
        "/search",
        "/search/artist",
    ]


def test_no_match_on_deezer_leaves_no_preview_and_no_photo() -> None:
    session = services(
        {
            "/search": fixture_text("deezer_search_no_match.json"),
            "/search/artist": fixture_text("deezer_artist_no_match.json"),
        }
    )
    images = FakeImages()
    feed, _ = fetched(session, images)

    assert feed["top_track"] is not None
    assert feed["top_track"]["deezer_id"] is None
    assert feed["top_artist"] is not None
    assert feed["top_artist"]["name"] == "Hana Stretton"
    assert feed["top_artist"]["image"] is None
    assert images.saved == []


def test_deezer_errors_never_cost_the_feed(caplog: pytest.LogCaptureFixture) -> None:
    quota = fixture_text("deezer_error_quota.json")
    feed, detail = fetched(services({"/search": quota, "/search/artist": quota}), FakeImages())

    assert feed["top_track"] is not None
    assert feed["top_track"]["deezer_id"] is None
    assert feed["top_artist"] is not None
    assert feed["top_artist"]["image"] is None
    assert "Quota limit exceeded" in caplog.text
    assert detail == "Can II (14 plays), Hana Stretton (23 plays)"


def test_an_empty_week_looks_nothing_up() -> None:
    session = services(
        {
            "user.gettoptracks": fixture_text("lastfm_top_tracks_empty.json"),
            "user.gettopartists": fixture_text("lastfm_top_artists_empty.json"),
        }
    )
    feed, detail = fetched(session, FakeImages())
    assert feed["top_track"] is None
    assert feed["top_artist"] is None
    assert session.requests == ["user.gettoptracks", "user.gettopartists"]
    assert detail == "no plays, no artist"
