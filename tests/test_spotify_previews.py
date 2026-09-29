from __future__ import annotations

import json
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
import requests

from scripts.common import SkipFetcher
from scripts.spotify import (
    DEEZER_SEARCH,
    Track,
    add_previews,
    base_title,
    lookup_preview,
    match_preview,
    normalise,
    playlist_id_from,
)
from tests.conftest import fixture_json, fixture_text


class DeezerStub(requests.Session):
    """Answers Deezer searches by query with saved responses, and records the queries."""

    def __init__(self, answers: dict[str, str]) -> None:
        super().__init__()
        self.answers = answers
        self.queries: list[str] = []

    def send(self, request: requests.PreparedRequest, **kwargs: Any) -> requests.Response:  # noqa: ANN401
        query = parse_qs(urlsplit(str(request.url)).query)["q"][0]
        self.queries.append(query)
        response = requests.Response()
        response.status_code = 200
        response._content = self.answers.get(query, '{"data": [], "total": 0}').encode()
        response.url = str(request.url)
        return response


def track(title: str, *artists: str) -> Track:
    return {
        "id": "7uIy4cNPvKpDYaXfCcmuSe",
        "title": title,
        "artists": list(artists),
        "url": "",
        "cover": None,
        "preview": None,
    }


# ---------- playlist id from site.config.ts ----------


@pytest.mark.parametrize(
    "value",
    [
        "5vxDxvkiXxa8SCCT0MgJMI",
        "5vxDxvkiXxa8SCCT0MgJMI?si=afdc784d9f024ba2",
        "https://open.spotify.com/playlist/5vxDxvkiXxa8SCCT0MgJMI?si=afdc784d9f024ba2",
        "spotify:playlist:5vxDxvkiXxa8SCCT0MgJMI",
    ],
)
def test_accepts_an_id_a_share_link_or_a_uri(value: str) -> None:
    assert playlist_id_from(value) == "5vxDxvkiXxa8SCCT0MgJMI"


def test_rejects_something_that_is_not_a_playlist_id() -> None:
    with pytest.raises(SkipFetcher, match="not a playlist id or link"):
        playlist_id_from("last week's finds")


# ---------- matching Deezer results ----------


def test_normalises_case_accents_punctuation_and_a_leading_the() -> None:
    assert normalise("The Cleaners From Venus") == "cleaners from venus"
    assert normalise("Rosalía") == "rosalia"
    assert normalise("Wake Me if I'm Asleep") == "wake me if i m asleep"


def test_base_title_drops_versions() -> None:
    assert base_title("2close2farr - BBC Maida Vale Session") == "2close2farr"
    assert base_title("2close2farr (BBC Maida Vale Session)") == "2close2farr"
    assert base_title("Song [Remastered]") == "Song"
    assert base_title("(Untitled)") == "(Untitled)"


def test_matches_the_exact_title_and_artist() -> None:
    preview = match_preview(fixture_json("deezer_search_can_ii.json"), "Can II", ["Hana Stretton"])
    assert preview is not None
    first = fixture_json("deezer_search_can_ii.json")["data"][0]
    assert first["title"] == "Can II"
    assert preview == first["preview"]


def test_does_not_confuse_similar_titles() -> None:
    results = fixture_json("deezer_search_can_ii.json")
    assert match_preview(results, "Can I", ["Hana Stretton"]) == results["data"][1]["preview"]
    assert match_preview(results, "Can III", ["Hana Stretton"]) is None


def test_prefers_the_same_version_over_the_plain_title() -> None:
    results = fixture_json("deezer_search_2close2farr.json")
    session_version = results["data"][1]
    assert session_version["title"] == "2close2farr (BBC Maida Vale Session)"
    preview = match_preview(results, "2close2farr - BBC Maida Vale Session", ["Momoko Gill"])
    assert preview == session_version["preview"]


def test_falls_back_to_the_title_without_its_version() -> None:
    results = fixture_json("deezer_search_2close2farr.json")
    preview = match_preview(results, "2close2farr - Live at Home", ["Momoko Gill"])
    assert preview == results["data"][0]["preview"]


def test_any_credited_artist_can_match() -> None:
    results = fixture_json("deezer_search_lived_in_trees.json")
    preview = match_preview(results, "I Lived in Trees", ["Mark Fry", "The A. Lords"])
    assert preview == results["data"][0]["preview"]


def test_the_artist_must_match() -> None:
    results = fixture_json("deezer_search_can_ii.json")
    assert match_preview(results, "Can II", ["Someone Else"]) is None


def test_no_results_means_no_preview() -> None:
    assert match_preview(fixture_json("deezer_search_no_match.json"), "Tune", ["Nobody"]) is None
    assert match_preview({"data": "oops"}, "Tune", ["Nobody"]) is None
    assert match_preview(None, "Tune", ["Nobody"]) is None


# ---------- lookups ----------


def test_searches_by_first_artist_and_base_title() -> None:
    session = DeezerStub(
        {"Momoko Gill 2close2farr": fixture_text("deezer_search_2close2farr.json")}
    )
    preview = lookup_preview(session, "2close2farr - BBC Maida Vale Session", ["Momoko Gill"])
    assert session.queries == ["Momoko Gill 2close2farr"]
    assert preview is not None
    assert preview.startswith("https://cdnt-preview.dzcdn.net/")


def test_deezer_errors_mean_no_preview(caplog: pytest.LogCaptureFixture) -> None:
    session = DeezerStub({"Hana Stretton Can II": fixture_text("deezer_error_quota.json")})
    assert lookup_preview(session, "Can II", ["Hana Stretton"]) is None
    assert "Quota limit exceeded" in caplog.text


def test_network_failures_mean_no_preview() -> None:
    class Offline(requests.Session):
        def send(self, request: requests.PreparedRequest, **kwargs: Any) -> requests.Response:  # noqa: ANN401
            raise requests.ConnectionError("offline")

    assert lookup_preview(Offline(), "Can II", ["Hana Stretton"]) is None


def test_add_previews_fills_matches_and_leaves_misses_empty() -> None:
    session = DeezerStub(
        {
            "Hana Stretton Can II": fixture_text("deezer_search_can_ii.json"),
            "Mark Fry I Lived in Trees": fixture_text("deezer_search_lived_in_trees.json"),
        }
    )
    tracks = [
        track("Can II", "Hana Stretton"),
        track("I Lived in Trees", "Mark Fry", "The A. Lords"),
        track("Unknown Song", "Nobody"),
    ]
    pauses: list[float] = []

    assert add_previews(session, tracks, pause=pauses.append) == 2

    assert [t["preview"] is not None for t in tracks] == [True, True, False]
    assert len(pauses) == 2  # between requests, not before the first
    assert session.queries[0] == "Hana Stretton Can II"
    assert json.loads(fixture_text("deezer_search_no_match.json"))["total"] == 0
    assert DEEZER_SEARCH == "https://api.deezer.com/search"
