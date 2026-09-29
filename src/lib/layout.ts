export type CardSpan = 5 | 7 | 12;

export interface CardPlacement<K extends string> {
  key: K;
  span: CardSpan;
  /** Alone on the last row: spans the full width but keeps its span-7 content width. */
  alone: boolean;
}

/**
 * Packs the visible home cards, in order, into rows of two. Rows alternate
 * 7 + 5 and 5 + 7, except that the last full row is always 5 + 7, so the card
 * that closes the grid (cooking) gets the wide slot. A card left alone on the
 * last row spans all twelve columns. Hiding a card therefore never leaves a hole.
 */
export function packCards<K extends string>(keys: readonly K[]): CardPlacement<K>[] {
  const lastFullRow = Math.floor(keys.length / 2) - 1;
  const endsAlone = keys.length % 2 === 1;
  return keys.map((key, index) => {
    const row = Math.floor(index / 2);
    if (endsAlone && index === keys.length - 1) return { key, span: 12, alone: true };
    const wideFirst = row === lastFullRow && !endsAlone ? false : row % 2 === 0;
    const first = index % 2 === 0;
    return { key, span: first === wideFirst ? 7 : 5, alone: false };
  });
}
