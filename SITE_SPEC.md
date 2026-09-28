# SITE_SPEC.md — "a slow feed", Matteo's personal site

This file is the single source of truth for the site. Follow it exactly.
If something is not specified here, reuse the closest existing pattern from this
spec and ask me before inventing anything new (no new colours, fonts, shadows,
radii, animations or components).

---

## 0. Blanks to fill in

Everything in `{{DOUBLE_BRACES}}` is a blank. Keep every blank in ONE place:
`site.config.ts` (site text + usernames) and GitHub Actions secrets (tokens).
Never hard-code a blank anywhere else.

| Blank | Where | Notes |
|---|---|---|
| `{{SITE_NAME}}` | site.config.ts | default `matteo` (lowercase wordmark) |
| `{{TAGLINE}}` | site.config.ts | default `a slow feed` |
| `{{HERO_TITLE}}` | site.config.ts | default: `A quiet shelf for the songs, films, books and small things I keep finding.` |
| `{{HERO_BIO}}` | site.config.ts | 1–2 sentences about me |
| `{{SITE_URL}}` | site.config.ts | e.g. `https://<user>.github.io` or custom domain |
| `{{TIMEZONE}}` | site.config.ts | e.g. `Europe/Berlin` (used for week numbers + dates) |
| `{{SPOTIFY_PLAYLIST_ID}}` | site.config.ts | the "last week's finds" playlist |
| `{{LETTERBOXD_USERNAME}}` | site.config.ts | |
| `{{GOODREADS_USER_ID}}` | site.config.ts | numeric id from profile URL |
| `{{INSTAGRAM_USERNAME}}` | site.config.ts | `fuzetea_esports` |
| `{{GITHUB_USERNAME}}` | site.config.ts | |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` | Actions secrets | same kind as in my WeeklySpotifyUpdate repo |
| `INSTAGRAM_TOKEN` | Actions secret | long-lived token (see §5) |
| `GH_STATS_TOKEN` | Actions secret | fine-grained PAT, read-only, for contribution calendar |

---

## 1. Stack

- **Site:** Astro (static output), TypeScript, plain CSS with custom properties.
  No Tailwind, no UI kit. Content collections for journal, recipes, lists.
- **Data fetchers:** Python 3.12 in `scripts/` (`requests`, `feedparser`,
  `PyYAML`, `python-dateutil`), `requirements.txt`, `pytest` tests with saved
  fixture feeds for every parser.
- **Map:** `d3-geo` + `topojson-client` + `world-atlas` (countries-50m),
  rendered to static SVG **at build time** (no client-side map library).
- **Hosting:** GitHub Pages via `actions/deploy-pages`.
- **Automation:** one GitHub Actions workflow (§5).
- Only client JS allowed: lists-page tabs, map tooltips, mobile menu. Everything
  else is static HTML.

---

## 2. Design system (exact values)

### Colour tokens
```css
:root {
  --paper:     #F3EFE7; /* page background */
  --card:      #FAF8F4; /* card background */
  --kraft:     #E6DECF; /* now-box, lists band, image placeholders, uncooked countries */
  --kraft-2:   #D8CDB9; /* placeholder tone */
  --kraft-3:   #CFC3AC; /* placeholder tone, divider inside kraft boxes */
  --line:      #DDD5C6; /* card borders, header rule */
  --line-soft: #E6DECF; /* row dividers inside cards */
  --ink:       #2A2724; /* text, strong rules */
  --muted:     #5F5850; /* secondary text, meta, source links */
  --numeral:   #8A7F6E; /* list numerals 02–10 */
  --accent:    #9C4A32; /* section labels, active nav, #1 numeral, progress, cooked countries */
}
```
Alternative accents (keep as commented options only): moss `#5E6B4E`,
slate `#3F5A6B`, ink `#2A2724`.

### Type
Google Fonts: `Shippori Mincho` 400/500, `Instrument Sans` 400/500,
`IBM Plex Mono` 400. Self-host them via `@fontsource` packages.

