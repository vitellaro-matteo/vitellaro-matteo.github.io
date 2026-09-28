from __future__ import annotations

from scripts.goodreads import latest_finished, parse_shelf, to_book
from tests.conftest import FakeImages, fixture_text


def test_parses_the_currently_reading_shelf() -> None:
    [entry] = parse_shelf(fixture_text("goodreads_currently_reading.xml"))
    assert entry.title == "Piranesi"
    assert entry.author == "Susanna Clarke"
    assert entry.pages == 272


def test_skips_the_no_photo_placeholder_cover() -> None:
    [entry] = parse_shelf(fixture_text("goodreads_currently_reading.xml"))
    assert entry.cover_url is not None
    assert "nophoto" not in entry.cover_url
    assert entry.cover_url.endswith("50202953._SX98_.jpg")


def test_latest_finished_sorts_by_read_date_with_undated_last() -> None:
    entries = parse_shelf(fixture_text("goodreads_read.xml"))
    assert [e.title for e in latest_finished(entries)] == [
        "The Remains of the Day",
        "Klara and the Sun",
    ]
    assert [e.title for e in latest_finished(entries, count=3)][-1] == "A book added long ago"


def test_missing_page_count_is_none() -> None:
    entries = parse_shelf(fixture_text("goodreads_read.xml"))
    assert entries[0].pages is None


def test_to_book_links_the_book_and_saves_the_cover(images: FakeImages) -> None:
    [entry] = parse_shelf(fixture_text("goodreads_currently_reading.xml"))
    book = to_book(entry, images)
    assert book["url"] == "https://www.goodreads.com/book/show/50202953"
    assert book["cover"] is not None
    assert images.saved[0][1] == "book:50202953"
