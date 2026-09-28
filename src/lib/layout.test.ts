import { describe, expect, it } from 'vitest';
import { packCards } from './layout';

const ALL = ['listening', 'watching', 'reading', 'seeing', 'making', 'journal'] as const;
const spans = (keys: readonly string[]) =>
  packCards(keys).map(({ key, span, alone }) => `${key}:${span}${alone ? ' alone' : ''}`);

describe('packCards', () => {
  it('reproduces the design when every card is visible', () => {
    expect(spans(ALL)).toEqual([
      'listening:7',
      'watching:5',
      'reading:5',
      'seeing:7',
      'making:7',
      'journal:5',
    ]);
  });

  it('repacks without a hole whichever single card is missing', () => {
    for (const missing of ALL) {
      const placed = packCards(ALL.filter((key) => key !== missing));
      expect(placed.map((p) => p.span)).toEqual([7, 5, 5, 7, 12]);
      expect(placed.at(-1)?.alone).toBe(true);
      expect(placed.some((p) => p.key === missing)).toBe(false);
    }
  });

  it('keeps the original order', () => {
    expect(packCards(ALL.filter((key) => key !== 'reading')).map((p) => p.key)).toEqual([
      'listening',
      'watching',
      'seeing',
      'making',
      'journal',
    ]);
  });

  it('handles several missing cards', () => {
    expect(spans(['watching', 'seeing', 'journal'])).toEqual([
      'watching:7',
      'seeing:5',
      'journal:12 alone',
    ]);
    expect(spans(['reading', 'journal'])).toEqual(['reading:7', 'journal:5']);
  });

  it('lets a single card span the full width', () => {
    expect(spans(['journal'])).toEqual(['journal:12 alone']);
    expect(packCards([])).toEqual([]);
  });
});
