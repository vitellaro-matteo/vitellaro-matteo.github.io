from __future__ import annotations

from typing import Any

import pytest
import requests

from scripts.deezer import ARTIST_SEARCH, lookup_artist, match_artist
from tests.conftest import fixture_json, fixture_text


class ArtistStub(requests.Session):
    """Answers every Deezer request with one saved response, and records the URLs."""

    def __init__(self, body: str) -> None:
        super().__init__()
        self.body = body
        self.urls: list[str] = []

    def send(self, request: requests.PreparedRequest, **kwargs: Any) -> requests.Response:  # noqa: ANN401
        self.urls.append(str(request.url))
        response = requests.Response()
        response.status_code = 200
        response._content = self.body.encode()
        response.url = str(request.url)
        return response


def test_matches_the_artist_and_keeps_their_photo() -> None:
    artist = match_artist(fixture_json("deezer_artist_hana_stretton.json"), "Hana Stretton")
    assert artist == {
        "id": 167184437,
        "name": "Hana Stretton",
        "picture": "https://cdn-images.dzcdn.net/images/artist/a8f14ed6bfbcff4024c27808ed718886/250x250-000000-80-0-0.jpg",
    }


def test_names_are_compared_normalised_and_the_first_match_wins() -> None:
    results = fixture_json("deezer_artist_cleaners_from_venus.json")
    # Deezer has both "The Cleaners From Venus" and "Cleaners From Venus";
    # without the leading "The" they are the same name, so its first (most
    # followed) result is the one kept.
    artist = match_artist(results, "cleaners from venus")
    assert artist is not None
    assert artist["id"] == results["data"][0]["id"] == 1877261
    assert artist["name"] == "The Cleaners From Venus"


def test_an_artist_without_a_photo_has_no_picture() -> None:
    results = fixture_json("deezer_artist_no_picture.json")
    placeholder = next(item for item in results["data"] if item["name"] == "&&& unknown demo")
    assert "/images/artist//" in placeholder["picture_medium"]
    artist = match_artist(results, "&&& unknown demo")
    assert artist is not None
    assert artist["picture"] is None


def test_a_similar_name_is_not_a_match() -> None:
    results = fixture_json("deezer_artist_no_picture.json")
    assert match_artist(results, "Unknown Mortal") is None


def test_no_results_means_no_artist() -> None:
    assert match_artist(fixture_json("deezer_artist_no_match.json"), "Nobody") is None
    assert match_artist({"data": [{"id": True, "name": "Nobody"}]}, "Nobody") is None
    assert match_artist({"data": "oops"}, "Nobody") is None
    assert match_artist(None, "Nobody") is None


def test_only_https_photos_are_kept() -> None:
    results = {"data": [{"id": 1, "name": "Someone", "picture_medium": "http://x.test/a.jpg"}]}
    artist = match_artist(results, "Someone")
    assert artist is not None
    assert artist["picture"] is None


def test_looks_the_artist_up_by_name() -> None:
    session = ArtistStub(fixture_text("deezer_artist_hana_stretton.json"))
    artist = lookup_artist(session, "Hana Stretton")
    assert artist is not None
    assert artist["id"] == 167184437
    assert session.urls == [f"{ARTIST_SEARCH}?q=Hana+Stretton"]


def test_deezer_errors_mean_no_artist(caplog: pytest.LogCaptureFixture) -> None:
    session = ArtistStub(fixture_text("deezer_error_quota.json"))
    assert lookup_artist(session, "Hana Stretton") is None
    assert "Quota limit exceeded" in caplog.text
