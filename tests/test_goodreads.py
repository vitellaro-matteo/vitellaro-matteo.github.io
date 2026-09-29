from __future__ import annotations

from scripts.goodreads import FINISHED, latest_finished, parse_shelf, to_book
from tests.conftest import FakeImages, fixture_text


def test_parses_the_currently_reading_shelf() -> None:
    [entry] = parse_shelf(fixture_text("goodreads_currently_reading.xml"))
    assert entry.title == "Piranesi"
    assert entry.author == "Susanna Clarke"
    assert entry.rating is None  # Goodreads sends 0 for "not rated yet"


def test_skips_the_no_photo_placeholder_cover() -> None:
    [entry] = parse_shelf(fixture_text("goodreads_currently_reading.xml"))
    assert entry.cover_url is not None
    assert "nophoto" not in entry.cover_url
    assert entry.cover_url.endswith("50202953._SX98_.jpg")


def test_reads_my_ratings() -> None:
    ratings = {e.title: e.rating for e in parse_shelf(fixture_text("goodreads_read.xml"))}
    assert ratings == {
        "A book added long ago": None,
        "Klara and the Sun": 4,
        "The Remains of the Day": 5,
    }


def test_keeps_the_six_most_recently_finished_books() -> None:
    assert FINISHED == 6
    entries = parse_shelf(fixture_text("goodreads_read.xml"))
    assert [e.title for e in latest_finished(entries)] == [
        "The Remains of the Day",
        "Klara and the Sun",
        "A book added long ago",  # no finish date: sorts last
    ]
    assert [e.title for e in latest_finished(entries, count=1)] == ["The Remains of the Day"]


def test_to_book_links_the_book_page_and_saves_the_cover(images: FakeImages) -> None:
    entries = parse_shelf(fixture_text("goodreads_read.xml"))
    book = to_book(entries[1], images)
    assert book == {
        "title": "Klara and the Sun",
        "author": "Kazuo Ishiguro",
        "url": "https://www.goodreads.com/book/show/54120408",
        "cover": "/media/feeds/test/1.jpg",
        "rating": 4,
    }
    assert images.saved[0][1] == "book:54120408"
