// Content schemas — docs/DESIGN.md §5. They live here, not in content.config.ts,
// so the CMS configuration test can read them without Astro's virtual modules;
// public/admin/config.yml must describe exactly these fields (src/lib/cms.test.ts).
import { z } from 'astro/zod';

/**
 * Astro's `image()` schema helper: an image file next to the entry, optimised at
 * build time. Passed in because it only exists inside a collection's schema;
 * generic so each schema keeps the helper's output type (ImageMetadata).
 */
export type ImageHelper<I extends z.ZodType = z.ZodType> = () => I;

export const LIST_CATEGORIES = ['songs', 'albums', 'films', 'books'] as const;
export const LIST_LENGTH = 10;

export const journalSchema = <I extends z.ZodType>(image: ImageHelper<I>) =>
  z.object({
    title: z.string(),
    date: z.coerce.date(),
    lead: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    cover: image().optional(),
  });

export const recipeSchema = <I extends z.ZodType>(image: ImageHelper<I>) =>
  z.object({
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
      .refine((v) => /^\d{3}$/.test(v), {
        message: 'challenge must be a 3-digit iso_n3 code, e.g. "380"',
      })
      .optional(),
    time: z.string(),
    serves: z.union([z.number(), z.string()]).transform(String),
    again: z.enum(['yes', 'no', 'maybe']),
    image: image(),
    draft: z.boolean().default(false),
  });

export const listSchema = <I extends z.ZodType>(image: ImageHelper<I>) => {
  const item = z.object({
    title: z.string(),
    creator: z.string(),
    note: z.string(),
    image: image(),
  });
  const category = z
    .array(item)
    .max(LIST_LENGTH, { message: `at most ${LIST_LENGTH} entries per category` })
    .default([]);

  // A list is filled in over time, so a draft may hold fewer than ten of each;
  // a published list has exactly ten.
  return z
    .object({
      draft: z.boolean().default(false),
      songs: category,
      albums: category,
      films: category,
      books: category,
    })
    .superRefine((list, ctx) => {
      if (list.draft) return;
      for (const name of LIST_CATEGORIES) {
        if (list[name].length !== LIST_LENGTH) {
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: `${name} must have exactly ${LIST_LENGTH} entries once published (draft: false)`,
          });
        }
      }
    });
};
