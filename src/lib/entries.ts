/** True for list ids named after a year, e.g. `2025`. */
export const isYear = (id: string): boolean => /^\d{4}$/.test(id);

/** Older / newer neighbours of the item at `index` in a newest-first list. */
export function neighbours<T>(items: T[], index: number): { older?: T; newer?: T } {
  return { older: items[index + 1], newer: items[index - 1] };
}
