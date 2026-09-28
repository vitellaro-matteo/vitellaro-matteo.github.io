import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { feature } from 'topojson-client';
import { presimplify, quantile, simplify, sphericalTriangleArea } from 'topojson-simplify';

const ANTARCTICA = '010';

export interface CountryProperties {
  name: string;
}

export type WorldTopology = Topology<{ countries: GeometryCollection<CountryProperties> }>;
export type WorldFeatures = FeatureCollection<Polygon | MultiPolygon, CountryProperties>;

// Read from disk rather than imported, so the 750 KB file never passes through
// the bundler or the type checker.
function readWorldTopology(): WorldTopology {
  const require = createRequire(import.meta.url);
  const file = require.resolve('world-atlas/countries-50m.json');
  return JSON.parse(readFileSync(file, 'utf8')) as WorldTopology;
}

export const worldTopology = readWorldTopology();

/** ISO 3166-1 numeric ids present in the geometry. */
export const worldGeometryIds: ReadonlySet<string> = new Set(
  worldTopology.objects.countries.geometries
    .map((geometry) => geometry.id)
    .filter((id): id is string => typeof id === 'string'),
);

/**
 * Country features simplified to keep the given fraction of points, without
 * Antarctica. Simplifying the topology rather than each feature keeps shared
 * borders identical on both sides, so neighbours never gap or overlap.
 */
export function worldFeatures(topology: WorldTopology, keep: number): WorldFeatures {
  const weighted = presimplify(topology, sphericalTriangleArea);
  const simplified = simplify(weighted, quantile(weighted, keep)) as WorldTopology;
  const collection = feature(simplified, simplified.objects.countries) as WorldFeatures;
  return {
    ...collection,
    features: collection.features.filter((f) => f.id !== ANTARCTICA),
  };
}
