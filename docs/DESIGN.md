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

| Value                                                                 | Where           | Notes                                                                             |
| --------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| `SITE_NAME`                                                           | site.config.ts  | `matteo` (lowercase wordmark)                                                     |
| `TAGLINE`                                                             | site.config.ts  | `my feed`                                                                         |
| `HERO_TITLE`                                                          | site.config.ts  | `A shelf for the things I keep finding.`                                          |
| `HERO_BIO`                                                            | site.config.ts  | 1–2 sentences about Matteo                                                        |
| `SITE_URL`                                                            | site.config.ts  | `https://vitellaro-matteo.github.io` (origin only)                                |
| `BASE_PATH`                                                           | site.config.ts  | `/`: the repo is `vitellaro-matteo.github.io`, which Pages serves from the root   |
| `TIMEZONE`                                                            | site.config.ts  | `Europe/Berlin` (week numbers and dates)                                          |
| `SPOTIFY_PLAYLIST_ID`                                                 | site.config.ts  | the "last week's finds" playlist: the id, or its share link (`?si=…` is stripped) |
| `LASTFM_USERNAME`                                                     | site.config.ts  | for the now box's "on repeat" and "most played" rows and the footer's `last.fm ↗` |
| `LETTERBOXD_USERNAME`                                                 | site.config.ts  |                                                                                   |
| `GOODREADS_USER_ID`                                                   | site.config.ts  | numeric id from the profile URL                                                   |
| `GITHUB_USERNAME`                                                     | site.config.ts  |                                                                                   |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` | Actions secrets | same kind as in the WeeklySpotifyUpdate repo                                      |
| `LASTFM_API_KEY`                                                      | Actions secret  | a free Last.fm API key, for user.getTopTracks and user.getTopArtists              |
| `GH_STATS_TOKEN`                                                      | Actions secret  | fine-grained PAT, read-only, for the contribution calendar                        |

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
- **Build-time images:** `opentype.js` turns text in the site's own fonts into
  outlines and `@resvg/resvg-js` rasterises the SVG, for the favicon PNGs and the
  share cards (§3, Head and share images). No headless browser, no system fonts.
- **Hosting:** GitHub Pages via `actions/deploy-pages`.
- **Client JavaScript** is limited to the song previews (listening card and now
  box), the lists-page tabs, the map tooltips and the menu below desktop width,
  each a few dozen lines with no dependencies. Everything else is static HTML.
  The previews are the only thing that talks to another site from the page, and
  only when a preview is pressed.

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

### Contrast

Every text and background pair the site uses, with its WCAG 2.2 contrast ratio.
All of them pass AA (4.5:1 for text, 3:1 for large text and graphics) with the
tokens as they are; none needed changing. `src/lib/contrast.ts` lists the pairs
and its test reads the values from `tokens.css`, so a token change that breaks a
pair fails `npm test`.

| Foreground  | Background | Ratio   | Needs | Where                                                        |
| ----------- | ---------- | ------- | ----- | ------------------------------------------------------------ |
| `--ink`     | `--paper`  | 12.95:1 | 4.5   | body text, headings, nav, footer wordmark                    |
| `--ink`     | `--card`   | 14.00:1 | 4.5   | card text, tile titles, map tooltip                          |
| `--ink`     | `--kraft`  | 11.11:1 | 4.5   | now box values, lists band heading and tiles                 |
| `--muted`   | `--paper`  | 6.11:1  | 4.5   | bio, page intro text, meta, footer links                     |
| `--muted`   | `--card`   | 6.60:1  | 4.5   | artists, authors, dates, source links, notes                 |
| `--muted`   | `--kraft`  | 5.24:1  | 4.5   | now box labels, plays and `updated` line, its `▶︎`, band text |
| `--accent`  | `--paper`  | 5.32:1  | 4.5   | labels, current nav item, hover, the challenge count         |
| `--accent`  | `--card`   | 5.76:1  | 4.5   | card labels, the listening `■`, the #1 numeral               |
| `--accent`  | `--kraft`  | 4.57:1  | 4.5   | lists and challenge band labels, the now box's `■`           |
| `--numeral` | `--paper`  | 3.43:1  | 3     | list numerals 02–10 (display 32–56px, large text)            |
| `--accent`  | `--kraft`  | 4.57:1  | 3     | cooked countries against uncooked ones on the map (graphic)  |
| `--accent`  | `--paper`  | 5.32:1  | 3     | the focus outline (graphic; 5.76:1 on cards)                 |

Two graphics sit below 3:1 on purpose, because neither is the only way to get
their information: the contribution calendar's lighter levels (accent at 30% and
60% on card, 1.56:1 and 2.61:1) decorate an image whose name gives the total
(`N contributions in the last 52 weeks`), and uncooked countries (`--kraft`,
1.26:1 on card) are listed in full, by continent, under the map. Borders and
rules (`--line`, `--line-soft`) are decorative.

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
  icons**, except the one inline stroke SVG (the menu button). The preview
  controls are text glyphs, `▶︎` (U+25B6 + U+FE0E, so iOS keeps it as text) and
  `■` (U+25A0), drawn as CSS generated content so they are never part of the
  button's text (its `aria-label` names it; a visible `▶︎` in the text reads to
  accessibility checkers as a label missing from the name).
- Links are ink with no underline; hover turns them `--accent`. No other hover
  effects, no transition longer than 120ms, no scroll animations.
- **Links inside journal and recipe body text** are the exception: underlined,
  1px thick, 3px offset, underline colour `--kraft-3`; on hover both the text and
  the underline turn `--accent`. Navigation, card, embed and meta links keep the
  plain style.
- External links end with ` ↗` (a text glyph). Internal "more" links end with ` →`.
  The footer's `rss` link is internal and has no glyph.
- Touch targets are at least 44px tall.
- **Focus:** every focusable element shows a 2px `--accent` outline, offset 2px
  (`:focus-visible`), on the whole element, e.g. a whole film tile. Taps show no
  browser tap highlight; hover and focus colours are the feedback.
- Images always have a `--kraft` / `--kraft-2` / `--kraft-3` background behind
  them while loading, and use `object-fit: cover`. With no image, the kraft box
  stands in for it.
- Light mode only.

### Layout

- Container 1120px wide, centred; below a 1200px viewport, 40px side padding;
  below 768px, 24px.
- 12-column grid, `column-gap: 32px` (row gap 32px for card grids).
- **Breakpoints:** desktop from 1024px; **tablet** 768–1023px; **mobile** below
  768px. Below desktop every 12-column grid becomes a single column (twelve
  columns would still reserve eleven 32px gaps, wider than a phone). §4.9 has the
  details.

### Components

- **Header:** 112px tall, `border-bottom: 1px solid var(--line)`. Left: the
  wordmark (display 28px) and the tagline (mono, muted), baseline-aligned, gap
  14px; the whole thing links home. Right: nav in body 15px, gap 30px:
  `listening · watching · reading · making · cooking · journal · lists`.
  The first five are anchors to the home-page sections; journal and lists link to
  their pages. On the journal, lists and cooking pages the matching item is
  `--accent`. Below desktop the nav becomes the menu (§4.9).
- **Section heading:** display 32px `<h2>` on the left, mono muted meta on the
  right, baseline-aligned, `padding-bottom: 20px; border-bottom: 1px solid var(--ink)`;
  content starts 40px below.
- **Card:** `background: var(--card); border: 1px solid var(--line); padding: 36px;`
  flex column, gap 24px. Card header: a left stack (gap 10px) of the mono label in
  accent (`0N — name`) and a display 26px `<h3>`; on the right a mono muted source
  link (`spotify ↗`, `letterboxd ↗`, …) vertically centred in a 44px box.
- **Media tile** (films and books): one link wrapping the 2:3 cover, the title
  (body 14px) and a mono muted meta line. Hover turns the title `--accent`, with
  no image effect; focus outlines the whole tile. It opens the Letterboxd entry
  or Goodreads book page in the same tab. Its accessible name starts with the
  visible title (WCAG 2.5.3, label in name) and goes on with visually hidden
  words in place of the symbol-heavy meta line, which is `aria-hidden`:
  `Title (year), rated N stars, on Letterboxd` or `Title by Author, on
