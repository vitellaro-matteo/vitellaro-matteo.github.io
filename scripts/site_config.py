"""
Reads usernames and ids from site.config.ts, so every site value keeps living in
that one file. Only the plain `key: 'value'` string entries are read.
"""

from __future__ import annotations

import re
from pathlib import Path

from scripts.common import ROOT, SkipFetcher

CONFIG_PATH = ROOT / "site.config.ts"

_ENTRY = re.compile(r"^\s*(\w+):\s*'([^'\n]*)',?\s*$", re.MULTILINE)
# Values still in CAPITALS (e.g. 'SPOTIFY_PLAYLIST_ID') are unfilled placeholders;
# an all-digit value such as a Goodreads id is real.
_PLACEHOLDER = re.compile(r"^(?=.*[A-Z])[A-Z0-9_]+$")


def parse_site_config(source: str) -> dict[str, str]:
    return {key: value for key, value in _ENTRY.findall(source)}


def load_site_config(path: Path = CONFIG_PATH) -> dict[str, str]:
    return parse_site_config(path.read_text(encoding="utf-8"))


def require_setting(config: dict[str, str], key: str) -> str:
    """A filled-in value from site.config.ts, or skip the fetcher that needs it."""
    value = config.get(key, "").strip()
    if not value or _PLACEHOLDER.match(value):
        raise SkipFetcher(f"{key} is not set in site.config.ts")
    return value
