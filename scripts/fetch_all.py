"""
Runs every fetcher and writes each feed to src/data/live/<name>.json.

A fetcher that fails or is skipped leaves its previous output in place (the
deploy workflow restores the last good feeds from the Actions cache first), so
one broken source never takes the others down. Exits 0 if at least one fetcher
succeeded.
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import requests

from scripts import github, goodreads, instagram, letterboxd, spotify
from scripts.common import (
    LIVE_DIR,
    MEDIA_DIR,
    FeedResult,
    ImageSaver,
    MediaStore,
    SkipFetcher,
    http_session,
    log,
    redact,
    write_json,
)
from scripts.site_config import load_site_config

FetchFunction = Callable[[requests.Session, dict[str, str], ImageSaver], FeedResult]
Status = Literal["updated", "skipped", "failed"]


@dataclass(frozen=True)
class Fetcher:
    name: str
    fetch: FetchFunction


@dataclass(frozen=True)
class Outcome:
    name: str
    status: Status
    detail: str
    has_output: bool


FETCHERS: tuple[Fetcher, ...] = (
    Fetcher("spotify", spotify.fetch),
    Fetcher("letterboxd", letterboxd.fetch),
    Fetcher("goodreads", goodreads.fetch),
    Fetcher("instagram", instagram.fetch),
    Fetcher("github", github.fetch),
)


def run_fetcher(
    fetcher: Fetcher,
    session: requests.Session,
    config: dict[str, str],
    live_dir: Path,
    media_dir: Path,
) -> Outcome:
    output = live_dir / f"{fetcher.name}.json"
    media = MediaStore(fetcher.name, session, media_dir)
    try:
        result = fetcher.fetch(session, config, media)
    except SkipFetcher as reason:
        log.warning("%s: skipped, %s", fetcher.name, reason)
        return Outcome(fetcher.name, "skipped", str(reason), output.exists())
    # Any error in one source must not stop the others; it is reported instead.
    except Exception as error:  # noqa: BLE001
        detail = redact(f"{type(error).__name__}: {error}")
        log.error("%s: failed, %s", fetcher.name, detail)
        return Outcome(fetcher.name, "failed", detail, output.exists())

    write_json(output, result.data)
    media.prune()
    log.info("%s: updated, %s", fetcher.name, result.detail)
    return Outcome(fetcher.name, "updated", result.detail, True)


def summary_table(outcomes: Sequence[Outcome]) -> str:
    rows = [
        "| Feed | Result | Details | On the site |",
        "| --- | --- | --- | --- |",
    ]
    for outcome in outcomes:
        if outcome.status == "updated":
            shown = "fresh data"
        elif outcome.has_output:
            shown = "last good copy (cache)"
        else:
            shown = "card hidden"
        detail = outcome.detail.replace("|", "\\|")
        rows.append(f"| {outcome.name} | {outcome.status} | {detail} | {shown} |")
    return "\n".join(rows)


def main(
    fetchers: Sequence[Fetcher] = FETCHERS,
    live_dir: Path = LIVE_DIR,
    media_dir: Path = MEDIA_DIR,
    config: dict[str, str] | None = None,
) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    session = http_session()
    site_config = config if config is not None else load_site_config()
    outcomes = [run_fetcher(f, session, site_config, live_dir, media_dir) for f in fetchers]

    table = summary_table(outcomes)
    print(table)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(f"## Feeds\n\n{table}\n")

    return 0 if any(outcome.status == "updated" for outcome in outcomes) else 1


if __name__ == "__main__":
    sys.exit(main())