Goodreads`. The cover's alt text is empty, since the link names it.
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
  Right: mono muted links, gap 24px: spotify, last.fm, letterboxd, goodreads,
  github, rss. The last.fm link is left out while `LASTFM_USERNAME` is still a
  placeholder (`isFilled` in `src/lib/config.ts`).

### Formats

- Dates: `D mon YYYY`, e.g. `21 sep 2026`, in `TIMEZONE`.
- Week meta: `week NN · D–D mon YYYY`; across months `29 sep–5 oct 2026`;
  across years `29 dec 2025–4 jan 2026`.
- Relative time: `40m ago`, `5h ago`, `3d ago`.
- Tags: joined with `, `.
- Reading time: word count at 200 words a minute, shown as `N min`.

### Head and share images

Every page's `<head>` (in `src/layouts/Base.astro`) carries:

- `<title>`: `Page title — matteo`, or `matteo — TAGLINE` on the home page;
  a meta description (the entry's summary, the recipe's lead, the page intro's
  text, or `HERO_TITLE`); a canonical URL on `SITE_URL`; the RSS alternate link;
  `theme-color` `--paper`.
- **Favicon:** a lowercase `m` in Shippori Mincho 400, `--ink` on a `--paper`
  square, fitted to 26 of 32px so it stays legible at 16px. `/favicon.svg`, with
  a `/favicon-32.png` fallback and a 180px `/apple-touch-icon.png`.
- **Open Graph and Twitter card** (`summary_large_image`): `og:type` `article`
  for journal entries and recipes, `website` elsewhere; title, description, URL,
  site name, and a share image with its size and alt text.
- **Share images:** one 1200×630 PNG per page type, generated at build time as
  `/og/TYPE.png` (`src/lib/brand.ts`, `src/lib/og.ts`). Paper background; the
  wordmark (display 48px, ink) and tagline (mono 20px, muted) at the top over a
  1px `--line` rule, like the header; at the bottom left, 80px from the edges,
  the mono accent label (24px) over the title in display 84px / 1.1, ink,
  wrapped to the width.

  | Type        | Used by                        | Label              | Title                      |
  | ----------- | ------------------------------ | ------------------ | -------------------------- |
  | `home`      | the home page and the 404 page | `hello`            | `HERO_TITLE`               |
  | `journal`   | the journal index and entries  | `journal`          | `Notes & essays`           |
  | `lists`     | the lists pages                | `lists`            | `Top tens, every December` |
  | `cooking`   | the cooking index and recipes  | `cooking`          | `What I've been cooking`   |
  | `challenge` | the around-the-world page      | `around the world` | `One dish, every country`  |

