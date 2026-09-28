from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Any

import pytest
import requests

from scripts.common import MediaStore, require_env
from scripts.fetch_all import Fetcher, run_fetcher, summary_table
from scripts.spotify import (
    SpotifyAuthError,
    access_token,
    api_error_message,
    credential_warnings,
    fetch,
    parse_token_error,
    run_check,
)
from tests.conftest import fixture_text

CLIENT_ID = "0123456789abcdef0123456789abcdef"
SECRET = "fedcba9876543210fedcba9876543210"
REFRESH = "AQ" + "r" * 130
ACCESS = "BQ" + "a" * 100
PLAYLIST = "37i9dQZF1DXexample"


class SpotifyStub(requests.Session):
    """Answers Spotify URLs with canned responses and keeps every prepared request."""

    def __init__(self, token: tuple[int, str], playlist: tuple[int, str] | None = None) -> None:
        super().__init__()
        self.token = token
        self.playlist = playlist or (200, '{"total": 12, "items": [], "next": null}')
        self.sent: list[requests.PreparedRequest] = []

    def send(self, request: requests.PreparedRequest, **kwargs: Any) -> requests.Response:  # noqa: ANN401
        self.sent.append(request)
        status, body = self.token if "accounts.spotify.com" in str(request.url) else self.playlist
        response = requests.Response()
        response.status_code = status
        response._content = body.encode()
        response.headers["Content-Type"] = "application/json"
        response.url = str(request.url)
        response.request = request
        return response


def ok_token() -> tuple[int, str]:
    return 200, f'{{"access_token": "{ACCESS}", "token_type": "Bearer", "expires_in": 3600}}'


# ---------- error parsing and hints ----------


def test_invalid_client_points_at_the_client_id_or_rotated_secret() -> None:
    error = parse_token_error(400, fixture_text("spotify_token_invalid_client.json"))
    assert error.error == "invalid_client"
    assert error.description == "Invalid client secret"
    assert "secret was rotated" in error.hint
    assert str(error) == (
        "token refresh failed (HTTP 400): invalid_client: Invalid client secret. "
        f"Hint: {error.hint}"
    )


def test_invalid_grant_points_at_the_refresh_token() -> None:
    error = parse_token_error(400, fixture_text("spotify_token_invalid_grant.json"))
    assert error.error == "invalid_grant"
    assert "revoked, has expired, or was issued for a different client ID" in error.hint


def test_other_errors_show_spotifys_description_as_is() -> None:
    error = parse_token_error(400, fixture_text("spotify_token_invalid_request.json"))
    assert error.hint == "refresh_token must be supplied"
    assert "Hint" not in str(error)


def test_non_json_bodies_are_summarised_not_echoed() -> None:
    error = parse_token_error(502, "<html><body>Bad gateway, trace id 123</body></html>")
    assert error.error == "unknown_error"
    assert "<html>" not in str(error)


def test_reads_web_api_error_messages() -> None:
    message = api_error_message(fixture_text("spotify_api_error_403.json"))
    assert message.startswith("Check settings on developer.spotify.com/dashboard")
    assert api_error_message("not json") == "no message in the response"


# ---------- the token request itself ----------


def test_refresh_request_matches_spotifys_documented_shape() -> None:
    session = SpotifyStub(ok_token())
    assert access_token(session, CLIENT_ID, SECRET, REFRESH) == ACCESS

    [request] = session.sent
    assert request.method == "POST"
    assert request.url == "https://accounts.spotify.com/api/token"
    assert request.headers["Content-Type"] == "application/x-www-form-urlencoded"
    expected = base64.b64encode(f"{CLIENT_ID}:{SECRET}".encode()).decode()
    assert request.headers["Authorization"] == f"Basic {expected}"
    assert request.body == f"grant_type=refresh_token&refresh_token={REFRESH}"


def test_failed_refresh_raises_with_spotifys_error_and_no_credentials() -> None:
    session = SpotifyStub((400, fixture_text("spotify_token_invalid_client.json")))
    with pytest.raises(SpotifyAuthError) as caught:
        access_token(session, CLIENT_ID, SECRET, REFRESH)
    message = str(caught.value)
    assert "invalid_client" in message
    for value in (CLIENT_ID, SECRET, REFRESH):
        assert value not in message


