export type ContributionLevel = 0 | 1 | 2 | 3;

/**
 * Buckets daily contribution counts into the calendar's four shades. Days with
 * no contributions are level 0; the rest split by quartiles of the non-zero days,
 * so the shading adapts to how busy the period was: up to Q1 → 1, up to Q3 → 2,
 * above Q3 → 3.
 */
export function contributionLevels(counts: number[]): (count: number) => ContributionLevel {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const quantile = (q: number) =>
    nonZero[Math.min(nonZero.length - 1, Math.floor(q * nonZero.length))] ?? 0;
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);

  return (count) => {
    if (count <= 0) return 0;
    if (count <= q1) return 1;
    if (count <= q3) return 2;
    return 3;
  };
}