- `/robots.txt` allows everything and points to the sitemap, which leaves out
  the 404 page.

---

## 4. Pages

### 4.1 Home `/`

1. Header.
2. **Hero:** `padding: 128px 0 120px`, 12-column grid, items aligned to the bottom.
   - Left, span 8, gap 32px: mono accent `hello`; `<h1>` display 56px / 1.28
     `HERO_TITLE`; `<p>` body 18px / 1.7 muted, max-width 580px, `HERO_BIO`.
   - Right, span 4: the **now box**, kraft background, padding 32px, gap 18px:
     mono muted `now`; up to three rows (body 15px, muted label left, value right),
     all automatic:
     - `on repeat`: my most played track of the last seven days on Last.fm,
       `Title — Artist`, followed by a **preview button** (the listening
       card's, below) when Deezer has the song, gap 4px, vertically centred on
       the text. The now box has no progress line; `■` shows that it plays;
     - `most played`: my most played artist of the last seven days on Last.fm: a
       48×48 square photo (`--kraft-2` while loading or when there is none, so
       it shows on the kraft box), then 12px to its right the name, body 15px,
       over mono muted `N plays this week` (`1 play this week`), which never
       breaks. When the photo, name and count don't fit beside the label (the
       desktop box is 229–288px wide inside), they wrap under it, still
       right-aligned (8px row gap); at phone and tablet widths they sit beside it;
     - `reading`: the first book on the Goodreads currently-reading shelf,
       `Title — Author`.

     Then mono muted `updated [date]` with `padding-top: 14px; border-top: 1px
solid var(--kraft-3)`: the date of the newest successful fetch behind the
     rows shown. A row without data is hidden; with none, there is no box and
     the hero text spans all 12 columns. `nowBox` in `src/lib/now.ts` builds it.
     The now box's preview shares the page's one player with the listening
     card: starting either stops the other.
