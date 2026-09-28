// Feed data written by the fetchers (scripts/). The deploy workflow writes real
// feeds to src/data/live/, which is gitignored; locally and in tests the committed
// fixtures in src/data/feeds/ stand in, so the site always builds.
// Image fields are paths under /media/feeds/… (downloaded, never hotlinked), or null.

const live = import.meta.glob<unknown>('../data/live/*.json', { eager: true, import: 'default' });
const fixtures = import.meta.glob<unknown>('../data/feeds/*.json', {
  eager: true,
  import: 'default',
});

function load<T>(name: string): T {
  const data = live[`../data/live/${name}.json`] ?? fixtures[`../data/feeds/${name}.json`];
  if (data === undefined) {
    throw new Error(`No feed data for "${name}": expected src/data/feeds/${name}.json`);
  }
  return data as T;
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
