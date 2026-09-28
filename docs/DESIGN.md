# Design — "a slow feed"

This is the design document for Matteo's personal site: a slow, automatically
updated shelf of the songs, films, books, photos, code and recipes he keeps
finding, plus a journal and a yearly top-ten list.

It is the single source of truth for how the site looks and behaves. Values here
are exact. Anything not covered reuses the closest existing pattern: the site
has no colours, fonts, shadows, radii, animations or components beyond the ones
described below.

---

## 1. Configuration

Every site-specific value lives in one file, `site.config.ts`. Tokens are
GitHub Actions secrets and never touch the repo. [SETUP.md](SETUP.md) explains
how to fill in each value and create each secret.

| Value                                                                 | Where           | Notes                                                                                 |
| --------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `SITE_NAME`                                                           | site.config.ts  | `matteo` (lowercase wordmark)                                                         |
| `TAGLINE`                                                             | site.config.ts  | `a slow feed`                                                                         |
| `HERO_TITLE`                                                          | site.config.ts  | `A quiet shelf for the songs, films, books and small things I keep finding.`          |
| `HERO_BIO`                                                            | site.config.ts  | 1–2 sentences about Matteo                                                            |
| `SITE_URL`                                                            | site.config.ts  | `https://vitellaro-matteo.github.io` (origin only)                                    |
| `BASE_PATH`                                                           | site.config.ts  | `/`: the repo is `vitellaro-matteo.github.io`, which Pages serves from the root       |
| `TIMEZONE`                                                            | site.config.ts  | `Europe/Berlin` (week numbers and dates)                                              |
| `SPOTIFY_PLAYLIST_ID`                                                 | site.config.ts  | the "last week's finds" playlist                                                      |
| `LETTERBOXD_USERNAME`                                                 | site.config.ts  |                                                                                       |
| `GOODREADS_USER_ID`                                                   | site.config.ts  | numeric id from the profile URL                                                       |
| `INSTAGRAM_USERNAME`                                                  | site.config.ts  | `fuzetea_esports`                                                                     |
| `GITHUB_USERNAME`                                                     | site.config.ts  |                                                                                       |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` | Actions secrets | same kind as in the WeeklySpotifyUpdate repo                                          |
| `INSTAGRAM_TOKEN`                                                     | Actions secret  | long-lived token (§6)                                                                 |
| `GH_STATS_TOKEN`                                                      | Actions secret  | fine-grained PAT, read-only, for the contribution calendar                            |
| `GH_SECRETS_TOKEN`                                                    | Actions secret  | fine-grained PAT that may write this repo's secrets, used to rotate `INSTAGRAM_TOKEN` |

### Base path

Every internal link and asset goes through one helper, `src/lib/paths.ts`
(`url()` and `routes`). Markdown and MDX bodies get the same treatment from a
hast plugin, so a body link written as `/cooking/` works under any base. Moving
the site to a sub-path (e.g. `/blog`) needs no other change. Internal links end in a slash to match
the directory-style output, so GitHub Pages never redirects.

---

## 2. Stack

- **Site:** Astro (static output), TypeScript in strict mode, plain CSS with
  custom properties. No Tailwind, no UI kit. Content collections for the journal,
  recipes and lists. Markdown runs through Astro's Sätteri processor.
- **Data fetchers:** Python 3.10+ in `scripts/` (`requests`, `defusedxml`),
  configured in `pyproject.toml`, fully type-hinted, with `pytest` tests against
  saved responses for every parser (§6). CI and deploy run Python 3.12.
- **Map:** `d3-geo` + `topojson-client` + `topojson-simplify` + `world-atlas`
  (countries-50m), rendered to static SVG **at build time**, with no client-side
  map library (§4.7).
- **Quality:** ESLint (typescript-eslint, eslint-plugin-astro, jsx-a11y),
  Prettier, `astro check`, Vitest for every module in `src/lib`, ruff, mypy
  (strict), pytest, all run by CI.
- **Hosting:** GitHub Pages via `actions/deploy-pages`.
- **Client JavaScript** is limited to the lists-page tabs, the map tooltips and
  the mobile menu. Everything else is static HTML.

---

## 3. Design system

### Colour tokens

```css
:root {
  --paper: #f3efe7; /* page background */
  --card: #faf8f4; /* card background */
  --kraft: #e6decf; /* now-box, lists band, image placeholders, uncooked countries */
  --kraft-2: #d8cdb9; /* placeholder tone */
  --kraft-3: #cfc3ac; /* placeholder tone, divider inside kraft boxes */
  --line: #ddd5c6; /* card borders, header rule */
  --line-soft: #e6decf; /* row dividers inside cards */
  --ink: #2a2724; /* text, strong rules */
  --muted: #5f5850; /* secondary text, meta, source links */
  --numeral: #8a7f6e; /* list numerals 02–10 */
  --accent: #9c4a32; /* section labels, active nav, #1 numeral, progress, cooked countries */
}
```

Alternative accents are kept as comments only: moss `#5E6B4E`, slate `#3F5A6B`,
ink `#2A2724`.

