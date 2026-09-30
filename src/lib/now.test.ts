import { describe, expect, it } from 'vitest';
import type { GoodreadsFeed, LastfmFeed } from './feeds';
import { nowBox, playsThisWeek } from './now';

const topTrack = {
  title: 'Can II',
  artist: 'Hana Stretton',
  url: '',
  playcount: 14,
  deezer_id: 2113267347,
};

const lastfm: LastfmFeed = {
  fetched_at: '2026-09-28T05:00:10Z',
  top_track: topTrack,
  top_artist: {
    name: 'Hana Stretton',
    url: '',
    playcount: 23,
    image: '/media/feeds/lastfm/a1b2.jpg',
  },
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

const labels = (box: ReturnType<typeof nowBox>) => box?.rows.map((row) => row.label);

describe('playsThisWeek', () => {
  it('counts plays in words', () => {
    expect(playsThisWeek(23)).toBe('23 plays this week');
    expect(playsThisWeek(1)).toBe('1 play this week');
    expect(playsThisWeek(0)).toBe('0 plays this week');
  });
});

describe('nowBox', () => {
  it('shows the top track, the top artist and the first book being read, in that order', () => {
    expect(nowBox(lastfm, goodreads)).toEqual({
      rows: [
        {
          kind: 'text',
          label: 'on repeat',
          value: 'Can II — Hana Stretton',
          deezerId: 2113267347,
          previewLabel: 'Play preview of Can II by Hana Stretton',
        },
        {
          kind: 'artist',
          label: 'most played',
          name: 'Hana Stretton',
          image: '/media/feeds/lastfm/a1b2.jpg',
          plays: '23 plays this week',
        },
        {
          kind: 'text',
          label: 'reading',
          value: 'Piranesi — Susanna Clarke',
          deezerId: null,
          previewLabel: null,
        },
      ],
      updated: '2026-09-28T05:00:20Z',
    });
  });

  it('has no play button for a song Deezer does not have', () => {
    const unmatched = { ...lastfm, top_track: { ...topTrack, deezer_id: null } };
    expect(nowBox(unmatched, null)?.rows[0]).toMatchObject({ deezerId: null, previewLabel: null });
  });

  it('reads feeds cached before the preview and artist fields', () => {
    const { title, artist, url, playcount } = topTrack;
    const oldTrack = { title, artist, url, playcount };
    const old: LastfmFeed = { fetched_at: lastfm.fetched_at, top_track: oldTrack };
    const box = nowBox(old, null);
    expect(labels(box)).toEqual(['on repeat']);
    expect(box?.rows[0]).toMatchObject({ deezerId: null });
  });

  it('dates the box by the newest feed it uses', () => {
    const older = { ...goodreads, fetched_at: '2026-09-20T05:00:00Z' };
    expect(nowBox(lastfm, older)?.updated).toBe('2026-09-28T05:00:10Z');
  });

  it('hides a row without data', () => {
    const noArtist = { ...lastfm, top_artist: null };
    expect(labels(nowBox(noArtist, goodreads))).toEqual(['on repeat', 'reading']);

    const onlyArtist = { ...lastfm, top_track: null };
    expect(labels(nowBox(onlyArtist, null))).toEqual(['most played']);
    expect(nowBox(onlyArtist, null)?.updated).toBe(lastfm.fetched_at);

    const silent = { ...lastfm, top_track: null, top_artist: null };
    expect(labels(nowBox(silent, goodreads))).toEqual(['reading']);
    expect(nowBox(silent, goodreads)?.updated).toBe(goodreads.fetched_at);

    const notReading = { ...goodreads, currently_reading: [] };
    expect(labels(nowBox(lastfm, notReading))).toEqual(['on repeat', 'most played']);
  });

  it('has no box when there is nothing to show', () => {
    expect(nowBox(null, null)).toBeNull();
    expect(
      nowBox(
        { ...lastfm, top_track: null, top_artist: null },
        { ...goodreads, currently_reading: [] },
      ),
    ).toBeNull();
  });
});
