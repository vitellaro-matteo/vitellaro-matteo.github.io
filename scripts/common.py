"""Shared plumbing for the fetchers: paths, HTTP, secrets and image downloads."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import tempfile
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, NamedTuple, Protocol

import requests

# Decoded JSON from an API: shape-checked by the parsers, not by the type system.
JsonObject = dict[str, Any]

ROOT = Path(__file__).resolve().parent.parent
LIVE_DIR = ROOT / "src" / "data" / "live"
MEDIA_DIR = ROOT / "public" / "media" / "feeds"
MEDIA_URL = "/media/feeds"

TIMEOUT_SECONDS = 20
USER_AGENT = "slow-feed-fetcher/1.0 (+https://vitellaro-matteo.github.io)"

IMAGE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

log = logging.getLogger("fetchers")


class SkipFetcher(Exception):  # noqa: N818 — a signal, not an error
    """Raised when a fetcher can't run because a secret or setting is missing."""


class FeedResult(NamedTuple):
    """A fetcher's output: the feed JSON and a short line for the run summary."""

    data: Mapping[str, object]
    detail: str


def require_env(name: str) -> str:
    """
    The value of an environment variable (an Actions secret), or skip the fetcher.
    Surrounding whitespace is stripped, since pasted secrets often end in a newline;
    the log says so, without the value.
    """
    raw = os.environ.get(name, "")
    value = raw.strip()
    if not value:
        raise SkipFetcher(f"{name} is not set")
    if value != raw:
        log.warning("%s had leading or trailing whitespace; it was stripped", name)
    return value


def http_session() -> requests.Session:
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    return session


def get(
    session: requests.Session,
    url: str,
    *,
    params: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> requests.Response:
    """GET with a timeout, raising on HTTP errors."""
    response = session.get(url, params=params, headers=headers, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return response


_TOKEN_IN_URL = re.compile(r"(access_token|token|key)=[^&\s]+")


def redact(message: str) -> str:
    """Hides credentials that request URLs carry in their query string."""
    return _TOKEN_IN_URL.sub(r"\1=***", message)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_json(path: Path, data: object) -> None:
    """Writes JSON atomically, so a crash never leaves a half-written feed behind."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False
    ) as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    Path(handle.name).replace(path)


class ImageSaver(Protocol):
    def save(self, url: str | None, key: str | None = None) -> str | None:
        """Downloads an image and returns its site path, or None if unavailable."""


class MediaStore:
    """
    Downloads a feed's images into public/media/feeds/<feed>/ so the site never
    hotlinks (a source's CDN links can change or expire). Files are named by a hash of `key` (or the
    URL), so an image already on disk is not downloaded again.
    """

    def __init__(self, feed: str, session: requests.Session, root: Path = MEDIA_DIR) -> None:
        self.feed = feed
        self.session = session
        self.directory = root / feed
        self.kept: set[str] = set()

    def save(self, url: str | None, key: str | None = None) -> str | None:
        if not url:
            return None
        stem = hashlib.sha256((key or url).encode()).hexdigest()[:16]
        existing = next(self.directory.glob(f"{stem}.*"), None)
        if existing is not None:
            self.kept.add(existing.name)
            return f"{MEDIA_URL}/{self.feed}/{existing.name}"

        try:
            response = get(self.session, url)
        except requests.RequestException as error:
            log.warning("%s: could not download an image (%s)", self.feed, redact(str(error)))
            return None
        content_type = response.headers.get("Content-Type", "").split(";")[0].strip()
        extension = IMAGE_EXTENSIONS.get(content_type)
        if extension is None:
            log.warning("%s: skipped a download that is not an image (%s)", self.feed, content_type)
            return None

        self.directory.mkdir(parents=True, exist_ok=True)
        name = f"{stem}{extension}"
        (self.directory / name).write_bytes(response.content)
        self.kept.add(name)
        return f"{MEDIA_URL}/{self.feed}/{name}"

    def prune(self) -> None:
        """Removes images the latest successful fetch no longer uses."""
        if not self.directory.exists():
            return
        for path in self.directory.iterdir():
            if path.is_file() and path.name not in self.kept:
                path.unlink()