### Type

Three Google Fonts, self-hosted through `@fontsource` (Latin and Latin Extended
subsets): Shippori Mincho 400/500, Instrument Sans 400/500, IBM Plex Mono 400.

| Role    | Stack                                                       | Details                                         |
| ------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Display | `'Shippori Mincho', 'Hiragino Mincho ProN', Georgia, serif` | weight 400                                      |
| Body    | `'Instrument Sans', 'Helvetica Neue', sans-serif`           | antialiased                                     |
| Mono    | `'IBM Plex Mono', ui-monospace, Menlo, monospace`           | 12px, `letter-spacing: 0.06em` (11px on mobile) |

Mono is always lowercase as written; nothing is ever uppercase-transformed.

### Principles

- Border radius **0** everywhere. **No shadows, no gradients, no emoji, no
  icons**, except the one inline stroke SVG (the mobile menu).
- Links are ink with no underline; hover turns them `--accent`. No other hover
  effects, no transition longer than 120ms, no scroll animations.
- **Links inside journal and recipe body text** are the exception: underlined,
  1px thick, 3px offset, underline colour `--kraft-3`; on hover both the text and
  the underline turn `--accent`. Navigation, card, embed and meta links keep the
  plain style.
- External links end with ` ↗` (a text glyph). Internal "more" links end with ` →`.
  The footer's `rss` link is internal and has no glyph.
- Touch targets are at least 44px tall.
- Images always have a `--kraft` / `--kraft-2` / `--kraft-3` background behind
  them while loading, and use `object-fit: cover`. With no image, the kraft box
  stands in for it.
- Light mode only.

### Layout

- Container 1120px wide, centred; below a 1200px viewport, 40px side padding;
  below 768px, the mobile layout (§4.8).
- 12-column grid, `column-gap: 32px` (row gap 32px for card grids).

### Components

- **Header:** 112px tall, `border-bottom: 1px solid var(--line)`. Left: the
  wordmark (display 28px) and the tagline (mono, muted), baseline-aligned, gap
  14px; the whole thing links home. Right: nav in body 15px, gap 30px:
  `listening · watching · reading · seeing · making · cooking · journal · lists`.
  The first six are anchors to the home-page sections; journal and lists link to
  their pages. On the journal, lists and cooking pages the matching item is
  `--accent`.
- **Section heading:** display 32px `<h2>` on the left, mono muted meta on the
  right, baseline-aligned, `padding-bottom: 20px; border-bottom: 1px solid var(--ink)`;
  content starts 40px below.
- **Card:** `background: var(--card); border: 1px solid var(--line); padding: 36px;`
  flex column, gap 24px. Card header: a left stack (gap 10px) of the mono label in
  accent (`0N — name`) and a display 26px `<h3>`; on the right a mono muted source
  link (`spotify ↗`, `letterboxd ↗`, …) vertically centred in a 44px box.
- **Rows inside a card:** each row has `border-top: 1px solid var(--line-soft)`,
  including the first, so every list starts with a hairline under the card
  header. Padding 14px 0 (12px for GitHub rows, 16px for journal rows).