- `--font-display: 'Shippori Mincho', 'Hiragino Mincho ProN', Georgia, serif;` weight 400
- `--font-body: 'Instrument Sans', 'Helvetica Neue', sans-serif;`
- `--font-mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;` 12px, `letter-spacing: 0.06em` (11px on mobile)
- Body text is antialiased (`-webkit-font-smoothing: antialiased`).
- Mono is always lowercase as written; never uppercase-transform anything.

### Rules
- Border radius **0** everywhere. **No shadows, no gradients, no emoji, no icons**
  except the one inline stroke SVG (menu).
- Links: ink, no underline; hover colour `--accent`. No other hover effects,
  no transitions longer than 120ms, no scroll animations.
- External links end with ` ↗` (text glyph). Internal "more" links end with ` →`.
- Touch targets ≥ 44px tall.
- Images: always a `--kraft`/`--kraft-2`/`--kraft-3` background behind them while
  loading; `object-fit: cover`.
- Light mode only (no dark mode for now).

### Layout
- Container: 1120px wide, centred; below 1200px viewport use 40px side padding;
  below 768px switch to the mobile layout (§3.7).
- 12-column grid, `column-gap: 32px` (also row gap 32px for card grids).

### Components
- **Header:** height 112px, `border-bottom: 1px solid var(--line)`.
  Left: wordmark `{{SITE_NAME}}` display 28px + tagline mono muted, baseline-aligned,
  gap 14px, whole thing links home.
  Right: nav, body 15px, gap 30px:
  `listening · watching · reading · seeing · making · cooking · journal · lists`
  (first six are anchors on the home page; journal, lists, cooking also have
  pages; on those pages the current item is `--accent`).
- **Section heading:** display 32px `<h2>` left, mono muted meta right,
  baseline-aligned, `padding-bottom: 20px; border-bottom: 1px solid var(--ink)`;
  content starts 40px below.
- **Card:** `background: var(--card); border: 1px solid var(--line); padding: 36px;`
  flex column, gap 24px. Card header: left stack (gap 10px) of mono label in
  accent `"0N — name"` and display 26px `<h3>`; right a mono muted source link
  (`spotify ↗`, `letterboxd ↗`, …) vertically centred in a 44px box.
- **Row list inside a card:** rows separated by `border-top: 1px solid var(--line-soft)`,
  padding 14px 0 (12px for GitHub rows, 16px for journal rows).
- **Kraft band:** `background: var(--kraft); padding: 56px;` 12-col grid inside.
- **Footer:** `margin-top: 96px; padding: 40px 0 64px; border-top: 1px solid var(--ink)`.
  Left: wordmark display 22px + body 14px muted line `Updated automatically, written slowly.`
  Right: mono muted links, gap 24px: spotify, letterboxd, goodreads, instagram, github, rss.

---

## 3. Pages

### 3.1 Home `/`
1. Header.
2. **Hero** — `padding: 128px 0 120px`, 12-col grid, items aligned to bottom.
   - Left span 8, gap 32px: mono accent `hello`; `<h1>` display 56px / 1.28
     `{{HERO_TITLE}}`; `<p>` body 18px / 1.7 muted, max-width 580px, `{{HERO_BIO}}`.
   - Right span 4: **now box** — kraft background, padding 32px, gap 18px:
     mono muted `now`; three rows (body 15px, label muted left, value right):
     `on repeat`, `reading`, `thinking about`; then mono muted `updated [date]`
     with `padding-top: 14px; border-top: 1px solid var(--kraft-3)`.
     Values come from `src/data/now.yaml` (manual), except `reading`, which falls
     back to the Goodreads current book if left empty.
3. **Section heading** `This week` / meta `week NN · D–D mon YYYY` = the previous
   ISO week (Mon–Sun) in `{{TIMEZONE}}`, matching the playlist.
