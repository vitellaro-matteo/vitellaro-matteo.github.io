import type { GoodreadsFeed, LastfmFeed } from './feeds';

export interface NowRow {
  label: string;
  value: string;
}

export interface NowBox {
  rows: NowRow[];
  /** When the newest feed behind the rows was fetched (ISO timestamp). */
  updated: string;
}

/**
 * The home page's "now" box, built entirely from feeds: my most played track of
 * the week (Last.fm) and the book I'm reading (Goodreads). A row without data is
 * left out, and with no rows at all there is no box.
 */
export function nowBox(lastfm: LastfmFeed | null, goodreads: GoodreadsFeed | null): NowBox | null {
  const rows: NowRow[] = [];
  const sources: string[] = [];

  const track = lastfm?.top_track;
  if (lastfm && track) {
    rows.push({ label: 'on repeat', value: `${track.title} — ${track.artist}` });
    sources.push(lastfm.fetched_at);
  }
  const book = goodreads?.currently_reading[0];
  if (goodreads && book) {
    rows.push({ label: 'reading', value: `${book.title} — ${book.author}` });
    sources.push(goodreads.fetched_at);
  }

  if (rows.length === 0) return null;
  // ISO timestamps in UTC sort chronologically as text.
  const updated = sources.reduce((latest, time) => (time > latest ? time : latest));
  return { rows, updated };
}
