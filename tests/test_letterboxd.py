from __future__ import annotations

from scripts.letterboxd import parse_description, parse_rss
from tests.conftest import FakeImages, fixture_text


def test_parses_diary_entries_and_skips_lists(images: FakeImages) -> None:
    films = parse_rss(fixture_text("letterboxd.xml"), images)
    assert [f["title"] for f in films] == ["Perfect Days", "Paris, Texas", "Ikiru"]


def test_reads_year_rating_date_and_link(images: FakeImages) -> None:
    first = parse_rss(fixture_text("letterboxd.xml"), images)[0]
    assert first["year"] == 2023
    assert first["rating"] == 4.5
    assert first["watched_date"] == "2026-09-26"
    assert first["url"] == "https://letterboxd.com/example/film/perfect-days-2023/"


def test_rating_is_none_when_unrated(images: FakeImages) -> None:
    assert parse_rss(fixture_text("letterboxd.xml"), images)[2]["rating"] is None


def test_downloads_posters(images: FakeImages) -> None:
    films = parse_rss(fixture_text("letterboxd.xml"), images)
    assert images.saved[0][0].endswith("perfect-days-0-600-0-900.jpg")
    assert all(f["poster"] for f in films)


def test_review_text_drops_boilerplate_and_keeps_paragraphs(images: FakeImages) -> None:
    films = parse_rss(fixture_text("letterboxd.xml"), images)
    assert films[0]["review"] == (
        "Quiet mornings, cassette tapes and trees.\n"
        "The kind of film that makes you notice light.\n\n"
        "Went home and cleaned the kitchen."
    )
    assert films[1]["review"] is None  # "Rewatched on …" only
    assert films[2]["review"] is None  # "Watched on …" only


def test_description_without_image() -> None:
    assert parse_description("<p>Just words.</p>") == (None, "Just words.")
