import { describe, expect, it } from 'vitest';
import { isYear, neighbours } from './entries';

describe('isYear', () => {
  it('accepts four-digit years only', () => {
    expect(isYear('2025')).toBe(true);
    expect(isYear('example')).toBe(false);
    expect(isYear('25')).toBe(false);
    expect(isYear('2025-best')).toBe(false);
  });
});

describe('neighbours', () => {
  const newestFirst = ['c', 'b', 'a'];

  it('finds the older and newer item', () => {
    expect(neighbours(newestFirst, 1)).toEqual({ older: 'a', newer: 'c' });
  });

  it('has no newer item for the newest and no older item for the oldest', () => {
    expect(neighbours(newestFirst, 0)).toEqual({ older: 'b', newer: undefined });
    expect(neighbours(newestFirst, 2)).toEqual({ older: undefined, newer: 'b' });
  });
});
