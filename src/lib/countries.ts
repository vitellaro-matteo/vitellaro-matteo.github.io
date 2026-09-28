import { load as loadYaml } from 'js-yaml';
import { z } from 'astro/zod';
import { worldGeometryIds } from './map/topology';
import countriesRaw from '../data/countries.yaml?raw';

export const CONTINENTS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'] as const;
export type Continent = (typeof CONTINENTS)[number];

/** 193 UN member states, the Holy See and Palestine. */
export const COUNTRY_TOTAL = 195;

const countrySchema = z.object({
  iso_n3: z.string().regex(/^\d{3}$/, 'iso_n3 must be a quoted 3-digit code, e.g. "004"'),
  name: z.string(),
  continent: z.enum(CONTINENTS),
  dish: z.string(),
  dish_verified: z.boolean(),
  note: z.string().optional(),
  centroid: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional(),
});

export type Country = z.infer<typeof countrySchema>;

/**
 * Validates the challenge list: exactly 195 entries, unique codes, and every
 * country either drawn from the map geometry or given a centroid for its dot.
 */
export function parseCountries(data: unknown, geometryIds: ReadonlySet<string>): Country[] {
  const schema = z
    .array(countrySchema)
    .length(COUNTRY_TOTAL, `expected exactly ${COUNTRY_TOTAL} countries`)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      list.forEach((country, i) => {
        if (seen.has(country.iso_n3)) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'iso_n3'],
            message: `duplicate iso_n3 "${country.iso_n3}" (${country.name})`,
          });
        }
        seen.add(country.iso_n3);
        if (!geometryIds.has(country.iso_n3) && !country.centroid) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'centroid'],
            message: `${country.name} (${country.iso_n3}) is not in the map geometry: add centroid: [lon, lat] so it is drawn as a dot`,
          });
        }
      });
    });

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`src/data/countries.yaml is invalid:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export const countries = parseCountries(loadYaml(countriesRaw), worldGeometryIds);
