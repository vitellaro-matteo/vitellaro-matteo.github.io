import { describe, expect, it } from 'vitest';
import { selectFeed } from './feeds';

const live = { '../data/live/spotify.json': { source: 'live' } };
const fixtures = {
  '../data/feeds/spotify.json': { source: 'fixture' },
  '../data/feeds/github.json': { source: 'fixture' },
};

describe('selectFeed', () => {
  it('prefers the live feed whenever it exists', () => {
    expect(selectFeed('spotify', { live, fixtures, useFixtures: true })).toEqual({
      source: 'live',
    });
    expect(selectFeed('spotify', { live, fixtures, useFixtures: false })).toEqual({
      source: 'live',
    });
  });

  it('falls back to the fixture only when fixtures are allowed', () => {
    expect(selectFeed('github', { live, fixtures, useFixtures: true })).toEqual({
      source: 'fixture',
    });
    expect(selectFeed('github', { live, fixtures, useFixtures: false })).toBeNull();
  });

  it('returns null when there is neither', () => {
    expect(selectFeed('instagram', { live, fixtures, useFixtures: true })).toBeNull();
  });
});
