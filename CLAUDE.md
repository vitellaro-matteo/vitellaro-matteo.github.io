# CLAUDE.md

**Read `SITE_SPEC.md` in full at the start of every session.** It is the single
source of truth for this site ("a slow feed"). Follow its values exactly.

## Git — hard rules
- **Never run `git push`.** Matteo pushes himself.
- **Never add, remove or change remotes.**
- Never force anything (`--force`, `reset --hard` on shared history, etc.).
- Never create repos or pull requests.
- Commit locally in small, focused commits with clear messages at the end of each phase.

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

After each phase: run `npm run build`, fix errors, commit locally, then tell
Matteo what to look at and wait for his OK before starting the next phase.

## Python
Fetchers must run on Python 3.10+ (no 3.11/3.12-only syntax or stdlib, e.g. no
`tomllib`, `ExceptionGroup`, `typing.Self`). The workflow still uses 3.12.

## Docs
Maintain a README covering setup, where every blank lives, how to add a journal
post / recipe / year's list, and how to create each token/secret.
