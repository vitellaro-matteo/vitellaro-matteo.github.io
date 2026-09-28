import { describe, expect, it } from 'vitest';
import { load as loadYaml } from 'js-yaml';
import { COUNTRY_TOTAL, countries, parseCountries } from './countries';
import { worldGeometryIds } from './map/topology';
import countriesRaw from '../data/countries.yaml?raw';

const raw = loadYaml(countriesRaw) as Record<string, unknown>[];

describe('countries.yaml', () => {
  it('has all 195 countries, grouped into the five continents', () => {
    expect(countries).toHaveLength(COUNTRY_TOTAL);
    const counts = Object.fromEntries(
      ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'].map((c) => [
        c,
        countries.filter((country) => country.continent === c).length,
      ]),
    );
    expect(counts).toEqual({ Africa: 54, Americas: 35, Asia: 48, Europe: 44, Oceania: 14 });
  });

  it('includes the Holy See and Palestine', () => {
    const names = countries.map((c) => c.name);
    expect(names).toContain('Holy See');
    expect(names).toContain('Palestine');
  });
});

describe('parseCountries', () => {
  it('rejects a list with the wrong number of entries', () => {
    expect(() => parseCountries(raw.slice(1), worldGeometryIds)).toThrow(/exactly 195/);
  });

  it('rejects duplicate codes', () => {
    const duplicated = [...raw.slice(0, -1), { ...raw[0], name: 'Copy' }];
    expect(() => parseCountries(duplicated, worldGeometryIds)).toThrow(/duplicate iso_n3/);
  });

  it('requires a centroid for countries missing from the geometry', () => {
    const withoutGeometry = new Set([...worldGeometryIds].filter((id) => id !== '380'));
    expect(() => parseCountries(raw, withoutGeometry)).toThrow(/Italy \(380\).*centroid/);
  });

  it('rejects unknown continents', () => {
    const wrong = [{ ...raw[0], continent: 'Atlantis' }, ...raw.slice(1)];
    expect(() => parseCountries(wrong, worldGeometryIds)).toThrow(/continent/);
  });
});
