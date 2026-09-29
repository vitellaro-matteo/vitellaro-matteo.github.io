# Editing content

Everything on the site that isn't fetched automatically is a file in this repo.
Every file is checked against a schema when the site builds: a missing or wrong
field stops the build with a message naming the file and the field.

Run `npm run dev` while editing to see changes live at `http://localhost:4321/`.

## Drafts and examples

Any entry with `draft: true` shows in `npm run dev` but never in the built site.
Each content type has one example file, marked as an example and set as a
draft, to copy from:

| Type         | Example                                  |
| ------------ | ---------------------------------------- |
| Journal post | `src/content/journal/example-entry.mdx`  |
| Recipe       | `src/content/recipes/example-recipe.mdx` |
| Year's list  | `src/content/lists/example.yaml`         |

Copy the example, rename it, fill it in, delete its comment lines, and remove
`draft: true` (or set it to `false`) to publish.

## Images

Put your photos in `public/media/…` (for example `public/media/recipes/ragu.jpg`)
and refer to them as `/media/recipes/ragu.jpg`. The build fails if the file
doesn't exist. Never include the base path; it is added for you.

## Journal posts

Create `src/content/journal/<slug>.mdx`. The file name becomes the URL:
`/journal/<slug>/`.

```yaml
---
title: A title
date: 2026-09-01
lead: One or two sentences under the title, in the larger serif.
summary: The short line shown on the journal index.
tags: [music, walking]
draft: false
---
```

The body is Markdown. Links to other pages on the site start with a slash, e.g.
`[the cooking page](/cooking/)`; the base path is added automatically. Links in
body text are underlined.

### Embeds

These components work in any journal post or recipe without importing anything.

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
- `<Recipe>` takes the file name of one of your recipes.
- Every embed accepts `label="…"` to replace its small accent label.

### Tracks that left the playlist

The Spotify fetcher also fetches every track embedded anywhere in `src/content`
by its id, so `<Track id="…" />` keeps working on its own after the song leaves
the weekly playlist. The id is the last part of the song's share link:
`open.spotify.com/track/<id>`. A new embed shows up after the next deploy; in
`npm run dev` only tracks in the sample feed resolve, so pass `title` and
`artist` while drafting if you want to preview it.

### Margin notes

```mdx
<Aside>A note in the margin.</Aside>

The paragraph the note belongs to.
```

Put the `<Aside>` on its own line **directly before** the paragraph it belongs to.
It sits in the right-hand margin, level with that paragraph.

## Recipes

Create `src/content/recipes/<slug>.mdx` (URL: `/cooking/<slug>/`).

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
image: /media/recipes/ragu.jpg
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
challenge, colours it on the map and links it to this recipe.

## A year's list

Create `src/content/lists/<YEAR>.yaml`, e.g. `2025.yaml`; the file name must be
the year. It needs exactly ten entries in each of `songs`, `albums`, `films` and
`books`:

```yaml
songs:
  - title: Song title
    creator: Artist
    note: One line on why it stayed.
    image: /media/lists/2025/song-01.jpg
  # …nine more
albums:
  # …ten entries
films:
  # …ten entries
books:
  # …ten entries
```

Cover images are square for songs and albums and 2:3 for films and books. The
home page always links to the latest year.

## The "now" box

Nothing to edit: it fills itself on every deploy. "on repeat" is your most
played track of the last seven days on Last.fm, and "reading" is the first book
on your Goodreads currently-reading shelf. A row without data is hidden, and with
neither there is no box. To change what "reading" shows, change the shelf on
Goodreads.

## The around-the-world challenge

`src/data/countries.yaml` lists 195 countries (the 193 UN members, the Holy See
and Palestine), grouped by continent:

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
  you disagree, and set `dish_verified: true`.
- A country counts as cooked once a recipe has `challenge: '<its iso_n3>'`. A
  code that isn't in this file fails the build.
- The build checks that there are exactly 195 entries with unique codes.
- Every country must be in the map geometry or have a `centroid: [lon, lat]`;
  it is then drawn as a small dot. Tuvalu is the only one that needs it today.
  Countries too small to see on the map get a dot automatically.
