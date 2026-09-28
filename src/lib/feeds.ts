// Feed data written by the fetchers (scripts/). The deploy workflow writes real
// feeds to src/data/live/, which is gitignored. The committed fixtures in
// src/data/feeds/ are sample data for development and tests only: a production
// build never shows them, and hides a card whose feed is missing instead.
// Image fields are paths under /media/feeds/… (downloaded, never hotlinked), or null.

const live = import.meta.glob<unknown>('../data/live/*.json', { eager: true, import: 'default' });
const fixtures = import.meta.glob<unknown>('../data/feeds/*.json', {
  eager: true,
  import: 'default',
});

/** Fixtures are allowed in `npm run dev`, and in any build run with USE_FIXTURES=true (CI). */
const useFixtures = import.meta.env.DEV || process.env.USE_FIXTURES === 'true';

/** The home-page card each feed fills, used when reporting hidden cards. */
export const cardForFeed = {
  spotify: 'listening',
  letterboxd: 'watching',
  goodreads: 'reading',
  instagram: 'seeing',
  github: 'making',
} as const;

export type FeedName = keyof typeof cardForFeed;

export interface FeedSources {
  live: Record<string, unknown>;
  fixtures: Record<string, unknown>;
  useFixtures: boolean;
}

/** The live feed if there is one, else the fixture when fixtures are allowed, else null. */
export function selectFeed(name: FeedName, sources: FeedSources): unknown {
  const liveData = sources.live[`../data/live/${name}.json`];
  if (liveData !== undefined) return liveData;
  if (sources.useFixtures) return sources.fixtures[`../data/feeds/${name}.json`] ?? null;
  return null;
}

function load<T>(name: FeedName): T | null {
  const data = selectFeed(name, { live, fixtures, useFixtures });
  if (data === null) {
    console.warn(`[feeds] no ${name} feed: hiding the ${cardForFeed[name]} card`);
  }
  return data as T | null;
}

export interface SpotifyFeed {
  fetched_at: string;
  playlist_url: string;
  tracks: {
    /** Spotify track id */
    id: string;
    title: string;
    artists: string[];
    url: string;
    cover: string | null;
  }[];
}

export interface LetterboxdFeed {
  fetched_at: string;
  films: {
    title: string;
    year: number | null;
    /** member rating, 0.5–5, or null if not rated */
    rating: number | null;
    /** YYYY-MM-DD */
    watched_date: string;
    url: string;
    poster: string | null;
    /** review text with HTML stripped, or null */
    review: string | null;
  }[];
}

export interface GoodreadsBook {
  title: string;
  author: string;
  url: string;
  cover: string | null;
  pages: number | null;
}

export interface GoodreadsFeed {
  fetched_at: string;
  currently_reading: GoodreadsBook[];
  /** latest two finished books */
  read: GoodreadsBook[];
}

export interface InstagramFeed {
  fetched_at: string;
  posts: {
    id: string;
    permalink: string;
    media_type: 'IMAGE' | 'CAROUSEL_ALBUM' | 'VIDEO';
    image: string | null;
    caption: string | null;
    timestamp: string;
  }[];
}

export interface GithubFeed {
  fetched_at: string;
  calendar: {
    total: number;
    /** last 30 weeks, oldest first; each week Sunday → Saturday */
    weeks: { days: { date: string; count: number }[] }[];
  };
  pushes: {
    repo: string;
    url: string;
    message: string;
    time: string;
  }[];
}

export const spotify = load<SpotifyFeed>('spotify');
export const letterboxd = load<LetterboxdFeed>('letterboxd');
export const goodreads = load<GoodreadsFeed>('goodreads');
export const instagram = load<InstagramFeed>('instagram');
export const github = load<GithubFeed>('github');
