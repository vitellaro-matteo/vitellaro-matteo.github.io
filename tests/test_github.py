from __future__ import annotations

from datetime import date

import pytest

from scripts.github import calendar_start, first_line, parse_calendar, select_pushes
from tests.conftest import fixture_json


def test_parses_the_contribution_calendar() -> None:
    calendar = parse_calendar(fixture_json("github_calendar.json"))
    assert calendar["total"] == 17
    assert len(calendar["weeks"]) == 3
    assert calendar["weeks"][0]["days"][1] == {"date": "2026-09-14", "count": 2}
    assert len(calendar["weeks"][-1]["days"]) == 2  # the current, partial week


def test_keeps_only_the_most_recent_weeks() -> None:
    calendar = parse_calendar(fixture_json("github_calendar.json"), weeks=2)
    assert [w["days"][0]["date"] for w in calendar["weeks"]] == ["2026-09-20", "2026-09-27"]


def test_graphql_errors_raise() -> None:
    with pytest.raises(ValueError, match="GraphQL errors"):
        parse_calendar({"errors": [{"message": "Could not resolve to a User"}], "data": None})


def test_calendar_starts_on_a_sunday_a_year_back() -> None:
    start = calendar_start(date(2026, 9, 28))  # a Monday
    assert start.weekday() == 6
    assert start == date(2025, 10, 5)  # 51 full weeks before this one, plus this one
    assert calendar_start(date(2026, 9, 27)) == date(2025, 10, 5)  # Sunday itself
    # GitHub rejects windows longer than a year; the longest one here is 52 weeks.
    assert (date(2026, 10, 3) - calendar_start(date(2026, 10, 3))).days < 365


def test_selects_the_latest_push_per_repository() -> None:
    pushes = select_pushes(fixture_json("github_events.json"))
    assert [p.repo for p in pushes] == [
        "example/example.github.io",
        "example/WeeklySpotifyUpdate",
        "example/dotfiles",
    ]
    assert pushes[0].head == "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
    assert pushes[0].time == "2026-09-27T18:40:12Z"


def test_orders_pushes_by_time_not_by_list_position() -> None:
    events = fixture_json("github_events.json")
    pushes = select_pushes(list(reversed(events)))
    assert [p.repo for p in pushes] == [
        "example/example.github.io",
        "example/WeeklySpotifyUpdate",
        "example/dotfiles",
    ]


def test_uses_commit_messages_when_the_payload_still_has_them() -> None:
    pushes = select_pushes(fixture_json("github_events.json"))
    assert pushes[0].message is None  # post-2025 payload: looked up by head
    assert pushes[1].message is not None
    assert first_line(pushes[1].message) == "Handle empty playlists"


def test_first_line_of_empty_message() -> None:
    assert first_line("  \n") == ""