4. **Card grid** (12 cols, gap 32px), in this order:
   - **01 — listening** (span 7), h3 `last week's finds`, link `spotify ↗`.
     Up to 10 rows, grid `44px 1fr auto`: mono index `01`, track title body 16px,
     artist body 15px muted. Footer line body 14px muted:
     `Every Monday, the songs I liked the week before move into one playlist.`
   - **02 — watching** (span 5), h3 `recently watched`, link `letterboxd ↗`.
     3 most recent films, 3-col grid gap 16px: poster 2:3, title body 14px,
     mono muted `YEAR · ★ RATING` (omit rating part if none). Below, with
     `padding-top: 20px; border-top: 1px solid var(--line-soft)`: display 18px /1.6
     quote of the first sentence of the latest review in “curly quotes”
     (hide if no review).
   - **03 — reading** (span 5), h3 `on the nightstand`, link `goodreads ↗`.
     Cover 120×180 + stack (bottom-aligned, gap 8px): title display 20px, author
     body 15px muted, progress bar (2px tall, track `--kraft`, fill `--accent`,
     margin-top 16px) + mono muted `page X of Y` — **bar and label only render if
     `progress` is set in now.yaml**. Below, divided by line-soft: mono muted
     `finished lately`, then 2 rows body 15px `Title — Author`.
   - **04 — seeing** (span 7), h3 `@{{INSTAGRAM_USERNAME}}`, link `instagram ↗`.
     3×2 grid of square photos, gap 8px, each links to the post. Caption body 14px
     muted: `The quieter account — photos I don't post anywhere else.`
   - **05 — making** (span 7), h3 `on github`, link `github ↗`.
     Contribution calendar: last 30 weeks, columns of 7 squares 14×14, gap 4px.
     Level 0 = `--kraft`; levels 1/2/3 = `--accent` at opacity 0.3/0.6/1
     (quantise by quartiles of the non-zero days). Below: 2–3 rows, grid
     `200px 1fr auto`: repo name body 15px, latest commit message muted,
     mono muted relative time (`3d ago`).
   - **06 — journal** (span 5), h3 `notes & essays`, link `all →` to `/journal`.
     3 latest entries, each row a link: mono muted date, display 19px title.
   - **07 — cooking** (span 12), h3 `last cooked`, link `all →` to `/cooking`.
     Inside: 12-col grid. Left span 5: latest recipe photo 4:3, then mono muted
     `DATE · COUNTRY`, display 22px title, body 14px muted `from SOURCE`.
     Right span 7: the mini world map (§3.6 styling, no tooltips), and under it a
     row: display 32px `N` in accent + body 15px muted ` / 195 national dishes`,
     right-aligned mono link `the challenge →`.
5. **Lists band** (kraft band, `margin-top: 96px`). Left span 5, gap 18px: mono
   accent `08 — lists`, display 40px / 1.25 `Top tens, every December`, body 16px
   / 1.7 muted `A yearly look back: ten songs, ten albums, ten films, ten books.`
   Right span 7: 4-col grid gap 12px of tiles (card bg, padding 24px 20px, gap 8px):
   display 44px `10` + body 14px muted `songs of YEAR` / albums / films / books;
   each links to `/lists/YEAR#category`. YEAR = latest year that has a list file.
6. Footer.

### 3.2 Journal index `/journal`
Header; page intro in the lists-page style (§3.4 intro) with mono `journal` and
h1 `Notes & essays`; then rows: grid `160px 1fr 200px`, padding 24px 0,
line-soft dividers: mono muted date, display 26px title + body 16px muted
summary, mono muted tags right-aligned.

### 3.3 Journal entry `/journal/[slug]`
12-col grid, `padding-top: 112px`.
- Left span 3 (padding-top 14px, gap 22px): mono accent `journal`, then pairs
  (mono muted label + body 15px value): `written`, `reading time`, `filed under`.
- Middle span 7, gap 40px: `<h1>` display 50px / 1.25; lead = display 22px / 1.6
  muted (frontmatter `lead`); body text Instrument Sans 18px / 1.75, paragraphs
  28px apart, h2 inside posts display 28px; blockquote display 26px / 1.5,
  `padding-left: 32px`, no border.
  **Embeds** (MDX components): `<Track id="…"/>` → card with 96×96 cover, mono
  accent `from last week's finds` (or custom label), display 20px title, body 15px
  muted artist, mono `listen ↗`; also `<Film>`, `<Book>`, `<Recipe>` using the same
  card shape with the matching image ratio.
  Prev/next footer: `border-top: 1px solid var(--ink); padding-top: 28px`,
  mono muted `← older` / `newer →` above display 18px titles.
