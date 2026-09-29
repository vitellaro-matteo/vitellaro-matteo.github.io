import { describe, expect, it } from 'vitest';
import type { GoodreadsFeed, LastfmFeed } from './feeds';
import { nowBox } from './now';

const lastfm: LastfmFeed = {
  fetched_at: '2026-09-28T05:00:10Z',
  top_track: { title: 'Can II', artist: 'Hana Stretton', url: '', playcount: 14 },
};

const book = { url: '', cover: null, rating: null };
const goodreads: GoodreadsFeed = {
  fetched_at: '2026-09-28T05:00:20Z',
  currently_reading: [
    { ...book, title: 'Piranesi', author: 'Susanna Clarke' },
    { ...book, title: 'Second book', author: 'Someone' },
  ],
  read: [],
};

describe('nowBox', () => {
  it('shows the top track and the first book being read', () => {
    expect(nowBox(lastfm, goodreads)).toEqual({
      rows: [
        { label: 'on repeat', value: 'Can II — Hana Stretton' },
        { label: 'reading', value: 'Piranesi — Susanna Clarke' },
      ],
      updated: '2026-09-28T05:00:20Z',
    });
  });

  it('dates the box by the newest feed it uses', () => {
    const older = { ...goodreads, fetched_at: '2026-09-20T05:00:00Z' };
    expect(nowBox(lastfm, older)?.updated).toBe('2026-09-28T05:00:10Z');
  });

  it('hides a row without data', () => {
    const silent = { ...lastfm, top_track: null };
    expect(nowBox(silent, goodreads)?.rows.map((r) => r.label)).toEqual(['reading']);
    expect(nowBox(silent, goodreads)?.updated).toBe(goodreads.fetched_at);

    const notReading = { ...goodreads, currently_reading: [] };
    expect(nowBox(lastfm, notReading)?.rows.map((r) => r.label)).toEqual(['on repeat']);
  });

  it('has no box when there is nothing to show', () => {
    expect(nowBox(null, null)).toBeNull();
    expect(
      nowBox({ ...lastfm, top_track: null }, { ...goodreads, currently_reading: [] }),
    ).toBeNull();
  });
});
