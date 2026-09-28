from __future__ import annotations

from collections.abc import Sequence

import pytest

from scripts.instagram import parse_media, store_token
from tests.conftest import FakeImages, fixture_json


def test_keeps_the_latest_six_posts(images: FakeImages) -> None:
    posts = parse_media(fixture_json("instagram_media.json"), images)
    assert len(posts) == 6
    assert posts[0]["permalink"] == "https://www.instagram.com/p/AAAAAAAAAA1/"


def test_uses_the_thumbnail_for_videos(images: FakeImages) -> None:
    parse_media(fixture_json("instagram_media.json"), images)
    assert images.saved[1][0].startswith("https://scontent.cdninstagram.com/v/t51/2-thumb.jpg")


def test_names_images_by_post_id_since_urls_are_signed(images: FakeImages) -> None:
    parse_media(fixture_json("instagram_media.json"), images)
    assert images.saved[0][1] == "post:18000000000000001"


def test_normalises_timestamps_to_utc(images: FakeImages) -> None:
    posts = parse_media(fixture_json("instagram_media.json"), images)
    assert posts[0]["timestamp"] == "2026-09-27T07:41:13Z"
    assert posts[2]["timestamp"] == "2026-09-22T09:20:00Z"  # from +0200


def test_missing_caption_is_none(images: FakeImages) -> None:
    posts = parse_media(fixture_json("instagram_media.json"), images)
    assert posts[1]["caption"] is None


class RecordingRunner:
    def __init__(self, returncode: int = 0) -> None:
        self.returncode = returncode
        self.calls: list[tuple[list[str], str, dict[str, str]]] = []

    def __call__(self, command: Sequence[str], stdin: str, env: dict[str, str]) -> int:
        self.calls.append((list(command), stdin, env))
        return self.returncode


def test_stores_a_changed_token_through_stdin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GH_SECRETS_TOKEN", "github_pat_secret")
    monkeypatch.setenv("GITHUB_REPOSITORY", "example/example.github.io")
    run = RecordingRunner()

    assert store_token("new-token", "old-token", run) is True
    [(command, stdin, env)] = run.calls
    assert command == [
        "gh",
        "secret",
        "set",
        "INSTAGRAM_TOKEN",
        "--repo",
        "example/example.github.io",
    ]
    assert stdin == "new-token"
    assert "new-token" not in command
    assert env["GH_TOKEN"] == "github_pat_secret"


def test_does_nothing_when_the_token_is_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GH_SECRETS_TOKEN", "github_pat_secret")
    monkeypatch.setenv("GITHUB_REPOSITORY", "example/example.github.io")
    run = RecordingRunner()
    assert store_token("same", "same", run) is False
    assert run.calls == []


def test_skips_the_update_without_a_secrets_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GH_SECRETS_TOKEN", raising=False)
    monkeypatch.setenv("GITHUB_REPOSITORY", "example/example.github.io")
    run = RecordingRunner()
    assert store_token("new-token", "old-token", run) is False
    assert run.calls == []


def test_reports_a_failed_update(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GH_SECRETS_TOKEN", "github_pat_secret")
    monkeypatch.setenv("GITHUB_REPOSITORY", "example/example.github.io")
    assert store_token("new-token", "old-token", RecordingRunner(returncode=1)) is False