- Right span 2: margin notes (MDX `<Aside>`), mono 12px / 1.8 muted, aligned to
  the paragraph they sit beside; on mobile they become an indented block.

### 3.4 Lists `/lists/[year]`
- Intro: `padding: 112px 0 64px`, space-between, bottom-aligned. Left (gap 24px):
  mono accent `lists`, h1 display 72px / 1.1 `YEAR, in tens`. Right: body 16px /
  1.7 muted, max-width 360px:
  `Written in December. Ten of each, in order, with a line on why each one stayed.`
- Tabs: `songs · albums · films · books`, body 16px, gap 36px, 48px tall,
  bottom border line; active = ink text + 2px accent underline, inactive = muted.
  Tabs switch panels client-side and update the URL hash.
- Rows (`<ol>`): grid `120px 104px 1fr 300px`, column-gap 32px, padding 24px 0,
  line-soft bottom border. Numeral display 56px (`01` in accent, rest `--numeral`);
  image 104px wide — **square for songs and albums (cover art), 2:3 for films and
  books (104×156)**; title display 24px + creator body 15px muted; note body
  15px / 1.6 muted.
- Footer right: mono `archive: earlier years →` to `/lists`, which lists years.

### 3.5 Cooking `/cooking` and `/cooking/[slug]`
Recipes I cooked and followed from somewhere else. Always credit and link the
source; never copy the source's method text — write my own notes.
- `/cooking` intro (lists style): mono accent `cooking`, h1 `What I've been cooking`,
  right text body 16px muted `Recipes I followed, with what I changed.`
  Then a kraft band: left mono accent `around the world`, display 40px
  `One national dish per country`, body muted progress `N of 195 cooked`, link
  `the challenge →`; right the mini map.
  Then recipe grid, 3 columns gap 32px, each a card (card styles, padding 0,
  image flush top 4:3, text block padding 24px gap 8px): mono muted
  `DATE · COUNTRY`, display 22px title, body 14px muted `from SOURCE`.
- `/cooking/[slug]` uses the journal entry layout (§3.3). Left meta pairs:
  `cooked`, `from` (source link ↗), `country` (links to challenge, if challenge
  entry), `time`, `serves`, `again?` (yes / no / maybe). Middle: title, lead,
  photo 4:3 full column width, optional `## What I changed`, optional
  ingredients list (rows with mono quantity column 120px + body item), then notes.

### 3.6 The challenge `/cooking/around-the-world`
- Intro (lists style): mono accent `around the world`, h1 `One dish, every country`;
  right: display 56px `N` in accent + body 16px muted ` / 195`.
- Map: full container width, Equal Earth projection, fitted to the container,
  Antarctica removed. Countries: fill `--kraft`, stroke `--paper` 0.6px;
  cooked countries fill `--accent`. No ocean fill, no graticule, no borders on
  the frame. Hover/focus on a country → small tooltip (card bg, 1px line
  border, padding 8px 12px): mono muted country name + display 16px dish name
  (+ `cooked DATE` if done). Cooked countries are links to their recipe.
  Countries too small for the 50m geometry get a 3px dot at their centroid.
- Below: section heading per continent (Africa, Americas, Asia, Europe, Oceania),
  4-col grid of rows: country body 15px + dish body 14px muted; cooked rows are
  links with a small accent square (8×8) before the name; not-yet rows show
  the planned dish in muted.
- Data: `src/data/countries.yaml` — 195 entries (193 UN members + Holy See +
  Palestine): `iso_n3`, `name`, `continent`, `dish`, `dish_verified: false`.
  Seed `dish` with the most commonly cited national dish and leave
  `dish_verified: false` so I can check each one. A recipe marks a country as done
  via frontmatter `challenge: <iso_n3>`.

