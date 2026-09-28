from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


class FakeImages:
    """Records image requests instead of downloading anything."""

    def __init__(self) -> None:
        self.saved: list[tuple[str, str | None]] = []

    def save(self, url: str | None, key: str | None = None) -> str | None:
        if not url:
            return None
        self.saved.append((url, key))
        return f"/media/feeds/test/{len(self.saved)}.jpg"


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def fixture_json(name: str) -> Any:  # noqa: ANN401 — decoded JSON of any shape
    return json.loads(fixture_text(name))


@pytest.fixture
def images() -> FakeImages:
    return FakeImages()
