// Shapes of the JSON files in src/data/feeds/, written by scripts/fetch_all.py.
// Image fields are local paths under /media/feeds/… (never hotlinked), or null.

export interface SpotifyFeed {
  fetched_at: string;
  playlist_url: string;
  tracks: {
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