### 3.7 Mobile (< 768px)
Side padding 24px. Header 72px tall: wordmark display 24px left, menu button
(44×44, inline stroke SVG of two lines, `aria-label="Open menu"`) right, opening a
full-screen paper-coloured nav list in display 28px. Hero `padding: 56px 0 48px`,
gap 20px, h1 display 32px / 1.35, bio body 16px. Section heading h2 24px.
Cards stack in one column, gap 16px, padding 24px, card label row = mono label
left + source link right, h3 display 22px. Listening shows 5 rows as grid
`32px 1fr` with title 15px over artist 13px muted. Watching posters 3-col gap
10px. Seeing grid gap 6px. Lists band padding 28px 24px, h2 26px. Footer links
wrap, gap 16px. Lists page rows collapse to `48px 72px 1fr` (note moves under
title). Map stays full width.

---

## 4. Content model (what I edit by hand)
```
site.config.ts                       all blanks from §0
src/data/now.yaml                    on_repeat, reading (optional), thinking_about,
                                     progress: {page, of} (optional), updated
src/data/countries.yaml              challenge list (§3.6)
src/content/journal/*.mdx            title, date, lead, summary, tags[], draft
src/content/recipes/*.mdx            title, date, lead, source_name, source_url,
                                     country, challenge (iso_n3, optional),
                                     time, serves, again, image
src/content/lists/YEAR.yaml          songs[10], albums[10], films[10], books[10]:
                                     {title, creator, note, image}
public/media/…                       my photos (recipes, list covers)
```
Validate all frontmatter/YAML with Zod schemas; a missing required field must fail
the build with a clear message. Include ONE example file of each (clearly marked
as example, `draft: true`) so I can copy it.

---

## 5. Data pipeline (automatic feeds)
`scripts/fetch_all.py` runs each fetcher, writes `src/data/feeds/*.json`, and
downloads images it needs into `public/media/feeds/` (never hotlink — Instagram
URLs expire). One fetcher failing must not break the others: keep the previous
JSON and log a warning.

- **spotify.py** — refresh-token flow, read `{{SPOTIFY_PLAYLIST_ID}}` tracks
  (title, artists, album cover, url).
- **letterboxd.py** — RSS `https://letterboxd.com/{{LETTERBOXD_USERNAME}}/rss/`:
  film title, year, member rating, watched date, poster, review text (strip HTML).
- **goodreads.py** — RSS `https://www.goodreads.com/review/list_rss/{{GOODREADS_USER_ID}}?shelf=currently-reading`
  and `?shelf=read` (latest 2): title, author, cover, pages if present.
- **instagram.py** — Instagram API with Instagram Login (account must be
  Business/Creator; stays public). Get latest 6 IMAGE/CAROUSEL posts
  (use `thumbnail_url` for videos). Refresh the long-lived token each run; if the
  returned token differs, update the `INSTAGRAM_TOKEN` secret with `gh secret set`
  (needs a PAT secret — document this in the README).
- **github.py** — GraphQL `contributionsCollection` (last 30 weeks) + latest public
  push events (repo, message, time).

**Workflow `.github/workflows/site.yml`:** triggers on push to `main`, daily cron
at 05:00 UTC, and manual dispatch. Jobs: set up Python → `pip install -r
requirements.txt` → `pytest` → `python scripts/fetch_all.py` → if feed data
changed, commit as `github-actions[bot]` with message `data: daily refresh` →
build Astro → deploy to Pages. Add `concurrency` so runs don't overlap.
(Because the bot commits, I pull with `git pull --rebase` before pushing —
note this in the README.)

Also generate `/rss.xml` (journal + recipes) and a sitemap.

---

## 6. Working rules for Claude Code
- **Git: never run `git push`, never add or change remotes, never force anything,
  never create repos or PRs. I push myself.** Commit locally in small, focused
  commits with clear messages at the end of each phase.
- Build in phases and stop after each for me to review:
  1. Scaffold, tokens, fonts, header/footer, home page with static placeholder
     JSON matching the real feed shapes.
  2. Journal, lists, cooking pages + content schemas + example files.
  3. Challenge map + countries.yaml.
  4. Python fetchers + tests + workflow.
  5. Mobile pass, accessibility pass (contrast, focus styles = 2px accent outline
     offset 2px, alt text), Lighthouse ≥ 95 on all categories.
- After each phase: run `npm run build`, fix errors, then tell me what to look at.
- Write a README: setup, where every blank lives, how to add a journal post,
  a recipe, a year's list, and how to create each token/secret.
