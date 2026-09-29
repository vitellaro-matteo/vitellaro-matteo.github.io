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

/** What each feed fills on the home page, named when the build reports what it hides. */
export const usedBy = {
  spotify: 'the listening card',
  lastfm: 'the "on repeat" row of the now box',
  letterboxd: 'the watching card',
  goodreads: 'the reading card and the "reading" row of the now box',
  github: 'the making card',
} as const;

export type FeedName = keyof typeof usedBy;

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
    console.warn(`[feeds] no ${name} feed: hiding ${usedBy[name]}`);
  }
  return data as T | null;
}

export interface SpotifyTrack {
  /** Spotify track id */
  id: string;
  title: string;
  artists: string[];
  url: string;
  cover: string | null;
  /** A 30-second MP3 from Deezer; signed, so it expires within days. */
  preview: string | null;
}

export interface SpotifyFeed {
  fetched_at: string;
  playlist_url: string;
  /** The "last week's finds" playlist, in playlist order. */
  tracks: SpotifyTrack[];
  /** Tracks used by <Track id="…"> embeds that aren't in the playlist. */
  embedded: SpotifyTrack[];
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
  /** my rating, 1–5 stars, or null when unrated */
  rating: number | null;
}

export interface GoodreadsFeed {
  fetched_at: string;
  currently_reading: GoodreadsBook[];
  /** the six most recently finished books, newest first */
  read: GoodreadsBook[];
}

export interface LastfmFeed {
  fetched_at: string;
  /** my most played track of the last seven days, or null for a silent week */
  top_track: { title: string; artist: string; url: string; playcount: number } | null;
}

export interface GithubFeed {
  fetched_at: string;
  calendar: {
    total: number;
    /** last 52 weeks, oldest first; each week Sunday → Saturday */
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
export const lastfm = load<LastfmFeed>('lastfm');
export const letterboxd = load<LetterboxdFeed>('letterboxd');
export const goodreads = load<GoodreadsFeed>('goodreads');
export const github = load<GithubFeed>('github');
