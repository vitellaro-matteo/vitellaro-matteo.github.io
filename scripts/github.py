"""GitHub: the last 30 weeks of contributions and the latest public pushes."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import NamedTuple, TypedDict

import requests

from scripts.common import (
    TIMEOUT_SECONDS,
    FeedResult,
    ImageSaver,
    JsonObject,
    get,
    require_env,
    utc_now,
)
from scripts.site_config import require_setting

API = "https://api.github.com"
WEEKS = 30
PUSHES = 3

CALENDAR_QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}
"""


class Day(TypedDict):
    date: str
    count: int


class Week(TypedDict):
    days: list[Day]


class Calendar(TypedDict):
    total: int
    weeks: list[Week]


class Push(TypedDict):
    repo: str
    url: str
    message: str
    time: str


class GithubFeed(TypedDict):
    fetched_at: str
    calendar: Calendar
    pushes: list[Push]


class PushEvent(NamedTuple):
    repo: str
    head: str
    time: str
    message: str | None


def calendar_start(today: date, weeks: int = WEEKS) -> date:
    """The Sunday that starts the calendar: the current week plus the weeks before it."""
    this_sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    return this_sunday - timedelta(weeks=weeks - 1)


def parse_calendar(data: JsonObject, weeks: int = WEEKS) -> Calendar:
    if data.get("errors"):
        raise ValueError(f"GraphQL errors: {data['errors']}")
    calendar = data["data"]["user"]["contributionsCollection"]["contributionCalendar"]
    parsed: list[Week] = [
        {
            "days": [
                {"date": d["date"], "count": int(d["contributionCount"])}
                for d in w["contributionDays"]
            ]
        }
        for w in calendar["weeks"]
    ]
    return {"total": int(calendar["totalContributions"]), "weeks": parsed[-weeks:]}


def select_pushes(events: list[JsonObject], limit: int = PUSHES) -> list[PushEvent]:
    """The latest push to each of the most recently pushed repositories."""
    pushes: list[PushEvent] = []
    seen: set[str] = set()
    # The API lists events roughly, not strictly, newest first; ISO timestamps sort as text.
    for event in sorted(events, key=lambda e: str(e.get("created_at", "")), reverse=True):
        repo = str((event.get("repo") or {}).get("name", ""))
        if event.get("type") != "PushEvent" or not repo or repo in seen:
            continue
        payload = event.get("payload") or {}
        # The Events API stopped including commits in October 2025; older
        # payloads still carry them, newer ones need a lookup by `head`.
        commits = payload.get("commits") or []
        message = str(commits[-1]["message"]) if commits else None
        pushes.append(
            PushEvent(repo, str(payload.get("head", "")), str(event["created_at"]), message)
        )
        seen.add(repo)
        if len(pushes) == limit:
            break
    return pushes


def first_line(message: str) -> str:
    return message.strip().splitlines()[0] if message.strip() else ""


def _commit_message(session: requests.Session, push: PushEvent, headers: dict[str, str]) -> str:
    if push.message is not None or not push.head:
        return push.message or ""
    commit: JsonObject = get(
        session, f"{API}/repos/{push.repo}/commits/{push.head}", headers=headers
    ).json()
    return str(commit["commit"]["message"])


def fetch(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    login = require_setting(config, "githubUsername")
    token = require_env("GH_STATS_TOKEN")
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    now = datetime.now(timezone.utc)
    start = datetime.combine(calendar_start(now.date()), datetime.min.time(), timezone.utc)
    response = session.post(
        f"{API}/graphql",
        json={
            "query": CALENDAR_QUERY,
            "variables": {"login": login, "from": start.isoformat(), "to": now.isoformat()},
        },
        headers=headers,
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    calendar = parse_calendar(response.json())

    events = get(
        session, f"{API}/users/{login}/events/public", params={"per_page": "100"}, headers=headers
    )
    pushes: list[Push] = [
        {
            "repo": push.repo.split("/", 1)[-1],
            "url": f"https://github.com/{push.repo}",
            "message": first_line(_commit_message(session, push, headers)),
            "time": push.time,
        }
        for push in select_pushes(events.json())
    ]

    feed: GithubFeed = {"fetched_at": utc_now(), "calendar": calendar, "pushes": pushes}
    return FeedResult(feed, f"{calendar['total']} contributions, {len(pushes)} pushes")
