# CLAUDE.md

**Read `SITE_SPEC.md` in full at the start of every session.** It is the single
source of truth for this site ("a slow feed"). Follow its values exactly.

## Git — hard rules
- Never run git add, git commit, git push, git stash, git reset, git checkout
  of files, or anything else that changes git state. Matteo stages, commits
  and pushes himself.
- Never add, remove or change remotes. Never create repos or PRs.
- Read-only git commands (git status, git diff, git log) are fine.
- Never create secrets, .env files or tokens in the repo; make sure .gitignore
  covers .env, node_modules, dist and .astro.

## End-of-task report (required, every time you stop)
Finish every task with a report in exactly this shape:

### Summary
2–4 sentences on what was built or changed.

### Build
Result of `npm run build` (pass/fail, and any warnings).

### Changes by logical unit
Group every changed, created or deleted file into small logical units, each of
which could be its own commit and would still build on its own. For each unit:
- a one-line description of the change
- the exact file paths, one per line, marked [new], [modified] or [deleted]

### git status
The raw output of `git status --porcelain`, so nothing is missed.

### Decisions and open questions
Anything you decided where the spec is silent, and anything you need from me.

## Design discipline
- If something isn't in the spec, reuse the closest existing pattern from it and
  **ask before inventing** anything new: no new colours, fonts, shadows, radii,
  animations or components.
- All `{{BLANKS}}` live only in `site.config.ts` (text/usernames) or GitHub Actions
  secrets (tokens). Never hard-code them elsewhere.

## Phases (stop after each for review)
1. Scaffold, tokens, fonts, header/footer, home page with static placeholder JSON
   matching the real feed shapes.
2. Journal, lists, cooking pages + content schemas + example files.
3. Challenge map + `countries.yaml`.
4. Python fetchers + tests + workflow.
5. Mobile pass, accessibility pass (contrast, focus = 2px accent outline offset 2px,
   alt text), Lighthouse ≥ 95 in all categories.

After each phase: run `npm run build`, fix errors, then stop and give the
end-of-task report, and wait for Matteo's OK before starting the next phase.

## Python
Fetchers must run on Python 3.10+ (no 3.11/3.12-only syntax or stdlib, e.g. no
`tomllib`, `ExceptionGroup`, `typing.Self`). The workflow still uses 3.12.

## Docs
Maintain a README covering setup, where every blank lives, how to add a journal
post / recipe / year's list, and how to create each token/secret.
