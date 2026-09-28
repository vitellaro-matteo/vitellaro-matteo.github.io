import { load as loadYaml } from 'js-yaml';
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

export interface Now {
  on_repeat: string;
  reading: string;
  thinking_about: string;
  progress: { page: number; of: number } | null;
  updated: Date | string;
}

const nowData = (loadYaml(nowRaw) ?? {}) as Partial<Now>;
const currentBook = goodreads.currently_reading[0];

export const now: Now = {
  on_repeat: nowData.on_repeat ?? '',
  // `reading` falls back to the current Goodreads book if left empty.
  reading: nowData.reading || (currentBook ? currentBook.title : ''),
  thinking_about: nowData.thinking_about ?? '',
  progress: nowData.progress ?? null,
  updated: nowData.updated ?? '',
};
