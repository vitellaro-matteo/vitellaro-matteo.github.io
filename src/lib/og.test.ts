import { describe, expect, it } from 'vitest';
import { isOgType, ogImageUrl } from './og';

describe('isOgType', () => {
  it('accepts page types with a card', () => {
    expect(isOgType('journal')).toBe(true);
    expect(isOgType('challenge')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isOgType(undefined)).toBe(false);
    expect(isOgType('recipes')).toBe(false);
    expect(isOgType('toString')).toBe(false);
  });
});

describe('ogImageUrl', () => {
  it('is absolute, as og:image requires', () => {
    expect(ogImageUrl('lists', 'https://example.org')).toBe('https://example.org/og/lists.png');
  });
});
