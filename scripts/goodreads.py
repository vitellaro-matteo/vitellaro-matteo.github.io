"""Goodreads: the currently-reading shelf and the latest finished books, from RSS."""

from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import NamedTuple, TypedDict
from xml.etree.ElementTree import Element

import requests
from defusedxml import ElementTree

from scripts.common import FeedResult, ImageSaver, get, utc_now
from scripts.site_config import require_setting

RSS_URL = "https://www.goodreads.com/review/list_rss/{user_id}"
FINISHED = 2
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


class Book(TypedDict):
    title: str
    author: str
    url: str
    cover: str | None
    pages: int | None


class GoodreadsFeed(TypedDict):
    fetched_at: str
    currently_reading: list[Book]
    read: list[Book]


class ShelfEntry(NamedTuple):
    book_id: str
    title: str
    author: str
    cover_url: str | None
    pages: int | None
    read_at: datetime


def _text(item: Element, path: str) -> str:
    return (item.findtext(path) or "").strip()


def _cover_url(item: Element) -> str | None:
    """The largest cover Goodreads offers, ignoring its "no photo" placeholder."""
    for field in ("book_large_image_url", "book_medium_image_url", "book_image_url"):
        url = _text(item, field)
        if url and "nophoto" not in url:
            return url
    return None


def parse_shelf(xml: str) -> list[ShelfEntry]:
    entries: list[ShelfEntry] = []
    for item in ElementTree.fromstring(xml).iterfind("channel/item"):
        pages = _text(item, "book/num_pages")
        read_at = _text(item, "user_read_at")
        entries.append(
            ShelfEntry(
                book_id=_text(item, "book_id"),
                title=_text(item, "title"),
                author=_text(item, "author_name"),
                cover_url=_cover_url(item),
                pages=int(pages) if pages.isdigit() else None,
                read_at=parsedate_to_datetime(read_at) if read_at else _EPOCH,
            )
        )
    return entries


def latest_finished(entries: list[ShelfEntry], count: int = FINISHED) -> list[ShelfEntry]:
    """The most recently finished books; ones without a finish date sort last."""
    return sorted(entries, key=lambda entry: entry.read_at, reverse=True)[:count]


def to_book(entry: ShelfEntry, images: ImageSaver) -> Book:
    return {
        "title": entry.title,
        "author": entry.author,
        "url": f"https://www.goodreads.com/book/show/{entry.book_id}",
        "cover": images.save(entry.cover_url, key=f"book:{entry.book_id}"),
        "pages": entry.pages,
    }


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    user_id = require_setting(config, "goodreadsUserId")
    url = RSS_URL.format(user_id=user_id)
    reading = parse_shelf(get(session, url, params={"shelf": "currently-reading"}).text)
    finished = latest_finished(parse_shelf(get(session, url, params={"shelf": "read"}).text))
    feed: GoodreadsFeed = {
        "fetched_at": utc_now(),
        "currently_reading": [to_book(entry, images) for entry in reading],
        "read": [to_book(entry, images) for entry in finished],
    }
    return FeedResult(feed, f"{len(reading)} reading, {len(finished)} finished")
