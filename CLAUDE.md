# CLAUDE.md

**Read [`docs/DESIGN.md`](docs/DESIGN.md) in full at the start of every session.**
It is the single source of truth for this site ("a slow feed"). Follow its values
exactly. If something isn't covered, reuse the closest existing pattern and ask
before inventing anything new: no new colours, fonts, shadows, radii, animations
or components.

## Git — hard rules

- Never run git add, commit, push, stash, reset, restore, checkout of files, or
  anything else that changes git state. Matteo does all of that himself.
- Never add, remove or change remotes. Never create repos or PRs.
- Read-only git commands (git status, git diff, git log) are fine.
- Never put secrets, tokens or .env files in the repo. `.gitignore` must cover
  `.env`, `node_modules`, `dist`, `.astro` and the feed output paths.
- In the report, never group bracketed paths like [slug].astro as single files;
  list their parent folder instead when the whole folder is one unit.

## Quality bar

This repo is part of Matteo's portfolio and will be read by recruiters and
engineers. Every file should look deliberate:

- No leftover template files, dead code, commented-out code, unused dependencies,
  debug logs, or TODO comments. Open questions go in the report, not the code.
- Small, focused modules with clear names. Shared logic in `src/lib/`, typed, with
  no `any`. TypeScript strict. Python fully type-hinted.
- Comments explain why, never what.
- Accessible, semantic HTML (landmarks, heading order, alt text, real buttons/links).
- All values from `site.config.ts`; every internal link and asset through
  `src/lib/paths.ts`.
- New logic in `src/lib/` comes with Vitest tests.
- `npm run build`, `npm run lint`, `npm run check`, `npm test`, and ruff, mypy and
  pytest must all pass before you stop. Fetchers must run on Python 3.10+ (no 3.11+ syntax or
  stdlib such as `tomllib`, `ExceptionGroup`, `typing.Self`).

## End-of-task report (required, every time you stop)

Finish every task with a report in exactly this shape:

### Summary

2–4 sentences on what was built or changed.

### Build

Result of `npm run build` (pass/fail, and any warnings), plus lint, check, tests
and the Python checks.

### Changes by logical unit

Group every changed, created or deleted file into small logical units, each of
which could be its own commit and would still build on its own. For each unit:

- a one-line description of the change
- the exact file paths, one per line, marked [new], [modified] or [deleted]

### git status

The raw output of `git status --porcelain`, so nothing is missed.

### Decisions and open questions

Anything you decided where the design is silent, and anything you need from Matteo.

## Phases (stop after each for review)

1. ✓ Scaffold, tokens, fonts, header/footer, home page on fixture data.
2. ✓ Journal, lists, cooking pages, content schemas, example files.
3. ✓ Challenge map + `countries.yaml`.
4. ✓ Python fetchers + tests + deploy workflow.
5. ✓ Mobile pass, accessibility pass (contrast, focus = 2px accent outline offset 2px,
   alt text), Lighthouse ≥ 95 in all categories.

After each phase: make every check above pass, then stop and give the
end-of-task report, and wait for Matteo's OK before starting the next phase.

## Docs

Keep these current with every change:

- `README.md`: the portfolio overview.
- `docs/DESIGN.md`: the design specification, including every decision made.
- `docs/CONTENT.md`: how to add and edit content.
- `docs/SETUP.md`: every site value and how to create each token and secret.

Update them at the end of every phase. README describes only what works now
(plus its Roadmap); DESIGN may describe planned behaviour; in CONTENT and SETUP,
sections for unbuilt features carry "(planned)" in the heading.