- **Kraft band:** `background: var(--kraft); padding: 56px;` with a 12-column grid inside.
- **Empty note:** body 15px, muted, placed exactly where the first row would be
  (same divider and padding). Used while a section has nothing published:
  - journal (home card and `/journal`): `First entry coming soon.`
  - cooking (home card's left column and `/cooking`): `Nothing cooked yet.`
  - lists (home band, instead of the tiles, and `/lists`): `The first list arrives in December.`
- **Footer:** `margin-top: 96px; padding: 40px 0 64px; border-top: 1px solid var(--ink)`.
  Left: wordmark (display 22px) and `Updated automatically, written slowly.`
  (body 14px, muted) side by side, baseline-aligned, gap 14px, like the header.
  Right: mono muted links, gap 24px: spotify, letterboxd, goodreads, instagram,
  github, rss.

### Formats

- Dates: `D mon YYYY`, e.g. `21 sep 2026`, in `TIMEZONE`.
- Week meta: `week NN · D–D mon YYYY`; across months `29 sep–5 oct 2026`;
  across years `29 dec 2025–4 jan 2026`.
- Relative time: `40m ago`, `5h ago`, `3d ago`.
- Tags: joined with `, `.
- Reading time: word count at 200 words a minute, shown as `N min`.

---

## 4. Pages

### 4.1 Home `/`

1. Header.
2. **Hero:** `padding: 128px 0 120px`, 12-column grid, items aligned to the bottom.
   - Left, span 8, gap 32px: mono accent `hello`; `<h1>` display 56px / 1.28
     `HERO_TITLE`; `<p>` body 18px / 1.7 muted, max-width 580px, `HERO_BIO`.
   - Right, span 4: the **now box**, kraft background, padding 32px, gap 18px:
     mono muted `now`; three rows (body 15px, muted label left, value right):
     `on repeat`, `reading`, `thinking about`; then mono muted `updated [date]`
     with `padding-top: 14px; border-top: 1px solid var(--kraft-3)`. Values come
     from `src/data/now.yaml`; `reading`, if left empty, falls back to the
     current Goodreads book.
3. **Section heading** `This week`, meta `week NN · D–D mon YYYY`: the previous
   ISO week (Mon–Sun) in `TIMEZONE`, matching the playlist.
4. **Card grid** (12 columns, gap 32px), in this order:
   - **01 — listening** (span 7), h3 `last week's finds`, link `spotify ↗`.
     Up to 10 rows, grid `44px 1fr auto`: mono index `01`, track title body 16px,
     artist body 15px muted. Titles are plain text, not links. Footer line body
     14px muted: `Every Monday, the songs I liked the week before move into one playlist.`
   - **02 — watching** (span 5), h3 `recently watched`, link `letterboxd ↗`.
     The 3 most recent films in a 3-column grid, gap 16px: poster 2:3, title body
     14px, mono muted `YEAR · ★ RATING` (the rating part is left out when there is
     none). Below, with `padding-top: 20px; border-top: 1px solid var(--line-soft)`:
     the first sentence of the latest review in “curly quotes”, display 18px / 1.6
     (hidden when there is no review).
   - **03 — reading** (span 5), h3 `on the nightstand`, link `goodreads ↗`.
     Cover 120×180 and, 24px to its right, a bottom-aligned stack (gap 8px): title
     display 20px, author body 15px muted, then a progress bar (2px tall, track
     `--kraft`, fill `--accent`, margin-top 16px) and mono muted `page X of Y`.
     **The bar and its label only render when `progress` is set in now.yaml.**
     Below, divided by line-soft: mono muted `finished lately`, then 2 rows body
     15px `Title — Author`.
   - **04 — seeing** (span 7), h3 `@INSTAGRAM_USERNAME`, link `instagram ↗`.
     A 3×2 grid of square photos, gap 8px, each linking to its post. Caption body
     14px muted: `The quieter account — photos I don't post anywhere else.`
   - **05 — making** (span 7), h3 `on github`, link `github ↗`. Contribution
     calendar for the last 30 weeks: columns of 7 squares, 14×14, gap 4px.
     Level 0 is `--kraft`; levels 1/2/3 are `--accent` at opacity 0.3/0.6/1,
     split by quartiles of the non-zero days (up to Q1 → 1, up to Q3 → 2,
     above Q3 → 3). Below: 2–3 rows, grid `200px 1fr auto`: repo name body 15px
     (plain text), latest commit message muted, mono muted relative time.
   - **06 — journal** (span 5), h3 `notes & essays`, link `all →` to `/journal`.
     The 3 latest entries, each row a link: mono muted date, display 19px title.
   - **07 — cooking** (span 12), h3 `last cooked`, link `all →` to `/cooking`.
     Inside, a 12-column grid. Left, span 5: the latest recipe photo 4:3, then
     mono muted `DATE · COUNTRY`, display 22px title, body 14px muted
     `from SOURCE`. Right, span 7: the mini world map (§4.7 styling, no tooltips)
     and, 24px below it, a row: display 32px `N` in accent + body 15px muted
     ` / 195 national dishes`, and a right-aligned mono link `the challenge →`.
     **When feed cards are hidden** (§6), the visible cards keep their order and
     are packed into rows of two that alternate 7 + 5 and 5 + 7, exactly as above,
     so the grid never has a hole. A card left alone on the last row spans all 12
     columns, and its content keeps the width it would have at span 7, aligned
     left. `packCards` in `src/lib/layout.ts` does the packing; cooking always
     follows on its own row.
5. **Lists band** (kraft band, `margin-top: 96px`). Left, span 5, gap 18px: mono
   accent `08 — lists`, display 40px / 1.25 `Top tens, every December`, body 16px
   / 1.7 muted `A yearly look back: ten songs, ten albums, ten films, ten books.`
   Right, span 7: a 4-column grid, gap 12px, of equal-height tiles (card
   background, padding 24px 20px, gap 8px): display 44px `10` + body 14px muted
   `songs of YEAR` / albums / films / books, each linking to `/lists/YEAR#category`.
   YEAR is the latest year that has a list file.
6. Footer.

### 4.2 Journal index `/journal`

Header; a page intro (§4.4 style) with mono `journal` and h1 `Notes & essays`;
then rows: grid `160px 1fr 200px`, padding 24px 0, line-soft dividers: mono
muted date, display 26px title over body 16px muted summary (gap 8px), mono muted
tags right-aligned.

### 4.3 Journal entry `/journal/[slug]`

A 12-column grid with `padding-top: 112px`.

- **Left, span 3** (padding-top 14px, gap 22px): mono accent `journal`, then
  pairs of a mono muted label over a body 15px value (gap 6px): `written`,
  `reading time`, `filed under`.
- **Middle, span 7**, gap 40px: `<h1>` display 50px / 1.25; the lead (frontmatter
  `lead`) display 22px / 1.6 muted; the body in Instrument Sans 18px / 1.75, with
  blocks 28px apart; `<h2>` display 28px; blockquotes display 26px / 1.5,
  `padding-left: 32px`, no border.
- **Right, span 2:** margin notes (`<Aside>`), mono 12px / 1.8 muted, level with
  the paragraph they belong to. On mobile they become an indented block.
- **Prev/next** at the end of the middle column: `border-top: 1px solid var(--ink); padding-top: 28px`,
  mono muted `← older` / `newer →` over display 18px titles (gap 8px).

**Embeds** are MDX components available in every entry without imports. They
share one card shape: card background, 1px line border, padding 24px, image 96px
wide on the left and, 24px to its right, a stack (gap 8px) of a mono accent
label, a display 20px title, a body 15px muted subtitle and a mono link.

| Embed                | Image               | Default label            | Link           |
| -------------------- | ------------------- | ------------------------ | -------------- |
| `<Track id="…"/>`    | 96×96 cover         | `from last week's finds` | `listen ↗`     |
| `<Film …/>`          | 96×144 poster (2:3) | `film`                   | `letterboxd ↗` |
| `<Book …/>`          | 96×144 cover (2:3)  | `book`                   | `goodreads ↗`  |
| `<Recipe slug="…"/>` | 96×72 photo (4:3)   | `recipe`                 | `recipe →`     |

Every embed takes a `label` to replace the default. `<Track>` looks the track up
by id in the Spotify feed (§6).

### 4.4 Lists `/lists/[year]` and `/lists`

- **Intro:** `padding: 112px 0 64px`, space-between, bottom-aligned. Left, gap
  24px: mono accent `lists`, h1 display 72px / 1.1 `YEAR, in tens`. Right: body
  16px / 1.7 muted, max-width 360px:
  `Written in December. Ten of each, in order, with a line on why each one stayed.`
- **Tabs:** `songs · albums · films · books`, body 16px, gap 36px, 48px tall,
  with a bottom border line. The active tab is ink with a 2px accent underline;
  inactive tabs are muted. Tabs are anchor links, so without JavaScript all four
  panels show and a tab jumps to its panel; with JavaScript they switch panels in
  place and update the URL hash.
- **Rows** (`<ol>`): grid `120px 104px 1fr 300px`, column-gap 32px, padding 24px
  0, line-soft bottom border. Numeral display 56px (`01` in accent, the rest
  `--numeral`); image 104px wide, **square for songs and albums (cover art), 2:3
  for films and books (104×156)**; title display 24px over creator body 15px
  muted (gap 8px); note body 15px / 1.6 muted.
- **Footer**, 40px below, right-aligned: mono `archive: earlier years →` to `/lists`.
- **`/lists`** uses the same intro with h1 `Top tens, every December` and the text
  `A yearly look back: ten songs, ten albums, ten films, ten books.`, then one
  row per year: display 26px `YEAR, in tens`, padding 24px 0, line-soft dividers.

### 4.5 Cooking `/cooking`

Recipes Matteo cooked and followed from somewhere else. The source is always
credited and linked; its method is never copied, only Matteo's own notes.

- **Intro** (§4.4 style): mono accent `cooking`, h1 `What I've been cooking`,
  right text body 16px muted `Recipes I followed, with what I changed.`
- **Kraft band:** left (span 5, gap 18px): mono accent `around the world`,
  display 40px `One national dish per country`, body muted `N of 195 cooked`,
  link `the challenge →`; right (span 7): the mini map on kraft ground (§4.7).
- **Recipe grid**, 64px below: 3 columns, gap 32px. Each card uses the card
  styles with padding 0: the image flush at the top (4:3), then a text block
  (padding 24px, gap 8px): mono muted `DATE · COUNTRY`, display 22px title, body
  14px muted `from SOURCE`.

### 4.6 Recipe `/cooking/[slug]`

Uses the journal entry layout (§4.3), including the older/newer footer.

- **Left meta pairs:** `cooked`, `from` (source link ↗), `country` (links to the
  challenge only when the recipe is a challenge entry), `time`, `serves`,
  `again?` (yes / no / maybe).
- **Middle:** title, lead, the photo at 4:3 across the full column, then the
  body: an optional `## What I changed`, an optional ingredients list (rows with a
  120px mono quantity column and the item in body text, line-soft dividers,
  padding 14px 0), then the notes.

### 4.7 The challenge `/cooking/around-the-world`

- **Intro** (§4.4 style): mono accent `around the world`, h1 `One dish, every country`;
  right: display 56px `N` in accent + body 16px muted ` / 195`.
- **Map:** full container width, Equal Earth projection fitted to the container,
  Antarctica removed (the fitted bounds are 1000 × 447). No ocean fill, no
  graticule, no frame. Cooked countries are always `--accent` and link to their
  recipe. Uncooked countries depend on the ground the map sits on:

  | Ground        | Uncooked fill | Borders            |
  | ------------- | ------------- | ------------------ |
  | paper or card | `--kraft`     | `--paper`, 0.6px   |
  | kraft         | `--card`      | `--kraft-3`, 0.6px |

  Hover or focus on a country shows a small tooltip (card background, 1px line
  border, padding 8px 12px, gap 4px): mono muted country name + display 16px
  dish name (+ mono muted `cooked DATE` when done). Escape and blur hide it. It
  sits 12px below-right of the pointer (or the focused country's centre) and
  flips left near the right edge. Countries whose projected area is under 4 px²,
  or that are missing from the 50m geometry (only Tuvalu, placed by a
  `centroid` in the data), get a 3px dot.

- **Accessibility:** the SVG has `role="img"` and an `aria-label` summary
  (`N of 195 countries cooked`). Cooked countries are real `<a>` elements inside
  it, with a label naming the country, dish and date. The continent list is the
  full accessible alternative, and a visually hidden sentence after the intro
  says so. Uncooked countries show their tooltip on hover only.
- **Rendering:** the world topology is simplified once (topology-preserving, so
  shared borders stay identical), projected with Equal Earth, snapped to a pixel
  grid and written as relative path commands. The full map keeps 10% of the
  points on a 0.5px grid (about 45 KB of path data); the mini map keeps 5% on a
  1px grid (about 26 KB). The only script is the tooltip; the challenge page is
  about 111 KB of HTML, 26 KB gzipped.
- **Mini map** (home card, cooking band): the same drawing without links or
  tooltips, hidden from screen readers because the cooked count sits beside it.

- **Below**, 96px under the map: a section heading per continent (Africa,
  Americas, Asia, Europe, Oceania), 64px apart, each over a 4-column grid
  (column gap 32px) of rows (padding 14px 0, line-soft top border): country body
  15px over dish body 14px muted, gap 4px, alphabetical. Cooked rows are links
  with an 8×8 accent square before the name (and a visually hidden ", cooked");
  not-yet rows show the planned dish in muted.
- **Data:** `src/data/countries.yaml`, 195 entries (193 UN members, the Holy See
  and Palestine): `iso_n3`, `name`, `continent`, `dish`, `dish_verified: false`,
  an optional `note` (e.g. "no official national dish; most cited") and, for
  countries missing from the geometry, `centroid: [lon, lat]`. Continents follow
  the UN M49 regions (so Cyprus, Türkiye and the Caucasus are in Asia, Russia in
  Europe). `dish` is seeded with the most commonly cited national dish and stays
  `dish_verified: false` until Matteo has checked it. Zod checks exactly 195
  entries, unique codes, and geometry-or-centroid for each.
- A recipe marks a country as done with the frontmatter `challenge: '<iso_n3>'`;
  a code missing from the list fails the build. When several recipes share a
  country, the most recent one is linked.

### 4.8 Mobile (below 768px)

Side padding 24px. Header 72px tall: wordmark display 24px on the left, a menu
button (44×44, inline stroke SVG of two lines, `aria-label="Open menu"`) on the
right, opening a full-screen paper-coloured nav list in display 28px. Hero
`padding: 56px 0 48px`, gap 20px, h1 display 32px / 1.35, bio body 16px. Section
heading h2 24px. Cards stack in one column, gap 16px, padding 24px; the card label
row is the mono label on the left and the source link on the right; h3 display
22px. Listening shows 5 rows as grid `32px 1fr`, with the title 15px over the
artist 13px muted. Watching posters stay 3 columns, gap 10px. Seeing grid gap
6px. Lists band padding 28px 24px, h2 26px. Footer links wrap, gap 16px. Lists
page rows collapse to `48px 72px 1fr` with the note under the title. The map
stays full width.

---

## 5. Content model

Everything below is edited by hand. [CONTENT.md](CONTENT.md) is the how-to.

```
site.config.ts                  every value from §1
src/data/now.yaml               on_repeat, reading (optional), thinking_about,
                                progress: {page, of} (optional), updated
src/data/countries.yaml         the challenge list (§4.7)
src/content/journal/*.mdx       title, date, lead, summary, tags[], draft
src/content/recipes/*.mdx       title, date, lead, source_name, source_url,
                                country, challenge (iso_n3, optional),
                                time, serves, again, image, draft
src/content/lists/YEAR.yaml     draft, songs[10], albums[10], films[10], books[10]:
                                {title, creator, note, image}
public/media/…                  Matteo's photos (recipes, list covers)
```

- All frontmatter and YAML is validated with Zod. A missing or invalid field
  fails the build with a message naming the file and the field.
- Image fields are paths under `/media/…`, and the file must exist in `public/`.
- A published list file must be named after its year, e.g. `2025.yaml`.
- **Drafts** (`draft: true`) show in `npm run dev` and never in the build.
- There is one example file per content type, marked as an example and
  `draft: true`, with flat `--kraft-2` placeholder images in
  `public/media/examples/`.

---

## 6. Data pipeline

The automatic cards are fed by Python fetchers in `scripts/`. Running
`python -m scripts.fetch_all` runs each fetcher in turn; a fetcher that succeeds
writes its feed to `src/data/live/<name>.json` and downloads every image it needs
into `public/media/feeds/<name>/`. Images are never hotlinked, because Instagram
URLs expire. Files are named by a hash of a stable key (post id, album id, …), so
an image already on disk is not downloaded again, and images the latest fetch no
longer uses are removed.

**One failing fetcher never stops the others.** Each outcome is one of:

| Outcome | When                                                                   | What happens                                                                 |
| ------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| updated | the fetch worked                                                       | the feed file and its images are replaced                                    |
| skipped | a secret or a `site.config.ts` value is missing or still a placeholder | a log line names what is missing; the previous output stays                  |
| failed  | the source errored (network, API change, bad data)                     | the error is logged with any credentials redacted; the previous output stays |

`fetch_all` exits 0 when at least one fetcher updated, and writes a summary table
(feed, result, details, and whether the site shows fresh data, the last good
copy or a hidden card) to the log and to the GitHub step summary.

Usernames and ids are read from `site.config.ts` by a small parser, so every
site value still lives in that one file; tokens come from environment variables
set from Actions secrets.

**Feeds are not committed.** Both output paths are gitignored. `src/data/feeds/`
holds only committed sample fixtures in the same shape, for development and
tests.

**When a feed is missing:**

1. The deploy workflow restores the last good feeds from the GitHub Actions
   cache before fetching. A fetcher that fails leaves the restored copy in place,
   and the merged result is saved back to the cache for the next run.
2. With no cached copy either, the build has no data for that feed, and the card
   it fills is left out of the page (the other cards are repacked, §4.1). The
   build log names each hidden card, e.g.
   `[feeds] no instagram feed: hiding the seeing card`. A `<Track>` embed is
   likewise left out when the Spotify feed is missing.
3. **Fixtures never reach production.** The site reads fixtures only in
   `npm run dev` or when the build runs with `USE_FIXTURES=true` (CI does, so it
   exercises every card).

**The fetchers:**

- **spotify.py:** exchanges `SPOTIFY_REFRESH_TOKEN` for an access token, then
  reads the `SPOTIFY_PLAYLIST_ID` playlist with `GET /playlists/{id}/items`
  (id, title, artists, album cover of at least 300px, url). It also scans
  `src/content` for `<Track id="…">` embeds and fetches any that aren't in the
  playlist with `GET /tracks/{id}`, one by one, since the batch endpoint was
  removed for development-mode apps in February 2026. They are written to the
  feed's `embedded` list, so embeds keep working after a song leaves the
  playlist. An unknown id is logged and left to the site build to report.
  When the token refresh or a playlist read fails, the error quotes Spotify's
  own `error` and `error_description` (or Web API message) plus a one-line hint
  for the common cases (`invalid_client`, `invalid_grant`, HTTP 403/404), in the
  log and the step summary. Credentials are never logged; malformed ones (stray
  whitespace, pasted JSON, an access token instead of a refresh token) are
  described without their value. `python -m scripts.spotify --check` runs the
  same refresh and one playlist read locally.
- **letterboxd.py:** RSS `https://letterboxd.com/LETTERBOXD_USERNAME/rss/`, the
  10 latest diary entries (lists are skipped): film title, year, member rating,
  watched date, poster and review text. Letterboxd's boilerplate paragraphs
  ("Watched on …", "This review may contain spoilers") are dropped, so an entry
  without a real review has none.
- **goodreads.py:** RSS `https://www.goodreads.com/review/list_rss/GOODREADS_USER_ID`
  with `?shelf=currently-reading`, and `?shelf=read` sorted by finish date to
  keep the latest 2: title, author, the largest real cover (never the "no photo"
  placeholder) and page count if present.
- **instagram.py:** Instagram API with Instagram Login (the account must be
  Business or Creator; it stays public). Gets the latest 6 posts of any type,
  using `thumbnail_url` for videos, with timestamps normalised to UTC. On every
  run it refreshes the long-lived token; when Instagram returns a new one, it is
  masked in the log and written to the `INSTAGRAM_TOKEN` secret with
  `gh secret set`, authenticated with `GH_SECRETS_TOKEN`, passing the token on
  stdin. Without `GH_SECRETS_TOKEN` the refresh still works for that run and a
  warning says to update the secret by hand.
- **github.py:** GraphQL `contributionsCollection` from the Sunday 29 weeks
  before the current week until now (30 columns), authenticated with
  `GH_STATS_TOKEN`; then the public events of `GITHUB_USERNAME`, keeping the
  latest push to each of the 3 most recently pushed repositories. Since October
  2025 push events no longer include commits, so each message (first line only)
  is read from the commit API by the push's `head`.

RSS is parsed with `defusedxml`; HTTP uses `requests` with a 20-second timeout
and a descriptive user agent. Both are the only runtime dependencies.

`scripts/spotify_auth.py` is not a fetcher but the one-time helper that creates
`SPOTIFY_REFRESH_TOKEN` (see `docs/SETUP.md`). It runs the authorization code
flow against a local server on the redirect URI's host and port, by default
`http://127.0.0.1:8888/callback`, the URI WeeklySpotifyUpdate already uses, so
both repos share one Spotify app. It uses only the standard library, checks the
OAuth `state`, prints just the refresh token and granted scopes, and never
echoes the client secret.

**Deploy workflow, `.github/workflows/deploy.yml`:** triggered by a push to
`main`, a daily cron at 05:00 UTC and manual dispatch. Permissions are limited to
`contents: read`, `pages: write` and `id-token: write`; the `pages` concurrency
group queues runs so two never overlap, and never cancels one mid-deploy.

1. Check out, set up Python 3.12 and install the fetchers.
2. Restore the last good feeds (`src/data/live`, `public/media/feeds`) from the
   Actions cache.
3. Fetch. The step is allowed to fail (`continue-on-error`), so missing secrets
   or a total outage never block a deploy; its summary shows what happened.
4. Save the feeds back to the cache under a new key when there is anything to
   save.
5. Set up Node from `.nvmrc`, `npm ci`, `npm run build` (without fixtures).
6. Upload `dist/` with `actions/upload-pages-artifact` and publish it with
   `actions/deploy-pages` in a separate job. Nothing is committed back to the repo.

**CI workflow, `.github/workflows/ci.yml`:** on every push and pull request, runs
lint, `astro check`, the Vitest suite and a build with `USE_FIXTURES=true`, plus
ruff, mypy and pytest. The pytest suite runs every parser against saved API
responses in `tests/fixtures/`, with no network access.

The build also generates `/rss.xml` (journal entries and recipes) and a sitemap.

---

## 7. Roadmap

1. ✓ Scaffold, tokens, fonts, header/footer, home page on fixture data.
2. ✓ Journal, lists and cooking pages, content schemas, example files.
3. ✓ Challenge map and `countries.yaml`.
4. ✓ Python fetchers, tests and the deploy workflow.
5. Mobile pass, accessibility pass (contrast, focus styles as a 2px accent
   outline offset 2px, alt text), Lighthouse ≥ 95 in every category.
