// Content schemas — SITE_SPEC.md §4. A missing or invalid field fails the build,
// and Astro's error names the file and the field.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** A path under public/, e.g. `/media/recipes/ragu.jpg`, that must exist. */
const localImage = z
  .string()
  .startsWith('/media/', { message: 'image must be a path under public/media/, e.g. /media/recipes/photo.jpg' })
  .refine((p) => existsSync(join(process.cwd(), 'public', p)), {
    message: 'image file not found in public/ — check the path and file name',
  });

const journal = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    lead: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/recipes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    lead: z.string(),
    source_name: z.string(),
    source_url: z.url({ message: 'source_url must be a full URL, e.g. https://…' }),
    country: z.string(),
    /** ISO 3166-1 numeric code (iso_n3) of the challenge country, e.g. 380 or "004" */
    challenge: z
      .union([z.number().int(), z.string()])
      .transform((v) => String(v).padStart(3, '0'))
      .refine((v) => /^\d{3}$/.test(v), { message: 'challenge must be a 3-digit iso_n3 code, e.g. "380"' })
      .optional(),
    time: z.string(),
    serves: z.union([z.number(), z.string()]).transform(String),
    again: z.enum(['yes', 'no', 'maybe']),
    image: localImage,
    draft: z.boolean().default(false),
  }),
});

const listItem = z.object({
  title: z.string(),
  creator: z.string(),
  note: z.string(),
  image: localImage,
});
const ten = (name: string) => z.array(listItem).length(10, { message: `${name} must have exactly 10 entries` });

const lists = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/lists' }),
  schema: z.object({
    draft: z.boolean().default(false),
    songs: ten('songs'),
    albums: ten('albums'),
    films: ten('films'),
    books: ten('books'),
  }),
});

export const collections = { journal, recipes, lists };
