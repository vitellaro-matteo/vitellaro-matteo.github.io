from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
import requests

from scripts.common import FeedResult, ImageSaver, SkipFetcher
from scripts.fetch_all import Fetcher, main


def working(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    return FeedResult({"fetched_at": "now", "items": [1, 2]}, "2 items")


def broken(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    raise requests.HTTPError("503 Server Error for url: https://x.test/?access_token=abc123")


def unconfigured(
    session: requests.Session, config: dict[str, str], images: ImageSaver
) -> FeedResult:
    raise SkipFetcher("SPOTIFY_CLIENT_ID is not set")


@pytest.fixture
def dirs(tmp_path: Path) -> tuple[Path, Path]:
    return tmp_path / "live", tmp_path / "media"


def test_keeps_going_when_one_fetcher_raises(
    dirs: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    live, media = dirs
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    fetchers = [
        Fetcher("first", broken),
        Fetcher("second", working),
        Fetcher("third", unconfigured),
    ]

    assert main(fetchers, live, media, config={}) == 0

    assert json.loads((live / "second.json").read_text(encoding="utf-8"))["items"] == [1, 2]
    assert not (live / "first.json").exists()
    table = summary.read_text(encoding="utf-8")
    assert "| second | updated | 2 items | fresh data |" in table
    assert "| first | failed |" in table
    assert "| third | skipped | SPOTIFY_CLIENT_ID is not set | card hidden |" in table


def test_failures_keep_the_previous_output(dirs: tuple[Path, Path], tmp_path: Path) -> None:
    live, media = dirs
    live.mkdir()
    cached = live / "first.json"
    cached.write_text('{"from": "cache"}', encoding="utf-8")

    main([Fetcher("first", broken), Fetcher("second", working)], live, media, config={})

    assert json.loads(cached.read_text(encoding="utf-8")) == {"from": "cache"}


def test_summary_notes_the_cached_copy(
    dirs: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    live, media = dirs
    live.mkdir()
    (live / "first.json").write_text("{}", encoding="utf-8")
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))

    main([Fetcher("first", broken), Fetcher("second", working)], live, media, config={})

    assert "last good copy (cache)" in summary.read_text(encoding="utf-8")


def test_never_logs_tokens_from_failed_urls(
    dirs: tuple[Path, Path], capsys: pytest.CaptureFixture[str], caplog: pytest.LogCaptureFixture
) -> None:
    live, media = dirs
    main([Fetcher("first", broken), Fetcher("second", working)], live, media, config={})
    output = capsys.readouterr().out + caplog.text
    assert "abc123" not in output
    assert "access_token=***" in output


def test_fails_only_when_nothing_updated(
    dirs: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    live, media = dirs
    fetchers = [Fetcher("first", broken), Fetcher("second", unconfigured)]
    assert main(fetchers, live, media, config={}) == 1


def crashing(session: requests.Session, config: dict[str, str], images: ImageSaver) -> FeedResult:
    entry = "a string where a dict was expected"
    return FeedResult({"value": entry.get("id")}, "never")  # type: ignore[attr-defined]


def test_unexpected_errors_are_traced_to_file_and_line(
    dirs: tuple[Path, Path],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    live, media = dirs
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))

    main([Fetcher("crashy", crashing), Fetcher("second", working)], live, media, config={})

    text = summary.read_text(encoding="utf-8")
    assert "| crashy | failed | AttributeError: 'str' object has no attribute 'get' |" in text
    assert "<details><summary>crashy: traceback</summary>" in text
    assert re.search(r'tests[\\/]test_fetch_all\.py", line \d+, in crashing', text)
    assert "in crashing" in text
    assert "Traceback (most recent call last)" in caplog.text
    assert "in crashing" in caplog.text