3. **Section heading** `This week`, meta `week NN · D–D mon YYYY`: the previous
   ISO week (Mon–Sun) in `TIMEZONE`, matching the playlist.
4. **Card grid** (12 columns, gap 32px), in this order and, with every card
   visible, these rows: listening 7 + watching 5, reading 5 + making 7,
   journal 5 + cooking 7.
   - **01 — listening**, h3 `last week's finds`, link `spotify ↗`. Up to 10 rows,
     grid `44px 1fr auto 44px`: the index (mono muted, a plain number), track
     title body 16px, artist body 15px muted, and the **preview button**. A row
     without a preview gets an empty 44px cell there, so the columns line up.
     While a row's preview plays, a 2px `--accent` line grows along its bottom.
     **Preview button** (`src/components/PreviewButton.astro`, used here and in
     the now box): a 44×44 `<button>`, `▶︎` in `--muted` (`--accent` on hover),
     `■` in `--accent` while playing; negative block margins keep a 44px target
     from making a one-line row taller. Its `aria-label` is `Play preview of
Title by Artist` and stays the same while playing; `aria-pressed` carries
     the state. Every preview button on the page shares one player: one preview
     plays at a time, starting another stops the first, a preview ends at 30
     seconds or when the clip ends, and nothing autoplays.
     **Fresh URLs:** Deezer's preview URLs are signed (`?hdnea=exp=…`) and
     expire exactly 15 minutes after the API issues them; the CDN then answers 403. So a row stores only the Deezer track id (`data-deezer`), and each
     press asks `https://api.deezer.com/track/ID` for a freshly signed URL.
     Deezer's API sends no CORS headers, so the request is JSONP
     (`output=jsonp`), loaded by `src/lib/deezer.ts`: every call gets its own
     callback name, gives up after 8 seconds, and removes its script and
     callback when it settles (a timed-out call leaves a no-op that removes
     itself if the answer comes late). The id and callback name are validated
     before they go into the URL, and only an `https` URL on `*.dzcdn.net` is
     ever played. Nothing is requested before the first press.
     While the URL loads the row already shows the playing state (`■`, pressed),
     with the progress line starting once audio does. Because Safari only lets
     audio start inside the tap itself, the press first plays 10ms of inline
     silence to unlock the audio element, then switches to the preview. If the
     fetch fails, times out, returns no preview, or the clip won't play, the
     button is replaced by the empty cell (and the row's progress line removed).
     A browser that blocks playback outright (`NotAllowedError`) only stops, and
     the button stays. Rows without a Deezer match have the empty cell.
     Under the list, body 14px muted: `30-second previews via Deezer. Full songs
on Spotify ↗` (the second part links to the playlist; only when some row
     has a preview), then `Every Monday, the songs I liked the week before move
into one playlist.`
   - **02 — watching**, h3 `recently watched`, link `letterboxd ↗`. The 3 most
     recent films as media tiles in a 3-column grid, gap 16px, meta
     `YEAR · ★ RATING` (the rating part is left out when there is none). Below,
     with `padding-top: 20px; border-top: 1px solid var(--line-soft)`: the first
     sentence of the latest review in “curly quotes”, display 18px / 1.6 (hidden
     when there is no review).
   - **03 — reading**, h3 `on the nightstand`, link `goodreads ↗`. When I'm
     reading something, the first book on that shelf comes first as one link:
     cover 120×180 and, 24px to its right, a bottom-aligned stack (gap 8px) of
     mono muted `now`, title display 20px and author body 15px muted. Below,
     divided by line-soft: mono muted `finished lately`, then the six most
     recently finished books as media tiles in a 3-column grid, gap 16px, meta
     `★ N` (left out when unrated).
   - **04 — making**, h3 `on github`, link `github ↗`. Contribution calendar of
     the last 52 weeks: columns of 7 squares, 12×12, gap 3px, aligned right in a
     box one column tall (102px) with overflow hidden. Weeks run right to left
     from the newest, and those that don't fit wrap onto a hidden second line,
     so the card shows the most recent whole weeks that fit at any width,
     including span 5 and phones. Level 0 is `--kraft`; levels 1/2/3 are
     `--accent` at opacity 0.3/0.6/1, split by quartiles of the non-zero days
     (up to Q1 → 1, up to Q3 → 2, above Q3 → 3). Below: 2–3 rows, grid
     `200px 1fr auto`: repo name body 15px (plain text), latest commit message
     muted, mono muted relative time.
   - **05 — journal**, h3 `notes & essays`, link `all →` to `/journal`. The 3
     latest entries, each row a link: mono muted date, display 19px title.
   - **06 — cooking**, h3 `last cooked`, link `all →` to `/cooking`. A compact
     card: the mini world map (§4.7 styling, no tooltips) at full card width;
     below it (gap 16px) the latest recipe as one link, a 120×90 photo and, 16px
     to its right, mono muted `DATE · COUNTRY` over a display 20px title; then,
     divided by line-soft, display 32px `N` in accent + body 15px muted
     ` / 195 national dishes` and a right-aligned mono link `the challenge →`.

   **When feed cards are hidden** (§6), the visible cards keep their order and
   are packed into rows of two. Rows alternate 7 + 5 and 5 + 7, except that the
   last full row is always 5 + 7, so the card that closes the grid (cooking) gets
   the wide slot. A card left alone on the last row spans all 12 columns, and its
   content keeps the width it would have at span 7, aligned left. `packCards` in
   `src/lib/layout.ts` does the packing.

5. **Lists band** (kraft band, `margin-top: 96px`). Left, span 5, gap 18px: mono
   accent `07 — lists`, display 40px / 1.25 `Top tens, every December`, body 16px
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

### 4.8 Not found `/404`

GitHub Pages serves `404.html` for any unknown path. It uses the page-intro
pattern (§4.4): mono accent `404`, h1 `Nothing on this shelf`, no right-hand
text. Below, body 16px / 1.7 muted `This page doesn't exist, or it moved.`, then
a mono muted `back home →` link (44px tall) to `/`, with 112px before the
footer.

### 4.9 Tablet and mobile

Checked on every page at 360, 390, 768 and 1024px wide: no horizontal scrolling,
nothing overflows its card or the viewport, touch targets are at least 44px
(except the shapes inside the map, whose continent list is the full-size
alternative), and the previews, the lists tabs and the map tooltips work by touch.

**Below desktop (under 1024px, tablet and mobile):**

- Every 12-column grid is a single column: the cards stack, the now box moves
  under the hero text (row gap 40px), and bands stack their two halves (row gap
  32px). The span-7 content limit of a lone card no longer applies.
- **Header** 72px tall: wordmark display 24px on the left, a menu button on the
  right (44×44, the inline stroke SVG of two lines, `aria-label="Open menu"`,
  `aria-expanded`, `aria-controls="site-menu"`). The bar nav is hidden: its seven
  items don't fit a 768px header. The button opens a full-screen, paper-coloured
  dialog (`role="dialog"`, `aria-modal`) with its own 72px bar (wordmark, and a
  mono `close` button) and the nav list in display 28px, items at least 56px
  tall, the current page in `--accent`. While it is open, focus is trapped in
  it, the page behind can't scroll, and focus starts on `close`. Escape and
  `close` shut it and return focus to the menu button; following a link shuts
  it too, and widening the window to desktop closes it.
- Hero `padding: 96px 0 88px`. Page intros stack (the right-hand text or count
  goes under the title), `padding: 72px 0 48px`, h1 56px.
- Journal entries and recipes: one column. The details become a wrapped row
  above the title (gap 16px 32px), h1 40px, and margin notes become indented
  blocks (`padding-left: 24px`).
- Lists page rows: `72px 104px 1fr`, numeral 48px, the note under the title.
- Kraft bands `padding: 40px`. Cooking recipe grid: 2 columns. Challenge list:
  3 columns.

**Mobile (under 768px), in addition:**

- Side padding 24px; mono 11px; the header tagline is hidden.
- Hero `padding: 56px 0 48px`, gap 20px, h1 display 32px / 1.35, bio body 16px;
  now box padding 24px. Section heading h2 24px (the meta wraps under it).
- Cards stack with a 16px gap and padding 24px; the card header is the mono label
  on the left and the source link on the right on one row, then the h3 display
  22px.
- Listening shows 5 rows as grid `32px 1fr 44px`, title 15px over artist 13px
  muted, and the preview button (or empty cell) at the right, centred on the
  two lines.
  Watching and reading tiles stay 3 columns, gap 10px. GitHub rows put the repo
  and the time on one line and the message (14px) below.
- Lists band padding 28px 24px, h2 26px, tiles 2 × 2.
- Page intros `padding: 48px 0 40px`, h1 40px / 1.15. Journal index rows stack
  (date, title 22px and summary 15px, tags). Entries: h1 32px, lead 19px, body
  17px, h2 24px, blockquote 22px with `padding-left: 20px`; embed cards padding
  16px; ingredient rows `88px 1fr`.
- Lists page rows `48px 72px 1fr`, numeral 32px, title 20px, tabs gap 24px.
- Cooking recipes: 1 column, gap 16px; the challenge band h2 26px. Challenge
  list: 2 columns, count 40px.
- Footer: the wordmark line above the links; links wrap, gap 16px.
- The map stays full width. On touch, a first tap on a country shows its
  tooltip, a second tap on a cooked country follows its link, and a tap anywhere
  else hides it. The tooltip is kept inside the map.

---

## 5. Content model

Everything below is edited by hand; the now box is filled from Last.fm and
Goodreads (§4.1). [CONTENT.md](CONTENT.md) is the how-to.

```
site.config.ts                  every value from §1
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
into `public/media/feeds/<name>/`. Images are never hotlinked, so a source's
CDN can't break the site. Files are named by a hash of a stable key (album id,
book id, …), so
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
   `[feeds] no lastfm feed: hiding the "on repeat" and "most played" rows of the now box`. A `<Track>` embed is
   likewise left out when the Spotify feed is missing.
3. **Fixtures never reach production.** The site reads fixtures only in
   `npm run dev` or when the build runs with `USE_FIXTURES=true` (CI does, so it
   exercises every card).

**The fetchers:**

- **spotify.py:** exchanges `SPOTIFY_REFRESH_TOKEN` for an access token, then
  reads the `SPOTIFY_PLAYLIST_ID` playlist with `GET /playlists/{id}/items`
  (id, title, artists, album cover of at least 300px, url). The setting may be
  the id, a share link or a URI; anything after `?` is stripped, because a
  leftover `?si=…` turns the request into a different one.
  **Previews:** Spotify no longer gives new apps preview clips, so each playlist
  track's 30-second preview is looked up on Deezer's public search API (no key,
  `scripts/deezer.py`, shared with lastfm.py):
  it searches `first artist + title without its version`, then takes the first
  result whose artist matches one of the track's artists and whose title matches
  exactly, or else matches once both titles lose their version suffix
  (`Song - Live` / `Song (Live)`). Titles and names are compared normalised:
  case, accents, punctuation and a leading "The" are ignored. Only results
  with a preview count. The match's Deezer track id is stored as `deezer_id`,
  or null when nothing matches or Deezer errors; never the preview URL, which
  expires 15 minutes after it's issued (the player fetches a fresh one, §4.1).
  A feed cached before this field has no `deezer_id`, so its rows show plain
  numbers until the next successful fetch. Requests are paced to stay under
  Deezer's 50 per 5 seconds. It also scans
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
  described without their value. Because Spotify answers `invalid_client` both for a
  wrong secret and for a refresh token from another app, a failed refresh with
  that error is followed by a client credentials check of the ID and secret
  alone, and the error names whichever it is. `python -m scripts.spotify --check` runs the
  same refresh and one playlist read locally, and `--dump` saves the raw
  playlist and track JSON to `.debug/spotify/` (gitignored) for comparing
  Spotify's real responses with the parser.
  The parser accepts the documented paging object, the whole playlist object
  with the paging nested under `items` (what a request with a stray `?si=…` in
  the id returns), and the pre-2026 `tracks` key. Every field is
  type-checked: local files, podcast episodes, removed tracks (`item: null`) and
  malformed entries are skipped with a warning naming the entry and the reason,
  so one odd entry never costs the feed. `<Track>` ids that aren't 22-character
  Spotify ids (like the draft example's placeholder) are skipped when scanning.
  When any fetcher fails unexpectedly, the log and a collapsible block in the step
  summary carry the full traceback, redacted, with repo-relative paths.
- **letterboxd.py:** RSS `https://letterboxd.com/LETTERBOXD_USERNAME/rss/`, the
  10 latest diary entries (lists are skipped): film title, year, member rating,
  watched date, poster and review text. Letterboxd's boilerplate paragraphs
  ("Watched on …", "This review may contain spoilers") are dropped, so an entry
  without a real review has none.
- **lastfm.py:** `user.getTopTracks` and `user.getTopArtists` for
  `LASTFM_USERNAME` with `period=7day`, `limit=1`, authenticated with
  `LASTFM_API_KEY`: title, artist, url and play count of my most played track of
  the week, and name, url and play count of my most played artist, each null for
  a silent week. The track is matched on Deezer exactly like a playlist track
  (above) and its `deezer_id` stored. Last.fm stopped serving artist images (its
  `image` entries are all the same grey star), so the artist is looked up on
  Deezer's artist search by name, taking the first result whose normalised name
  is the same; its `picture_medium` (250×250) is downloaded like any feed image,
  unless it is Deezer's placeholder for an artist without a photo (an empty
  image hash, `/images/artist//…`). A Deezer failure or no match only costs the
  preview or the photo, never the feed. Last.fm's own error code and message are
  reported; the key is never logged. A feed cached before these fields has no
  `deezer_id` or `top_artist`, so the row has no button, or is hidden, until the
  next successful fetch.
