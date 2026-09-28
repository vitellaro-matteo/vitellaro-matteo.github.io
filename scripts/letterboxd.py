"""Letterboxd: recently watched films from the public diary RSS feed."""

from __future__ import annotations

from html.parser import HTMLParser
from typing import TypedDict
from xml.etree.ElementTree import Element

import requests
from defusedxml import ElementTree

from scripts.common import FeedResult, ImageSaver, get, utc_now
from scripts.site_config import require_setting

NS = {"letterboxd": "https://letterboxd.com"}
MAX_FILMS = 10

# Letterboxd writes these into the description when there is no real review.
_BOILERPLATE = ("Watched on ", "Rewatched on ", "This review may contain spoilers")


class Film(TypedDict):
    title: str
    year: int | None
    rating: float | None
    watched_date: str
    url: str
    poster: str | None
    review: str | None


class LetterboxdFeed(TypedDict):
    fetched_at: str
    films: list[Film]


class _Description(HTMLParser):
    """Collects the poster URL and the text of each paragraph."""

    def __init__(self) -> None:
        super().__init__()
        self.poster: str | None = None
        self.paragraphs: list[str] = []
        self._current: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "img" and self.poster is None:
            self.poster = dict(attrs).get("src")
        elif tag == "p":
            self._current = []
        elif tag == "br" and self._current is not None:
            self._current.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "p" and self._current is not None:
            self.paragraphs.append("".join(self._current).strip())
            self._current = None

    def handle_data(self, data: str) -> None:
        if self._current is not None:
            self._current.append(data)


def parse_description(html: str) -> tuple[str | None, str | None]:
    """The poster URL and the review text (None when there is only boilerplate)."""
    parser = _Description()
    parser.feed(html)
    review = [p for p in parser.paragraphs if p and not p.startswith(_BOILERPLATE)]
    return parser.poster, "\n\n".join(review) or None


def _text(item: Element, path: str) -> str | None:
    value = item.findtext(path, namespaces=NS)
    return value.strip() if value else None


def parse_rss(xml: str, images: ImageSaver) -> list[Film]:
    """Diary entries, newest first. Lists and other non-film items are skipped."""
    films: list[Film] = []
    for item in ElementTree.fromstring(xml).iterfind("channel/item"):
        title = _text(item, "letterboxd:filmTitle")
        watched = _text(item, "letterboxd:watchedDate")
        if not title or not watched:
            continue
        year = _text(item, "letterboxd:filmYear")
        rating = _text(item, "letterboxd:memberRating")
        link = _text(item, "link") or ""
        poster, review = parse_description(_text(item, "description") or "")
        films.append(
            {
                "title": title,
                "year": int(year) if year else None,
                "rating": float(rating) if rating else None,
                "watched_date": watched,
                "url": link,
                "poster": images.save(poster, key=f"poster:{title}:{year}"),
                "review": review,
            }
        )
        if len(films) == MAX_FILMS:
            break
    return films


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    username = require_setting(config, "letterboxdUsername")
    xml = get(session, f"https://letterboxd.com/{username}/rss/").text
    films = parse_rss(xml, images)
    feed: LetterboxdFeed = {"fetched_at": utc_now(), "films": films}
    return FeedResult(feed, f"{len(films)} films")
