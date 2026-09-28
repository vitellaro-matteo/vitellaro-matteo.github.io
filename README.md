# a slow feed

Matteo's personal site: an Astro static site. The full design and behaviour spec
is in [SITE_SPEC.md](SITE_SPEC.md).

## Setup

Requires Node 22.12+.

```sh
npm install
npm run dev      # http://localhost:4321 — drafts and example files are visible here
npm run build    # static site in dist/ — drafts are left out
npm run preview  # serve dist/ locally
```

The data fetchers (added in a later phase) run on **Python 3.10+**; the GitHub
workflow uses 3.12.

## Where the blanks live

Every site-specific value lives in **[site.config.ts](site.config.ts)**, and nowhere else:

| Blank | Field in `site.config.ts` |
|---|---|
| `{{SITE_NAME}}` | `name` |
| `{{TAGLINE}}` | `tagline` |
| `{{HERO_TITLE}}` | `heroTitle` |
| `{{HERO_BIO}}` | `heroBio` |
| `{{SITE_URL}}` | `url` |
| `{{TIMEZONE}}` | `timezone` |
| `{{SPOTIFY_PLAYLIST_ID}}` | `spotifyPlaylistId` |
| `{{LETTERBOXD_USERNAME}}` | `letterboxdUsername` |
| `{{GOODREADS_USER_ID}}` | `goodreadsUserId` |
| `{{INSTAGRAM_USERNAME}}` | `instagramUsername` |
| `{{GITHUB_USERNAME}}` | `githubUsername` |

Values still in CAPITALS are placeholders. Tokens (Spotify, Instagram, GitHub) are
GitHub Actions secrets, never files in the repo; how to create them will be
documented here with the fetchers.

## Editing content

Everything is checked against a schema when the site builds. A missing or wrong
field stops the build with a message naming the file and the field.

Each content type has one example file marked `draft: true`. Drafts show in
`npm run dev` but are never published. Copy the example, rename it, fill it in,
and remove `draft: true` (or set it to `false`) to publish.

### The "now" box

Edit [src/data/now.yaml](src/data/now.yaml): `on_repeat`, `thinking_about`,
`updated` (a date), and optionally `reading` (left empty, it uses the current
Goodreads book) and `progress: { page, of }` (shows a progress bar on the reading card).

### A journal post

Copy [src/content/journal/example-entry.mdx](src/content/journal/example-entry.mdx)
to `src/content/journal/<slug>.mdx`. The file name becomes the URL
(`/journal/<slug>`).

Frontmatter: `title`, `date`, `lead`, `summary`, `tags` (list), `draft`.

The body is Markdown. These components work without importing anything:

- `<Track id="…" />` — a Spotify track. The id is looked up in the weekly
  playlist feed; for a track that has left the playlist, add
  `title="…" artist="…"` (and optionally `cover="/media/…"`). `label="…"`
  replaces the default "from last week's finds".
- `<Film title="…" year={1997} director="…" url="…" poster="/media/…" />`
- `<Book title="…" author="…" url="…" cover="/media/…" />`
- `<Recipe slug="…" />` — one of your recipes, by file name.
- `<Aside>…</Aside>` — a margin note. Put it on its own line **directly before**
  the paragraph it belongs to.

### A recipe

Copy [src/content/recipes/example-recipe.mdx](src/content/recipes/example-recipe.mdx)
to `src/content/recipes/<slug>.mdx` (URL: `/cooking/<slug>`).

Frontmatter: `title`, `date`, `lead`, `source_name`, `source_url`, `country`,
`challenge` (optional), `time`, `serves`, `again` (`yes` / `no` / `maybe`),
`image`, `draft`.

- Put the photo in `public/media/…` and set `image: /media/…`.
- `challenge: <iso_n3>` (e.g. `380`) marks that country as cooked in the
  around-the-world challenge.
- Always credit and link the source. Don't copy its method; write your own notes.
- The body can have `## What I changed`, an ingredients list, and your notes:

  ```mdx
  <Ingredients>
    <Ingredient qty="200 g">plain flour</Ingredient>
  </Ingredients>
  ```

### A year's list

Copy [src/content/lists/example.yaml](src/content/lists/example.yaml) to
`src/content/lists/<YEAR>.yaml` (e.g. `2025.yaml`; the file name must be the
year). It needs exactly ten `songs`, `albums`, `films` and `books`, each with
`title`, `creator`, `note` and `image`. Cover images go in `public/media/…`:
square for songs and albums, 2:3 for films and books. The home page links to the
latest year.

## Git

Automated data commits land on `main` (from the workflow added in a later phase),
so pull with `git pull --rebase` before pushing.
