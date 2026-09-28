import { load as loadYaml } from 'js-yaml';
import { z } from 'astro/zod';
import type { SpotifyFeed, LetterboxdFeed, GoodreadsFeed, InstagramFeed, GithubFeed } from './feeds';
import spotifyJson from '../data/feeds/spotify.json';
import letterboxdJson from '../data/feeds/letterboxd.json';
import goodreadsJson from '../data/feeds/goodreads.json';
import instagramJson from '../data/feeds/instagram.json';
import githubJson from '../data/feeds/github.json';
import nowRaw from '../data/now.yaml?raw';

export const spotify = spotifyJson as SpotifyFeed;
export const letterboxd = letterboxdJson as LetterboxdFeed;
export const goodreads = goodreadsJson as GoodreadsFeed;
export const instagram = instagramJson as InstagramFeed;
export const github = githubJson as GithubFeed;

const nowSchema = z.object({
  on_repeat: z.string(),
  reading: z.string().nullish(),
  thinking_about: z.string(),
  progress: z
    .object({ page: z.number().int().nonnegative(), of: z.number().int().positive() })
    .nullish(),
  updated: z.coerce.date(),
});

const parsed = nowSchema.safeParse(loadYaml(nowRaw) ?? {});
if (!parsed.success) {
  throw new Error(`src/data/now.yaml is invalid:\n${z.prettifyError(parsed.error)}`);
}

const currentBook = goodreads.currently_reading[0];

export const now = {
  ...parsed.data,
  // `reading` falls back to the current Goodreads book if left empty.
  reading: parsed.data.reading || (currentBook ? currentBook.title : ''),
  progress: parsed.data.progress ?? null,
};