def test_step_summary_and_log_show_the_error_and_hint(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", SECRET)
    monkeypatch.setenv("SPOTIFY_REFRESH_TOKEN", REFRESH)
    session = SpotifyStub((400, fixture_text("spotify_token_invalid_grant.json")))
    config = {"spotifyPlaylistId": PLAYLIST}

    with caplog.at_level(logging.INFO, logger="fetchers"):
        outcome = run_fetcher(
            Fetcher("spotify", fetch), session, config, tmp_path / "live", tmp_path / "media"
        )

    assert outcome.status == "failed"
    table = summary_table([outcome])
    assert "invalid_grant: Invalid refresh token" in table
    assert "issued for a different client ID" in table
    assert "spotify: hint: the refresh token was revoked" in caplog.text
    for value in (CLIENT_ID, SECRET, REFRESH):
        assert value not in table
        assert value not in caplog.text


def test_fetch_reports_playlist_errors_with_spotifys_message(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", SECRET)
    monkeypatch.setenv("SPOTIFY_REFRESH_TOKEN", REFRESH)
    session = SpotifyStub(ok_token(), (403, fixture_text("spotify_api_error_403.json")))
    media = MediaStore("spotify", session, tmp_path)

    with pytest.raises(Exception, match=r"HTTP 403\): Check settings.*Hint: this Spotify account"):
        fetch(session, {"spotifyPlaylistId": PLAYLIST}, media)


# ---------- credential shape checks ----------


def test_well_formed_credentials_raise_no_warnings() -> None:
    assert credential_warnings("SPOTIFY_CLIENT_ID", CLIENT_ID) == []
    assert credential_warnings("SPOTIFY_CLIENT_SECRET", SECRET) == []
    assert credential_warnings("SPOTIFY_REFRESH_TOKEN", REFRESH) == []


@pytest.mark.parametrize(
    ("name", "value", "expected"),
    [
        ("SPOTIFY_CLIENT_ID", "not-a-client-id", "32 lowercase hex"),
        ("SPOTIFY_CLIENT_SECRET", SECRET[:16] + " " + SECRET[16:], "spaces or line breaks"),
        ("SPOTIFY_REFRESH_TOKEN", '{"refresh_token": "AQxyz"}', "whole .spotify_cache file"),
        ("SPOTIFY_REFRESH_TOKEN", ACCESS, "access token, not a refresh token"),
        ("SPOTIFY_REFRESH_TOKEN", "AQshort", "shorter than"),
    ],
)
def test_suspicious_credentials_are_described_without_their_value(
    name: str, value: str, expected: str
) -> None:
    warnings = credential_warnings(name, value)
    assert any(expected in warning for warning in warnings)
    assert all(value not in warning for warning in warnings)


def test_require_env_strips_pasted_newlines_and_says_so(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", f"{SECRET}\n")
    with caplog.at_level(logging.WARNING, logger="fetchers"):
        assert require_env("SPOTIFY_CLIENT_SECRET") == SECRET
    assert "SPOTIFY_CLIENT_SECRET had leading or trailing whitespace" in caplog.text
    assert SECRET not in caplog.text


# ---------- python -m scripts.spotify --check ----------


def run(session: SpotifyStub, prompt_answers: dict[str, str] | None = None) -> tuple[bool, str]:
    lines: list[str] = []
    answers = prompt_answers or {}

    def prompt(text: str) -> str:
        return next(value for name, value in answers.items() if text.startswith(name))

    ok = run_check(session, PLAYLIST, prompt=prompt, say=lines.append)
    return ok, "\n".join(lines)


def test_check_reports_ok_without_printing_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", f" {SECRET}\n")
    monkeypatch.setenv("SPOTIFY_REFRESH_TOKEN", REFRESH)

    ok, output = run(SpotifyStub(ok_token()))

    assert ok
    assert "token refresh: OK" in output
    assert "playlist read: OK (12 items)" in output
    assert "SPOTIFY_CLIENT_SECRET: from the environment (surrounding whitespace stripped)" in output
    for value in (CLIENT_ID, SECRET, REFRESH, ACCESS):
        assert value not in output


def test_check_prints_spotifys_error_and_hint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", CLIENT_ID)
    monkeypatch.delenv("SPOTIFY_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("SPOTIFY_REFRESH_TOKEN", raising=False)
    session = SpotifyStub((400, fixture_text("spotify_token_invalid_client.json")))

    ok, output = run(session, {"SPOTIFY_CLIENT_SECRET": SECRET, "SPOTIFY_REFRESH_TOKEN": REFRESH})

    assert not ok
    assert "SPOTIFY_CLIENT_SECRET: entered at the prompt" in output
    assert "token refresh: failed" in output
    assert "  error: invalid_client" in output
    assert "  description: Invalid client secret" in output
    assert "  hint: the client ID or secret is wrong" in output
    assert "playlist read" not in output
    for value in (CLIENT_ID, SECRET, REFRESH):
        assert value not in output


def test_check_reports_a_failed_playlist_read(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", SECRET)
    monkeypatch.setenv("SPOTIFY_REFRESH_TOKEN", REFRESH)

    ok, output = run(SpotifyStub(ok_token(), (403, fixture_text("spotify_api_error_403.json"))))

    assert not ok
    assert "token refresh: OK" in output
    assert "playlist read: failed (HTTP 403)" in output
    assert "hint: this Spotify account may not use the app" in output
