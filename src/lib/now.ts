import { load as loadYaml } from 'js-yaml';
import { z } from 'astro/zod';
import { goodreads } from './feeds';
import nowRaw from '../data/now.yaml?raw';

const nowSchema = z.object({
  on_repeat: z.string(),
  reading: z.string().nullish(),
  thinking_about: z.string(),
  progress: z
    .object({ page: z.number().int().nonnegative(), of: z.number().int().positive() })
    .nullish(),
  updated: z.coerce.date(),
});

const parsed = nowSchema.safeParse(loadYaml(nowRaw) ?? {});
if (!parsed.success) {
  throw new Error(`src/data/now.yaml is invalid:\n${z.prettifyError(parsed.error)}`);
}

const currentBook = goodreads?.currently_reading[0];

/** The hand-edited "now" box, with `reading` falling back to the current Goodreads book. */
export const now = {
  ...parsed.data,
  reading: parsed.data.reading || (currentBook?.title ?? ''),
  progress: parsed.data.progress ?? null,
};
