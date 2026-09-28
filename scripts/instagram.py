"""
Instagram: the latest posts, through the Instagram API with Instagram Login.

Long-lived tokens expire after 60 days, so every run refreshes the token and,
when Instagram hands back a new one, stores it in the INSTAGRAM_TOKEN secret.
"""

from __future__ import annotations

import os
import subprocess
from collections.abc import Callable, Sequence
from datetime import datetime, timezone
from typing import TypedDict

import requests

from scripts.common import FeedResult, ImageSaver, JsonObject, get, log, require_env, utc_now

API = "https://graph.instagram.com"
MEDIA_FIELDS = "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp"
POSTS = 6

# Runs a command with the given stdin and environment; injectable for tests.
CommandRunner = Callable[[Sequence[str], str, dict[str, str]], int]


class Post(TypedDict):
    id: str
    permalink: str
    media_type: str
    image: str | None
    caption: str | None
    timestamp: str


class InstagramFeed(TypedDict):
    fetched_at: str
    posts: list[Post]


def _iso_timestamp(value: str) -> str:
    """Instagram's `2026-09-27T12:00:00+0000` as `2026-09-27T12:00:00Z`, which browsers parse."""
    parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S%z")
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_media(data: JsonObject, images: ImageSaver, limit: int = POSTS) -> list[Post]:
    posts: list[Post] = []
    for item in data.get("data") or []:
        media_type = str(item.get("media_type", ""))
        # Videos only have a playable URL; their still frame is the thumbnail.
        source = item.get("thumbnail_url") if media_type == "VIDEO" else item.get("media_url")
        # Media URLs are signed and change on every request, so name files by post id.
        post_id = str(item["id"])
        posts.append(
            {
                "id": post_id,
                "permalink": str(item.get("permalink", "")),
                "media_type": media_type,
                "image": images.save(source, key=f"post:{post_id}"),
                "caption": item.get("caption"),
                "timestamp": _iso_timestamp(str(item["timestamp"])),
            }
        )
        if len(posts) == limit:
            break
    return posts


def refresh_token(session: requests.Session, token: str) -> str:
    """A refreshed long-lived token, or the current one if Instagram won't refresh it yet."""
    try:
        response = get(
            session,
            f"{API}/refresh_access_token",
            params={"grant_type": "ig_refresh_token", "access_token": token},
        )
    except requests.RequestException as error:
        # Tokens under 24 hours old can't be refreshed; the current one still works.
        log.warning("instagram: token not refreshed (%s)", type(error).__name__)
        return token
    return str(response.json().get("access_token") or token)


def _run(command: Sequence[str], stdin: str, env: dict[str, str]) -> int:
    return subprocess.run(command, input=stdin, text=True, env=env, check=False).returncode


def store_token(new_token: str, old_token: str, run: CommandRunner = _run) -> bool:
    """
    Saves a changed token to the INSTAGRAM_TOKEN secret with the GitHub CLI.
    The token goes in on stdin, never on the command line. Returns whether the
    secret was updated.
    """
    if new_token == old_token:
        return False
    secrets_token = os.environ.get("GH_SECRETS_TOKEN", "").strip()
    repository = os.environ.get("GITHUB_REPOSITORY", "").strip()
    if not secrets_token or not repository:
        log.warning(
            "instagram: token refreshed but not saved (GH_SECRETS_TOKEN or GITHUB_REPOSITORY "
            "missing); update INSTAGRAM_TOKEN by hand before it expires"
        )
        return False
    env = {**os.environ, "GH_TOKEN": secrets_token}
    command = ["gh", "secret", "set", "INSTAGRAM_TOKEN", "--repo", repository]
    if run(command, new_token, env) != 0:
        log.warning("instagram: could not update the INSTAGRAM_TOKEN secret")
        return False
    log.info("instagram: INSTAGRAM_TOKEN secret updated")
    return True


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    token = require_env("INSTAGRAM_TOKEN")
    fresh = refresh_token(session, token)
    if os.environ.get("GITHUB_ACTIONS") == "true" and fresh != token:
        print(f"::add-mask::{fresh}", flush=True)
    store_token(fresh, token)

    data: JsonObject = get(
        session,
        f"{API}/me/media",
        params={"fields": MEDIA_FIELDS, "limit": "12", "access_token": fresh},
    ).json()
    posts = parse_media(data, images)
    feed: InstagramFeed = {"fetched_at": utc_now(), "posts": posts}
    return FeedResult(feed, f"{len(posts)} posts")
