import { geoPath } from 'd3-geo';
import { compactPath } from './path';
import { projectRings, type FittedProjection } from './projection';
import type { WorldFeatures } from './topology';

export interface MapCountry {
  iso_n3: string;
  name: string;
  dish: string;
  /** [lon, lat], for countries missing from the geometry */
  centroid?: readonly [number, number];
}

export interface CookedCountry {
  href: string;
  date: Date;
}

export interface MapShape {
  key: string;
  d: string;
  /** Absent for territories outside the challenge list (e.g. Greenland, Kosovo). */
  country?: MapCountry;
  cooked?: CookedCountry;
}

export interface MapDot {
  key: string;
  cx: number;
  cy: number;
  r: number;
  country: MapCountry;
  cooked?: CookedCountry;
}

export interface WorldMap {
  viewBox: string;
  shapes: MapShape[];
  dots: MapDot[];
}

export interface WorldMapOptions {
  /** Grid size in pixels that path coordinates snap to. */
  unit: number;
  /** Countries whose projected area is below this many square pixels also get a dot. */
  dotBelowArea: number;
  /** Dot radius in pixels. */
  dotRadius: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Everything the SVG needs, as plain data: one path per country and a dot for
 * each country too small to see, or missing from the geometry. Coordinates are
 * in grid units, so the viewBox is the fitted size divided by `unit`.
 */
export function buildWorldMap(
  features: WorldFeatures,
  fitted: FittedProjection,
  countries: readonly MapCountry[],
  cooked: ReadonlyMap<string, CookedCountry>,
  { unit, dotBelowArea, dotRadius }: WorldMapOptions,
): WorldMap {
  const { projection } = fitted;
  const path = geoPath(projection);
  const byIso = new Map(countries.map((c) => [c.iso_n3, c]));

  const shapes: MapShape[] = [];
  const dots: MapDot[] = [];
  const addDot = (country: MapCountry, [x, y]: readonly [number, number]) => {
    dots.push({
      key: country.iso_n3,
      cx: round(x / unit),
      cy: round(y / unit),
      r: round(dotRadius / unit),
      country,
      cooked: cooked.get(country.iso_n3),
    });
  };

  for (const feature of features.features) {
    const iso = typeof feature.id === 'string' ? feature.id : undefined;
    const country = iso ? byIso.get(iso) : undefined;
    const d = compactPath(projectRings(projection, feature), unit, 1);
    if (d) {
      shapes.push({
        key: iso ?? feature.properties.name,
        d,
        country,
        cooked: iso ? cooked.get(iso) : undefined,
      });
    }
    if (country && path.area(feature) < dotBelowArea) addDot(country, path.centroid(feature));
  }

  const inGeometry = new Set(features.features.map((f) => f.id));
  for (const country of countries) {
    if (inGeometry.has(country.iso_n3) || !country.centroid) continue;
    const point = projection([country.centroid[0], country.centroid[1]]);
    if (point) addDot(country, point);
  }

  const width = fitted.width / unit;
  const height = Math.ceil(fitted.height / unit);
  return { viewBox: `0 0 ${width} ${height}`, shapes, dots };
}
