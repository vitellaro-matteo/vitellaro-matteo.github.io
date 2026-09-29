import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance, requiredRatio, USED_PAIRS } from './contrast';
import { colour, parseColourTokens } from './tokens';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(luminance('#ffffff')).toBe(1);
  });

  it('does not depend on the order of the colours', () => {
    expect(contrastRatio('#2a2724', '#f3efe7')).toBe(contrastRatio('#f3efe7', '#2a2724'));
  });
});

describe('parseColourTokens', () => {
  it('reads declarations and ignores the commented-out alternatives', () => {
    const css = ':root {\n  --accent: #9c4a32;\n  /* Alternatives:\n     --accent: #5E6B4E; */\n}';
    expect(parseColourTokens(css)).toEqual({ accent: '#9c4a32' });
  });
});

describe('every colour pair the site uses', () => {
  it.each(USED_PAIRS)('$text on $background ($use) meets WCAG AA', (pair) => {
    const ratio = contrastRatio(colour(pair.text), colour(pair.background));
    expect(ratio).toBeGreaterThanOrEqual(requiredRatio(pair));
  });
});
