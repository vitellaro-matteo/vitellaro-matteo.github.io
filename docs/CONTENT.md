# Editing content

Everything on the site that isn't fetched automatically is a file in this repo.
You can write it in the CMS at `/admin`, from a phone or a laptop, or edit the
files by hand. Either way, every file is checked against a schema when the site
builds: a missing or wrong field stops the build with a message naming the file
and the field.

## Writing in the CMS

Open <https://vitellaro-matteo.github.io/admin/> and choose **Sign In Using
Access Token** (the token is set up once, see [SETUP.md](SETUP.md#cms-access-token)).
The browser remembers it.

- **Journal**, **Recipes** and **Lists** each have a **New** button. New entries
  start as drafts; turn **Draft** off to publish.
- **Save** commits straight to `main` with a message like
  `content(cooking): add ragu`, and the deploy workflow publishes it in a couple
  of minutes. A draft is committed too, but never shown on the site.
- **Photos:** tap the photo field, then **Upload**, and pick a photo from your
  phone. Before it is committed it is resized to at most 2400px on its long side
  and converted to WebP, so a 12 MP photo lands as a few hundred KB. It is saved
  in the entry's own folder, next to its text.
- **Inserting a song, a margin note or ingredients:** in the text, use **Insert**
  and pick **Song** (paste the song's Spotify share link), **Margin note** or
  **Ingredients** (a row per ingredient, quantity optional). The CMS writes the
  code for you.
- Type freely: a `{`, `}` or `<` in your text is escaped when you save, so it
  shows as typed instead of breaking the page.
- **Around the world** has every country's dish. Open a country to change its
  dish, then tick **Verified**.

The URL of a new entry comes from its title, lowercase with dashes: "Ragù alla
bolognese" becomes `/cooking/ragu-alla-bolognese/`. A list's URL is its year,
which you type when you create it.

### On your laptop, without committing

Run `npm run dev`, open <http://localhost:4321/admin/index.html> in Chrome, Edge
or another Chromium browser, choose **Work with Local Repository** and pick this
repository's folder. The CMS then reads and writes the files on disk and commits
nothing; review the changes with `git diff` and commit them yourself.

## Drafts and examples

Any entry with `draft: true` shows in `npm run dev` and in a sample build
(`USE_FIXTURES=true`, which CI uses), but never in the real built site.
Each content type has one example, marked as an example and set as a draft, to
copy from:

| Type         | Example                                        |
| ------------ | ---------------------------------------------- |
| Journal post | `src/content/journal/example-entry/index.mdx`  |
| Recipe       | `src/content/recipes/example-recipe/index.mdx` |
| Year's list  | `src/content/lists/example/index.yaml`         |

To add one by hand, copy the example's folder, rename it, fill it in, delete its
comment lines, and remove `draft: true` (or set it to `false`) to publish.

## Images

Every entry is a folder: its text (`index.mdx` or `index.yaml`) and its images
side by side, e.g.

```
src/content/recipes/ragu/
├── index.mdx
└── ragu.webp
```

and the entry names the image by its file name: `image: ragu.webp`. The build
optimises these images: it makes AVIF and WebP copies at the sizes the page
needs, so a large original costs visitors nothing. A missing file fails the
build.

The embeds `<Film>`, `<Book>` and `<Track>` take a `poster` or `cover` from
`public/media/…` instead, written as `/media/…`; there, never include the base
path, it is added for you.

## Journal posts

Create `src/content/journal/<slug>/index.mdx`. The folder name becomes the URL:
`/journal/<slug>/`.

```yaml
---
title: A title
date: 2026-09-01
lead: One or two sentences under the title, in the larger serif.
summary: The short line shown on the journal index.
tags: [music, walking]
draft: false
cover: cover.webp # optional: a photo above the text, in this folder
---
```

The body is Markdown. Links to other pages on the site start with a slash, e.g.
`[the cooking page](/cooking/)`; the base path is added automatically. Links in
body text are underlined.

The body is MDX, so by hand a literal `{`, `}` or a `<` that doesn't start a tag
has to be written as `\{`, `\}` or `\<` (the CMS does this for you).

### Embeds

These components work in any journal post or recipe without importing anything.
In the CMS, **Insert** writes `<Track>`, `<Aside>` and `<Ingredients>`; the
others are written by hand, or in the CMS's Markdown mode.

```mdx
<Track id="SPOTIFY_TRACK_ID" />
<Track id="SPOTIFY_TRACK_ID" label="on repeat in spring" />

<Film
  title="Film title"
  year={1997}
  director="Director"
  url="https://letterboxd.com/film/…/"
  poster="/media/films/poster.jpg"
/>

<Book
  title="Book title"
  author="Author"
  url="https://www.goodreads.com/book/show/…"
  cover="/media/books/cover.jpg"
/>

<Recipe slug="my-recipe" />
```

- `<Track>` looks the track up by its Spotify id. You can pass `title="…"`,
  `artist="…"` and `cover="/media/…"` to override what the feed says.
- `<Recipe>` takes the folder name of one of your recipes.
- Every embed accepts `label="…"` to replace its small accent label.

### Tracks that left the playlist

The Spotify fetcher also fetches every track embedded anywhere in `src/content`
by its id, so `<Track id="…" />` keeps working on its own after the song leaves
the weekly playlist. The id is the last part of the song's share link:
`open.spotify.com/track/<id>` (the CMS takes the whole link). A new embed shows
up after the next deploy; in `npm run dev` and in CI only tracks in the sample
feed resolve, and any other `<Track>` is left out, so pass `title` and `artist`
while drafting if you want to preview it.

### Margin notes

```mdx
<Aside>A note in the margin.</Aside>

The paragraph the note belongs to.
```

Put the `<Aside>` on its own line **directly before** the paragraph it belongs to.
It sits in the right-hand margin, level with that paragraph.

## Recipes

Create `src/content/recipes/<slug>/index.mdx` (URL: `/cooking/<slug>/`) with the
photo in the same folder.

```yaml
---
title: Ragù
date: 2026-09-01
lead: One or two sentences about the dish and why you made it.
source_name: Marcella Hazan
source_url: https://example.com/recipe
country: Italy
challenge: '380' # optional: the country's iso_n3 code from countries.yaml
time: 4 hours
serves: 6
again: yes # yes / no / maybe
image: ragu.webp
draft: false
---
```

Always credit and link the source, and never copy its method: write your own
notes. The body usually has three parts, all optional:

```mdx
## What I changed

A few lines on what you did differently.

## Ingredients

<Ingredients>
  <Ingredient qty="500 g">minced beef</Ingredient>
  <Ingredient qty="1">onion</Ingredient>
</Ingredients>

## Notes

How it went.
```

Setting `challenge` marks that country as cooked in the around-the-world
challenge, colours it on the map and links it to this recipe. In the CMS it is a
searchable list of "Country — dish".

## A year's list

Create `src/content/lists/<YEAR>/index.yaml`, e.g. `2025/index.yaml`; the folder
name must be the year. While it is a draft it can hold up to ten entries in each
of `songs`, `albums`, `films` and `books`; once published it needs exactly ten of
each:

```yaml
draft: false
songs:
  - title: Song title
    creator: Artist
    note: One line on why it stayed.
    image: song-01.webp
  # …nine more
albums:
  # …ten entries
films:
  # …ten entries
books:
  # …ten entries
```

Cover images live in the list's folder. They are square for songs and albums and
2:3 for films and books. The home page always links to the latest year.

## The "now" box

Nothing to edit: it fills itself on every deploy. "on repeat" is your most
played track of the last seven days on Last.fm, with a play button when Deezer
has the song; "most played" is your most played artist of the week, with their
photo from Deezer and your play count; and "reading" is the first book on your
Goodreads currently-reading shelf. A row without data is hidden, and with none
there is no box. To change what "reading" shows, change the shelf on Goodreads.

## The around-the-world challenge

`src/data/countries.yaml` lists 195 countries (the 193 UN members, the Holy See
and Palestine):

```yaml
- iso_n3: '380' # ISO 3166-1 numeric code, always quoted
  name: 'Italy'
  continent: Europe # Africa, Americas, Asia, Europe or Oceania (UN M49 regions)
  dish: 'Pizza Margherita'
  dish_verified: false
  note: 'no official national dish; most cited' # optional
```

- The dishes are seeded with the most commonly cited national dish. Where a
  country has no clear one, `note` says so. Check each entry, change `dish` if
  you disagree, and set `dish_verified: true` (in the CMS: **Around the world**).
- A country counts as cooked once a recipe has `challenge: '<its iso_n3>'`. A
  code that isn't in this file fails the build.
- The build checks that there are exactly 195 entries with unique codes.
- Every country must be in the map geometry or have a `centroid: [lon, lat]`;
  it is then drawn as a small dot. Tuvalu is the only one that needs it today.
  Countries too small to see on the map get a dot automatically.
- The CMS can change dishes, notes and **Verified**, but not codes, names,
  continents or dots. Saving from the CMS rewrites the file in its own layout,
  without the comments.