- **goodreads.py:** RSS `https://www.goodreads.com/review/list_rss/GOODREADS_USER_ID`
  with `?shelf=currently-reading` (every book on it), and `?shelf=read` sorted by
  finish date to keep the latest 6: title, author, the book page URL, the
  largest real cover (never the "no photo" placeholder) and my rating (Goodreads
  sends 0 for unrated, stored as null).
- **github.py:** GraphQL `contributionsCollection` from the Sunday 51 weeks
  before the current week until now (52 columns, under GitHub's one-year limit), authenticated with
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
lint, `astro check`, the Vitest suite and a sample build with `USE_FIXTURES=true`
(the sample feeds and the draft examples, as in `npm run dev`), plus ruff, mypy
and pytest. The pytest suite runs every parser against saved API
responses in `tests/fixtures/`, with no network access.

The build also generates `/rss.xml` (journal entries and recipes) and a sitemap.

**Actions and dependencies:** every action in both workflows is pinned to the
full commit SHA of its latest release, with the version in a comment
(`actions/checkout@<sha> # v7.0.1`), and all of them run on Node 24. Dependabot
(`.github/dependabot.yml`) checks GitHub Actions, npm and pip weekly, each
ecosystem in one grouped pull request, and keeps the SHA pins and their version
comments current.

---

## 7. Roadmap

1. ✓ Scaffold, tokens, fonts, header/footer, home page on fixture data.
2. ✓ Journal, lists and cooking pages, content schemas, example files.
3. ✓ Challenge map and `countries.yaml`.
4. ✓ Python fetchers, tests and the deploy workflow.
5. ✓ Mobile pass, accessibility pass (contrast, focus styles as a 2px accent
   outline offset 2px, alt text), Lighthouse ≥ 95 in every category, plus the
   favicon, share images, meta tags and 404 page.

**Lighthouse** 13.5 on a sample build (`USE_FIXTURES=true`), Edge headless,
29 Sep 2026. Scores are performance / accessibility / best practices / SEO:

| Page                         | Mobile                | Desktop               |
| ---------------------------- | --------------------- | --------------------- |
| `/`                          | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/journal/example-entry/`    | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/lists/example/`            | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/cooking/`                  | 99 / 100 / 100 / 100  | 100 / 100 / 100 / 100 |
| `/cooking/around-the-world/` | 98 / 100 / 100 / 100  | 100 / 100 / 100 / 100 |
