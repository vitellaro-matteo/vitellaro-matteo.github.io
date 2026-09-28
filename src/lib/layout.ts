export type CardSpan = 5 | 7 | 12;

export interface CardPlacement<K extends string> {
  key: K;
  span: CardSpan;
  /** Alone on the last row: spans the full width but keeps its span-7 content width. */
  alone: boolean;
}

/**
 * Packs the visible home cards, in order, into rows of two that alternate
 * 7 + 5 and 5 + 7, as in the full design. A card left alone on the last row
 * spans all twelve columns. Hiding a card therefore never leaves a hole.
 */
export function packCards<K extends string>(keys: readonly K[]): CardPlacement<K>[] {
  return keys.map((key, index) => {
    const row = Math.floor(index / 2);
    const isAlone = index === keys.length - 1 && index % 2 === 0;
    if (isAlone) return { key, span: 12, alone: true };
    const first = index % 2 === 0;
    const wideFirst = row % 2 === 0;
    return { key, span: first === wideFirst ? 7 : 5, alone: false };
  });
}
