import { describe, expect, it } from 'vitest';
import { box, collection } from './fixtures';
import { fitEqualEarth } from './projection';
import { buildWorldMap, type MapCountry } from './world-map';

const features = collection(
  box('001', 'Bigland', [-120, -40, 0, 60]),
  box('002', 'Tinyland', [30, 10, 30.1, 10.1]),
  box(undefined, 'Unlisted territory', [40, 20, 80, 50]),
);
const fitted = fitEqualEarth(features, 1000);
const countries: MapCountry[] = [
  { iso_n3: '001', name: 'Bigland', dish: 'Stew' },
  { iso_n3: '002', name: 'Tinyland', dish: 'Pie' },
  { iso_n3: '003', name: 'Islandia', dish: 'Fish', centroid: [150, -20] },
];
const cooked = new Map([['001', { href: '/cooking/stew/', date: new Date('2026-09-01') }]]);
const options = { unit: 1, dotBelowArea: 4, dotRadius: 1.5 };

describe('buildWorldMap', () => {
  const map = buildWorldMap(features, fitted, countries, cooked, options);

  it('sizes the viewBox to the fitted projection in grid units', () => {
    expect(map.viewBox).toBe(`0 0 1000 ${fitted.height}`);
    const half = buildWorldMap(features, fitted, countries, cooked, { ...options, unit: 0.5 });
    expect(half.viewBox).toBe(`0 0 2000 ${fitted.height * 2}`);
  });

  it('draws a shape for every visible feature, with its country and cooked state', () => {
    const big = map.shapes.find((s) => s.key === '001');
    expect(big?.d).toMatch(/^M\d/);
    expect(big?.country?.name).toBe('Bigland');
    expect(big?.cooked?.href).toBe('/cooking/stew/');
  });

  it('keeps territories outside the list as plain shapes', () => {
    const territory = map.shapes.find((s) => s.key === 'Unlisted territory');
    expect(territory?.country).toBeUndefined();
    expect(territory?.cooked).toBeUndefined();
  });

  it('adds a dot for countries too small to see', () => {
    const dot = map.dots.find((d) => d.key === '002');
    expect(dot?.country.name).toBe('Tinyland');
    expect(dot?.r).toBe(1.5);
    expect(dot?.cooked).toBeUndefined();
  });

  it('adds a dot at the given centroid for countries missing from the geometry', () => {
    const dot = map.dots.find((d) => d.key === '003');
    const [x, y] = fitted.projection([150, -20]) ?? [NaN, NaN];
    expect(dot?.cx).toBeCloseTo(x, 0);
    expect(dot?.cy).toBeCloseTo(y, 0);
  });

  it('gives large countries no dot', () => {
    expect(map.dots.some((d) => d.key === '001')).toBe(false);
  });
});
