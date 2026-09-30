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
  lastfm: 'the "on repeat" and "most played" rows of the now box',
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

/** Where a feed comes from: the live feed if there is one, else the fixture when allowed. */
export function feedSource(name: FeedName, sources: FeedSources): 'live' | 'fixture' | null {
  if (sources.live[`../data/live/${name}.json`] !== undefined) return 'live';
  if (sources.useFixtures && sources.fixtures[`../data/feeds/${name}.json`] !== undefined) {
    return 'fixture';
  }
  return null;
}

/** The live feed if there is one, else the fixture when fixtures are allowed, else null. */
export function selectFeed(name: FeedName, sources: FeedSources): unknown {
  const source = feedSource(name, sources);
  if (source === 'live') return sources.live[`../data/live/${name}.json`];
  if (source === 'fixture') return sources.fixtures[`../data/feeds/${name}.json`];
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
  /**
   * The same recording on Deezer, whose 30-second preview the player fetches
   * when pressed (its signed URLs expire after 15 minutes, so none is stored),
   * or null when Deezer has no match. Missing in feeds cached before the field.
   */
  deezer_id?: number | null;
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
  top_track: {
    title: string;
    artist: string;
    url: string;
    playcount: number;
    /** The same recording on Deezer, for its preview; missing in feeds cached before the field. */
    deezer_id?: number | null;
  } | null;
  /** my most played artist of the last seven days; missing in feeds cached before the field */
  top_artist?: {
    name: string;
    url: string;
    playcount: number;
    /** a square photo from Deezer, or null */
    image: string | null;
  } | null;
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
/** Whether the Spotify feed is the real one, which holds every embedded track. */
export const spotifyIsLive = feedSource('spotify', { live, fixtures, useFixtures }) === 'live';
export const lastfm = load<LastfmFeed>('lastfm');
export const letterboxd = load<LetterboxdFeed>('letterboxd');
export const goodreads = load<GoodreadsFeed>('goodreads');
export const github = load<GithubFeed>('github');
