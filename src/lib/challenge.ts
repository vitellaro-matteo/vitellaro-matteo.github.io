import { getRecipes } from './content';
import { countries } from './countries';
import { cookedByCountry } from './map/cooked';
import { fitEqualEarth, type FittedProjection } from './map/projection';
import { worldFeatures, worldTopology, type WorldFeatures } from './map/topology';
import { buildWorldMap, type CookedCountry, type WorldMap } from './map/world-map';
import { routes } from './paths';

const MAP_WIDTH = 1000;

// The full map fills the container on the challenge page; the mini map sits in
// a card or band at roughly half that width, so it can be coarser and lighter.
const DETAIL = {
  full: { keep: 0.1, unit: 0.5 },
  mini: { keep: 0.05, unit: 1 },
} as const;

export type MapDetail = keyof typeof DETAIL;

// Geometry never changes during a build, so each detail level is simplified and
// fitted once and shared by every page that draws it.
const layers = new Map<MapDetail, { features: WorldFeatures; fitted: FittedProjection }>();

function layer(detail: MapDetail) {
  let cached = layers.get(detail);
  if (!cached) {
    const features = worldFeatures(worldTopology, DETAIL[detail].keep);
    cached = { features, fitted: fitEqualEarth(features, MAP_WIDTH) };
    layers.set(detail, cached);
  }
  return cached;
}

/** Cooked countries, keyed by iso_n3, from the recipes' `challenge` field. */
export async function getCooked(): Promise<Map<string, CookedCountry>> {
  const known = new Set(countries.map((c) => c.iso_n3));
  return cookedByCountry(await getRecipes(), known, routes.recipe);
}

export function challengeMap(
  detail: MapDetail,
  cooked: ReadonlyMap<string, CookedCountry>,
): WorldMap {
  const { features, fitted } = layer(detail);
  return buildWorldMap(features, fitted, countries, cooked, {
    unit: DETAIL[detail].unit,
    dotBelowArea: 4,
    dotRadius: 1.5,
  });
}
