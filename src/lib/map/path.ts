export type Point = readonly [number, number];

/**
 * Snaps a ring to a grid of `unit` pixels and drops points that land on the
 * previous one. Most of a detailed coastline collapses this way at map scale.
 */
export function snapRing(ring: readonly Point[], unit: number): Point[] {
  const snapped: Point[] = [];
  for (const [x, y] of ring) {
    const point: Point = [Math.round(x / unit), Math.round(y / unit)];
    const last = snapped.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) snapped.push(point);
  }
  const [first] = snapped;
  const last = snapped.at(-1);
  if (snapped.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) {
    snapped.pop();
  }
  return snapped;
}

/** Absolute area of a ring (shoelace formula), in squared grid units. */
export function ringArea(ring: readonly Point[]): number {
  let twice = 0;
  ring.forEach(([x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length] ?? [x1, y1];
    twice += x1 * y2 - x2 * y1;
  });
  return Math.abs(twice) / 2;
}

/** Numbers joined as SVG allows: a minus sign doubles as the separator. */
function joinNumbers(numbers: readonly number[]): string {
  return numbers.map((n, i) => (i === 0 || n < 0 ? `${n}` : ` ${n}`)).join('');
}

/**
 * Compact SVG path data for grid-snapped rings: an absolute move to the first
 * point, then relative line segments, which are one or two digits each.
 */
export function ringsToPathData(rings: readonly (readonly Point[])[]): string {
  return rings
    .map((ring) => {
      const [first, ...rest] = ring;
      if (!first) return '';
      const deltas: number[] = [];
      let [px, py] = first;
      for (const [x, y] of rest) {
        deltas.push(x - px, y - py);
        [px, py] = [x, y];
      }
      return `M${joinNumbers(first)}l${joinNumbers(deltas)}z`;
    })
    .join('');
}

/**
 * Path data for projected rings on a grid of `unit` pixels, leaving out rings
 * that collapse to fewer than three points or cover less than `minArea` square
 * pixels: they would be invisible, and a tiny country gets a dot instead.
 */
export function compactPath(rings: readonly Point[][], unit: number, minArea: number): string {
  const kept = rings
    .map((ring) => snapRing(ring, unit))
    .filter((ring) => ring.length >= 3 && ringArea(ring) * unit * unit >= minArea);
  return ringsToPathData(kept);
}
