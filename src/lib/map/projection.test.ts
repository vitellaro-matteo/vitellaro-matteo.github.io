import { describe, expect, it } from 'vitest';
import { box, collection } from './fixtures';
import { fitEqualEarth, projectRings } from './projection';

const world = collection(
  box('001', 'West', [-170, -50, -10, 70]),
  box('002', 'East', [10, -50, 170, 70]),
);

describe('fitEqualEarth', () => {
  it('fits the shapes to the requested width, starting at the top edge', () => {
    const { projection, width, height } = fitEqualEarth(world, 1000);
    expect(width).toBe(1000);
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThan(1000);

    const [x, y] = projection([-170, 70]) ?? [NaN, NaN];
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic', () => {
    expect(fitEqualEarth(world, 1000).height).toBe(fitEqualEarth(world, 1000).height);
  });
});

describe('projectRings', () => {
  it('returns one screen-space ring per polygon ring, inside the fitted area', () => {
    const { projection, width, height } = fitEqualEarth(world, 1000);
    const [west] = world.features;
    if (!west) throw new Error('fixture has no features');
    const rings = projectRings(projection, west);
    expect(rings).toHaveLength(1);
    for (const [x, y] of rings[0] ?? []) {
      expect(x).toBeGreaterThanOrEqual(-0.5);
      expect(x).toBeLessThanOrEqual(width + 0.5);
      expect(y).toBeGreaterThanOrEqual(-0.5);
      expect(y).toBeLessThanOrEqual(height + 0.5);
    }
  });
});
