import { describe, expect, it } from 'vitest';
import { contributionLevels } from './contributions';

describe('contributionLevels', () => {
  it('keeps days without contributions at level 0', () => {
    const level = contributionLevels([0, 0, 3]);
    expect(level(0)).toBe(0);
  });

  it('splits non-zero days by quartiles', () => {
    // Non-zero days: 1..8 → Q1 = 3, Q3 = 7.
    const level = contributionLevels([0, 1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect([1, 3].map(level)).toEqual([1, 1]);
    expect([4, 7].map(level)).toEqual([2, 2]);
    expect(level(8)).toBe(3);
  });

  it('copes with a period of no contributions at all', () => {
    const level = contributionLevels([0, 0, 0]);
    expect(level(0)).toBe(0);
    expect(level(5)).toBe(3);
  });
});
