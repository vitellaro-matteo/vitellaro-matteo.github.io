import type { GoodreadsFeed, LastfmFeed } from './feeds';

/** A row whose value is one line of text, with a preview when it's a song Deezer has. */
export interface NowTextRow {
  kind: 'text';
  label: string;
  value: string;
  /** Deezer track id for the row's play button, or null for none. */
  deezerId: number | null;
  /** The play button's name, e.g. "Play preview of Title by Artist". */
  previewLabel: string | null;
}

/** The most played artist: a photo, the name and the week's play count. */
export interface NowArtistRow {
  kind: 'artist';
  label: string;
  name: string;
  image: string | null;
  plays: string;
}

export type NowRow = NowTextRow | NowArtistRow;

export interface NowBox {
  rows: NowRow[];
  /** When the newest feed behind the rows was fetched (ISO timestamp). */
  updated: string;
}

/** "1 play this week", "23 plays this week". */
export function playsThisWeek(count: number): string {
  return `${count} ${count === 1 ? 'play' : 'plays'} this week`;
}

/**
 * The home page's "now" box, built entirely from feeds: my most played track
 * and artist of the week (Last.fm) and the book I'm reading (Goodreads). A row
 * without data is left out, and with no rows at all there is no box.
 */
export function nowBox(lastfm: LastfmFeed | null, goodreads: GoodreadsFeed | null): NowBox | null {
  const rows: NowRow[] = [];
  const sources: string[] = [];

  const track = lastfm?.top_track;
  if (track) {
    const deezerId = track.deezer_id ?? null;
    rows.push({
      kind: 'text',
      label: 'on repeat',
      value: `${track.title} — ${track.artist}`,
      deezerId,
      previewLabel: deezerId ? `Play preview of ${track.title} by ${track.artist}` : null,
    });
  }
  const artist = lastfm?.top_artist;
  if (artist) {
    rows.push({
      kind: 'artist',
      label: 'most played',
      name: artist.name,
      image: artist.image,
      plays: playsThisWeek(artist.playcount),
    });
  }
  if (lastfm && (track || artist)) sources.push(lastfm.fetched_at);

  const book = goodreads?.currently_reading[0];
  if (goodreads && book) {
    rows.push({
      kind: 'text',
      label: 'reading',
      value: `${book.title} — ${book.author}`,
      deezerId: null,
      previewLabel: null,
    });
    sources.push(goodreads.fetched_at);
  }

  if (rows.length === 0) return null;
  // ISO timestamps in UTC sort chronologically as text.
  const updated = sources.reduce((latest, time) => (time > latest ? time : latest));
  return { rows, updated };
}
