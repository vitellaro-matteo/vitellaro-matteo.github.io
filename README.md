# a slow feed

A personal site that collects what I listen to, watch, read, photograph, build
and cook, one quiet shelf at a time.

**Live:** [vitellaro-matteo.github.io](https://vitellaro-matteo.github.io/) (launching soon)

[![CI](https://github.com/vitellaro-matteo/vitellaro-matteo.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/vitellaro-matteo/vitellaro-matteo.github.io/actions/workflows/ci.yml)

![The home page](docs/screenshot.png)

## Features

- **Home page** of cards for listening, watching, reading, photos, code and
  cooking, built from typed feed data. A card whose feed is missing is left out
  rather than showing stale or sample data.
- **Journal** of notes and essays in MDX, with embeddable tracks, films, books
  and recipes, and margin notes that sit beside the paragraph they annotate.
- **Cooking log** of recipes followed from elsewhere, always credited, with my
  own notes and what I changed.
- **Around-the-world challenge:** one national dish for each of 195 countries,
  on an Equal Earth world map rendered to static SVG at build time, with
  keyboard-accessible tooltips and a full list by continent.
- **Yearly top tens** of songs, albums, films and books.
- **RSS feed and sitemap.** All content is validated at build time: a typo in
  frontmatter or in the country list fails the build with a clear message.

## How the data flows

```mermaid
flowchart LR
  subgraph Sources
    S[Spotify API]
    L[Letterboxd RSS]
    G[Goodreads RSS]
    I[Instagram API]
    H[GitHub GraphQL]
  end
  subgraph Deploy workflow
    F[Python fetchers<br/>scripts/] --> J[Feed JSON + images<br/>build workspace only]
    J --> A[Astro build]
    C[Content<br/>MDX + YAML] --> A
  end
  S & L & G & I & H --> F
  A --> P[GitHub Pages]
```

Feeds are fetched at deploy time and never committed. The fetchers and the
deploy workflow are the next step on the [roadmap](#roadmap); until then the
feed cards run on sample fixtures in development and CI, and production builds
leave them out.

## Design system

A warm, paper-like palette, one serif for display, one sans for reading and a
mono for metadata. The full specification, with every value and page layout,
is in **[docs/DESIGN.md](docs/DESIGN.md)**.

| Token      | Hex       | Use                                     |
| ---------- | --------- | --------------------------------------- |
| `--paper`  | `#F3EFE7` | Page background                         |
| `--card`   | `#FAF8F4` | Card background                         |
| `--kraft`  | `#E6DECF` | Bands, placeholders, uncooked countries |
| `--line`   | `#DDD5C6` | Borders and rules                       |
| `--ink`    | `#2A2724` | Text                                    |
| `--muted`  | `#5F5850` | Secondary text                          |
| `--accent` | `#9C4A32` | Labels, active states, cooked countries |

| Role    | Typeface            | Sizes                                        |
| ------- | ------------------- | -------------------------------------------- |
| Display | Shippori Mincho 400 | 72 · 56 · 50 · 40 · 32 · 26 · 22 · 20 · 18px |
| Body    | Instrument Sans 400 | 18 · 16 · 15 · 14px                          |
| Meta    | IBM Plex Mono 400   | 12px, 0.06em tracking, always lowercase      |

**Principles:** no radii, shadows, gradients, emoji or icons; one accent colour;
hover changes colour and nothing else; every image has a kraft placeholder behind
it; touch targets are at least 44px.

## Tech stack

- **[Astro](https://astro.build)**: static output, content collections, MDX
- **TypeScript** (strict) and **Zod** schemas for all content and data files
- **Plain CSS** with custom properties; no UI framework
- **d3-geo, topojson-client and topojson-simplify** for the build-time SVG map
- **Vitest** for the TypeScript helpers; ruff, mypy (strict) and pytest set up
  for the Python fetchers
- **ESLint** (typescript-eslint, astro, jsx-a11y) and **Prettier**
- **GitHub Actions** for CI, **GitHub Pages** for hosting

## Project structure

```
.
├── site.config.ts          every site-specific value
├── astro.config.ts
├── src/
│   ├── components/         layout pieces, home cards, map, MDX embeds
│   ├── content/            journal posts, recipes, yearly lists
│   ├── content.config.ts   Zod schemas for all content
│   ├── data/               now.yaml, countries.yaml, sample feed fixtures
│   ├── layouts/            the page shell
│   ├── lib/                typed, tested helpers (dates, paths, feeds, map, …)
│   ├── pages/              routes and the RSS feed
│   └── styles/             design tokens and global CSS
├── scripts/                Python fetchers
├── public/media/           photos and cover art
├── docs/                   DESIGN, CONTENT and SETUP guides
└── .github/workflows/      CI
```

## Decisions

- **Static over SSR.** Everything on the site changes at most once a day, so a
  daily static build is simpler, faster and free to host. There is no server to
  keep alive or secure.
- **Feeds fetched at build time, not committed.** Committing daily data would
  bury real changes under bot commits and force a rebase before every push.
  Fetching in the deploy workflow keeps history clean. Committed fixtures keep
  development and CI working without secrets, but never reach production.
- **No UI framework.** The site ships almost no JavaScript (list tabs and the
  map tooltip so far), so plain CSS and Astro components are enough. The design
  system is a handful of custom properties rather than a dependency.
- **Build-time map rendering.** The world map is simplified, projected and
  written as compact SVG paths during the build. Visitors get about 45 KB of
  inline SVG (26 KB gzipped for the whole challenge page) instead of a map
  library plus 750 KB of country geometry.
- **One place for configuration.** Every username, URL and path lives in
  `site.config.ts`, and every internal link goes through one path helper, so
  moving the site to a sub-path or a custom domain is a one-line change.

## Roadmap

- [x] Design system, home page, journal, lists and cooking pages
- [x] Around-the-world map and challenge page
- [ ] Python fetchers and the deploy workflow (daily refresh, cached fallbacks)
- [ ] Mobile layout and accessibility pass (Lighthouse ≥ 95)

## Quick start

```sh
npm install
npm run dev
```

Open <http://localhost:4321/>. See [docs/SETUP.md](docs/SETUP.md) for
configuration and secrets, and [docs/CONTENT.md](docs/CONTENT.md) for writing
posts, recipes and lists.

## License

[MIT](LICENSE) © Matteo Vitellaro
