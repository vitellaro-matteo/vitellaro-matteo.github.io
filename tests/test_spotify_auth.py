from __future__ import annotations

import urllib.parse

import pytest

from scripts.spotify_auth import (
    DEFAULT_REDIRECT_URI,
    AuthError,
    build_authorize_url,
    listen_address,
    parse_callback,
)


def test_authorize_url_carries_every_parameter() -> None:
    url = urllib.parse.urlsplit(build_authorize_url("abc123", DEFAULT_REDIRECT_URI, "s1"))

    assert f"{url.scheme}://{url.netloc}{url.path}" == "https://accounts.spotify.com/authorize"
    assert urllib.parse.parse_qs(url.query) == {
        "client_id": ["abc123"],
        "response_type": ["code"],
        "redirect_uri": ["http://127.0.0.1:8888/callback"],
        "scope": ["playlist-read-private playlist-read-collaborative"],
        "state": ["s1"],
        "show_dialog": ["true"],
    }


def test_listens_on_the_redirect_uris_host_and_port() -> None:
    assert listen_address("http://127.0.0.1:8888/callback") == ("127.0.0.1", 8888)
    assert listen_address("http://[::1]:9090/cb") == ("::1", 9090)
    assert listen_address("http://127.0.0.1/callback") == ("127.0.0.1", 80)


@pytest.mark.parametrize(
    "uri", ["http://localhost:8888/callback", "https://127.0.0.1:8888/callback"]
)
def test_rejects_uris_spotify_or_the_server_cant_use(uri: str) -> None:
    with pytest.raises(AuthError, match=r"127\.0\.0\.1"):
        listen_address(uri)


def test_parses_the_code_from_the_callback() -> None:
    assert parse_callback("/callback?code=xyz&state=s1", DEFAULT_REDIRECT_URI, "s1") == "xyz"


def test_ignores_other_paths() -> None:
    assert parse_callback("/favicon.ico", DEFAULT_REDIRECT_URI, "s1") is None


@pytest.mark.parametrize(
    ("path", "message"),
    [
        ("/callback?error=access_denied&state=s1", "access_denied"),
        ("/callback?code=xyz&state=other", "state"),
        ("/callback?code=xyz", "state"),
        ("/callback?state=s1", "no authorization code"),
    ],
)
def test_rejects_bad_callbacks(path: str, message: str) -> None:
    with pytest.raises(AuthError, match=message):
        parse_callback(path, DEFAULT_REDIRECT_URI, "s1")
