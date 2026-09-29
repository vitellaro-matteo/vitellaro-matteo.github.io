from __future__ import annotations

import json
from pathlib import Path

import pytest
import requests

from scripts.common import MediaStore, SkipFetcher, redact, require_env, write_json
from scripts.site_config import parse_site_config, require_setting


class FakeResponse(requests.Response):
    def __init__(self, body: bytes, content_type: str, status: int = 200) -> None:
        super().__init__()
        self._content = body
        self.status_code = status
        self.headers["Content-Type"] = content_type


class FakeSession(requests.Session):
    """Serves canned responses by URL and counts requests; never touches the network."""

    def __init__(self, responses: dict[str, FakeResponse]) -> None:
        super().__init__()
        self.responses = responses
        self.requested: list[str] = []

    def get(self, url: str | bytes, **kwargs: object) -> requests.Response:
        self.requested.append(str(url))
        return self.responses[str(url)]


def test_media_store_downloads_once_and_prunes(tmp_path: Path) -> None:
    session = FakeSession(
        {
            "https://img.test/a": FakeResponse(b"a", "image/jpeg"),
            "https://img.test/b": FakeResponse(b"b", "image/png; charset=binary"),
        }
    )
    first = MediaStore("films", session, tmp_path)
    path_a = first.save("https://img.test/a")
    path_b = first.save("https://img.test/b", key="poster:b")
    assert path_a is not None
    assert path_a.startswith("/media/feeds/films/")
    assert path_a.endswith(".jpg")
    assert path_b is not None
    assert path_b.endswith(".png")

    # The next run only uses image a: it is not downloaded again, and b is removed.
    second = MediaStore("films", session, tmp_path)
    assert second.save("https://img.test/a") == path_a
    second.prune()
    assert session.requested.count("https://img.test/a") == 1
    assert sorted(p.suffix for p in (tmp_path / "films").iterdir()) == [".jpg"]


def test_media_store_skips_failures_and_non_images(tmp_path: Path) -> None:
    session = FakeSession(
        {
            "https://img.test/missing": FakeResponse(b"", "text/html", status=404),
            "https://img.test/page": FakeResponse(b"<html>", "text/html"),
        }
    )
    store = MediaStore("films", session, tmp_path)
    assert store.save("https://img.test/missing") is None
    assert store.save("https://img.test/page") is None
    assert store.save(None) is None


def test_write_json_is_utf8_and_complete(tmp_path: Path) -> None:
    target = tmp_path / "nested" / "feed.json"
    write_json(target, {"title": "Ćevapi"})
    assert json.loads(target.read_text(encoding="utf-8")) == {"title": "Ćevapi"}
    assert list(target.parent.iterdir()) == [target]


def test_require_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SOME_SECRET", "value")
    assert require_env("SOME_SECRET") == "value"
    monkeypatch.setenv("SOME_SECRET", "  ")
    with pytest.raises(SkipFetcher, match="SOME_SECRET is not set"):
        require_env("SOME_SECRET")


def test_redact_hides_query_credentials() -> None:
    assert redact("GET https://x.test/me?fields=id&access_token=abc") == (
        "GET https://x.test/me?fields=id&access_token=***"
    )


SITE_CONFIG = """
export const site = {
  name: 'matteo',
  heroTitle: 'A quiet shelf for the songs, films, books and small things I keep finding.',
  basePath: '/',
  spotifyPlaylistId: 'SPOTIFY_PLAYLIST_ID',
  goodreadsUserId: '12345678',
  lastfmUsername: 'LASTFM_USERNAME',
};
"""


def test_reads_values_from_site_config() -> None:
    config = parse_site_config(SITE_CONFIG)
    assert config["name"] == "matteo"
    assert config["basePath"] == "/"
    assert require_setting(config, "goodreadsUserId") == "12345678"


def test_placeholders_and_missing_values_skip_the_fetcher() -> None:
    config = parse_site_config(SITE_CONFIG)
    with pytest.raises(SkipFetcher, match="spotifyPlaylistId"):
        require_setting(config, "spotifyPlaylistId")
    with pytest.raises(SkipFetcher, match="lastfmUsername"):
        require_setting(config, "lastfmUsername")
    with pytest.raises(SkipFetcher, match="githubUsername"):
        require_setting(config, "githubUsername")
