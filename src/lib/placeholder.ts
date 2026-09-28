export type PlaceholderTone = 1 | 2 | 3;

/** Cycles --kraft, --kraft-2, --kraft-3 so neighbouring image placeholders read as separate items. */
export function placeholderTone(index: number): PlaceholderTone {
  return ((index % 3) + 1) as PlaceholderTone;
}
