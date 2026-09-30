/** WCAG 2.2 relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

export interface ColourPair {
  text: string;
  background: string;
  /** Where the pair appears on the site. */
  use: string;
  /** Large text (≥ 24px, or ≥ 18.66px bold) or a graphic: AA needs 3:1 instead of 4.5:1. */
  large?: boolean;
}

/** WCAG AA minimum for the pair. */
export const requiredRatio = (pair: ColourPair): number => (pair.large ? 3 : 4.5);

/**
 * Every foreground/background token pair the site actually uses, for the
 * contrast audit in docs/DESIGN.md §3 and its test.
 */
export const USED_PAIRS: ColourPair[] = [
  { text: 'ink', background: 'paper', use: 'body text, headings, nav' },
  { text: 'ink', background: 'card', use: 'card text, tile titles, map tooltip' },
  { text: 'ink', background: 'kraft', use: 'now box values, lists band heading' },
  { text: 'muted', background: 'paper', use: 'bios, leads, meta, footer' },
  { text: 'muted', background: 'card', use: 'artists, dates, card meta, source links' },
  { text: 'muted', background: 'kraft', use: 'now box labels, plays and play glyph, band text' },
  { text: 'accent', background: 'paper', use: 'labels, current nav item, counts, hover' },
  { text: 'accent', background: 'card', use: 'card labels, listening stop glyph, #1 numeral' },
  { text: 'accent', background: 'kraft', use: 'band labels, now box stop glyph' },
  { text: 'numeral', background: 'paper', use: 'list numerals 02–10 (32–56px)', large: true },
  { text: 'accent', background: 'kraft', use: 'cooked countries on the mini map', large: true },
  { text: 'accent', background: 'paper', use: 'focus outline', large: true },
];
