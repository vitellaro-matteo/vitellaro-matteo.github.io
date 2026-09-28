import type { Feature, Polygon } from 'geojson';
import type { CountryProperties, WorldFeatures } from './topology';

/** A lon/lat rectangle as a country feature, for tests. */
export function box(
  id: string | undefined,
  name: string,
  [west, south, east, north]: [number, number, number, number],
): Feature<Polygon, CountryProperties> {
  return {
    type: 'Feature',
    id,
    properties: { name },
    geometry: {
      type: 'Polygon',
      // Clockwise, as d3-geo expects for exterior rings on the sphere.
      coordinates: [
        [
          [west, south],
          [west, north],
          [east, north],
          [east, south],
          [west, south],
        ],
      ],
    },
  };
}

export function collection(...features: Feature<Polygon, CountryProperties>[]): WorldFeatures {
  return { type: 'FeatureCollection', features };
}
