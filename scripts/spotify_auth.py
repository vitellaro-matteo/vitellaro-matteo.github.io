"""
One-time helper: run Spotify's authorization code flow in the browser and print
the refresh token for SPOTIFY_REFRESH_TOKEN, plus the scopes Spotify granted.

    python -m scripts.spotify_auth [--client-id ID] [--redirect-uri URI]

The client id comes from --client-id or SPOTIFY_CLIENT_ID, the client secret from
SPOTIFY_CLIENT_SECRET or a hidden prompt. Only the token and scopes go to stdout;
everything else goes to stderr.
"""

from __future__ import annotations

import argparse
import base64
import getpass
import json
import os
import secrets
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
TOKEN_URL = "https://accounts.spotify.com/api/token"
# The URI WeeklySpotifyUpdate's weekly.py uses, so both repos can share one Spotify app.
DEFAULT_REDIRECT_URI = "http://127.0.0.1:8888/callback"
SCOPES = "playlist-read-private playlist-read-collaborative"
WAIT_SECONDS = 300
TIMEOUT_SECONDS = 15
# Spotify only accepts plain http for loopback IP literals, never for "localhost".
_LOOPBACK_HOSTS = ("127.0.0.1", "::1")


class AuthError(Exception):
    """A failure the user can fix; the message says how."""


def listen_address(redirect_uri: str) -> tuple[str, int]:
    """The host and port the local callback server must listen on."""
    url = urllib.parse.urlsplit(redirect_uri)
    if url.scheme != "http" or url.hostname not in _LOOPBACK_HOSTS:
        raise AuthError(
            f"{redirect_uri} can't be served by this script: it needs an http URI on "
            "127.0.0.1 or [::1], such as http://127.0.0.1:8888/callback. "
            "Spotify rejects localhost."
        )
    return url.hostname, url.port or 80


def build_authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": SCOPES,
            "state": state,
            "show_dialog": "true",
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


def parse_callback(request_path: str, redirect_uri: str, state: str) -> str | None:
    """
    The authorization code from a request to the redirect URI, or None when the
    request is for some other path (browsers also ask for /favicon.ico).
    """
    request = urllib.parse.urlsplit(request_path)
    if request.path != (urllib.parse.urlsplit(redirect_uri).path or "/"):
        return None
    query = urllib.parse.parse_qs(request.query)
    if "error" in query:
        raise AuthError(f"Spotify did not authorize the app: {query['error'][0]}.")
    if query.get("state") != [state]:
        raise AuthError("The callback's state doesn't match this run; start the script again.")
    codes = query.get("code")
    if not codes:
        raise AuthError("The callback carried no authorization code.")
    return codes[0]


def registration_hint(redirect_uri: str) -> str:
    return (
        "This exact redirect URI must be registered for the app in the Spotify dashboard:\n"
        f"    {redirect_uri}\n"
        "Dashboard -> your app -> Settings -> Edit -> Redirect URIs: paste it, click Add, "
        "then click Save at the bottom of the page."
    )


class _CallbackServer(HTTPServer):
    def __init__(self, redirect_uri: str, state: str) -> None:
        host, port = listen_address(redirect_uri)
        if ":" in host:
            self.address_family = socket.AF_INET6
        super().__init__((host, port), _CallbackHandler)
        self.redirect_uri = redirect_uri
        self.state = state
        self.code: str | None = None
        self.error: AuthError | None = None


class _CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        server = self.server
        assert isinstance(server, _CallbackServer)
        try:
            code = parse_callback(self.path, server.redirect_uri, server.state)
        except AuthError as err:
            server.error = err
            self._reply(400, f"{err}\nSee the terminal for details.")
            return
        if code is None:
            self._reply(404, "Not found.")
            return
        server.code = code
        self._reply(200, "Done. You can close this tab and go back to the terminal.")

    def _reply(self, status: int, message: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(message.encode())

    def log_message(self, format: str, *args: object) -> None:
        """Silenced: request lines would echo the authorization code to the terminal."""


def wait_for_code(client_id: str, redirect_uri: str) -> str:
    state = secrets.token_urlsafe(16)
    try:
        server = _CallbackServer(redirect_uri, state)
    except OSError as err:
        raise AuthError(f"Can't listen for the callback on {redirect_uri}: {err}.") from err

    url = build_authorize_url(client_id, redirect_uri, state)
    print(f"Waiting for Spotify to redirect to {redirect_uri}", file=sys.stderr)
    print(f"If no browser opens, visit:\n{url}\n", file=sys.stderr)
    webbrowser.open(url)

    server.timeout = 1
    deadline = time.monotonic() + WAIT_SECONDS
    with server:
        while server.code is None and server.error is None:
            if time.monotonic() > deadline:
                raise AuthError(
                    f"No callback within {WAIT_SECONDS // 60} minutes. If Spotify showed "
                    '"redirect_uri: Not matching configuration" or "Invalid redirect URI", '
                    "the URI isn't registered."
                )
            server.handle_request()
    if server.error is not None:
        raise server.error
    assert server.code is not None
    return server.code


def exchange_code(
    client_id: str, client_secret: str, code: str, redirect_uri: str
) -> dict[str, str]:
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    body = urllib.parse.urlencode(
        {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri}
    ).encode()
    request = urllib.request.Request(
        TOKEN_URL,
        data=body,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            tokens = json.load(response)
    except urllib.error.HTTPError as err:
        raise AuthError(f"Token exchange failed ({err.code}): {_spotify_error(err)}.") from err
    except urllib.error.URLError as err:
        raise AuthError(f"Can't reach Spotify: {err.reason}.") from err
    if not isinstance(tokens, dict) or not isinstance(tokens.get("refresh_token"), str):
        raise AuthError("Spotify's token response had no refresh token.")
    return {"refresh_token": tokens["refresh_token"], "scope": str(tokens.get("scope", ""))}


def _spotify_error(err: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(err.read())
    except ValueError:
        return err.reason
    if isinstance(payload, dict):
        return str(payload.get("error_description") or payload.get("error") or err.reason)
    return err.reason


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.spotify_auth",
        description="Get a Spotify refresh token for SPOTIFY_REFRESH_TOKEN.",
    )
    parser.add_argument(
        "--client-id",
        default=os.environ.get("SPOTIFY_CLIENT_ID"),
        help="the app's client id (default: $SPOTIFY_CLIENT_ID)",
    )
    parser.add_argument(
        "--redirect-uri",
        default=DEFAULT_REDIRECT_URI,
        help=f"a redirect URI registered for the app (default: {DEFAULT_REDIRECT_URI})",
    )
    args = parser.parse_args(argv)
    client_id: str | None = args.client_id
    redirect_uri: str = args.redirect_uri
    if not client_id:
        parser.error("pass --client-id or set SPOTIFY_CLIENT_ID")
    try:
        listen_address(redirect_uri)
    except AuthError as err:
        parser.error(str(err))

    try:
        client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET") or getpass.getpass(
            "Spotify client secret (input hidden): "
        )
        if not client_secret:
            raise AuthError("No client secret given.")
        code = wait_for_code(client_id, redirect_uri)
        tokens = exchange_code(client_id, client_secret, code, redirect_uri)
    except AuthError as err:
        print(f"error: {err}\n\n{registration_hint(redirect_uri)}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        return 130

    missing = set(SCOPES.split()) - set(tokens["scope"].split())
    if missing:
        print(f"warning: not granted: {' '.join(sorted(missing))}", file=sys.stderr)
    print(f"SPOTIFY_REFRESH_TOKEN={tokens['refresh_token']}")
    print(f"scopes: {tokens['scope'] or '(none listed)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
