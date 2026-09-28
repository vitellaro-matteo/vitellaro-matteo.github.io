import { describe, expect, it } from 'vitest';
import { compactPath, ringArea, ringsToPathData, snapRing, type Point } from './path';

describe('snapRing', () => {
  it('snaps to the grid and drops repeated points', () => {
    const ring: Point[] = [
      [0.1, 0.2],
      [0.4, 0.1],
      [2.6, 0],
      [2.6, 3.4],
    ];
    expect(snapRing(ring, 1)).toEqual([
      [0, 0],
      [3, 0],
      [3, 3],
    ]);
  });

  it('drops a closing point that repeats the first', () => {
    const ring: Point[] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 0],
    ];
    expect(snapRing(ring, 1)).toHaveLength(3);
  });

  it('measures in grid units', () => {
    expect(snapRing([[3, 5]], 0.5)).toEqual([[6, 10]]);
  });
});

describe('ringArea', () => {
  it('is the absolute area whatever the winding', () => {
    const square: Point[] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    expect(ringArea(square)).toBe(16);
    expect(ringArea([...square].reverse())).toBe(16);
  });
});

describe('ringsToPathData', () => {
  it('writes an absolute move, then relative segments', () => {
    const square: Point[] = [
      [10, 20],
      [14, 20],
      [14, 24],
      [10, 24],
    ];
    expect(ringsToPathData([square])).toBe('M10 20l4 0 0 4-4 0z');
  });

  it('concatenates rings', () => {
    const a: Point[] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    expect(ringsToPathData([a, a])).toBe('M0 0l1 0 0 1zM0 0l1 0 0 1z');
  });
});

describe('compactPath', () => {
  const square = (size: number): Point[] => [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ];

  it('keeps rings at or above the minimum area', () => {
    expect(compactPath([square(4)], 1, 1)).toBe('M0 0l4 0 0 4-4 0z');
  });

  it('leaves out rings that are too small or collapse', () => {
    expect(compactPath([square(0.4)], 1, 1)).toBe('');
    expect(compactPath([square(1)], 1, 4)).toBe('');
  });
});
