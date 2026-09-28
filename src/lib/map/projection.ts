import { geoEqualEarth, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import type { Point } from './path';

export interface FittedProjection {
  projection: GeoProjection;
  width: number;
  height: number;
}

/** An Equal Earth projection scaled to `width`, with the height the shapes then need. */
export function fitEqualEarth(object: GeoPermissibleObjects, width: number): FittedProjection {
  const projection = geoEqualEarth().fitWidth(width, object);
  const [, [, bottom]] = geoPath(projection).bounds(object);
  return { projection, width, height: Math.ceil(bottom) };
}

/**
 * Projects a geometry into screen-space rings. Going through d3's path stream
 * (instead of projecting coordinates one by one) gets antimeridian clipping and
 * adaptive resampling right.
 */
export function projectRings(projection: GeoProjection, object: GeoPermissibleObjects): Point[][] {
  const rings: Point[][] = [];
  geoPath(projection, {
    moveTo: (x, y) => void rings.push([[x, y]]),
    lineTo: (x, y) => void rings.at(-1)?.push([x, y]),
    closePath: () => undefined,
    arc: () => undefined,
    beginPath: () => undefined,
  })(object);
  return rings;
}
