// Content collections — docs/DESIGN.md §5. A missing or invalid field fails the
// build, and Astro's error names the file and the field. Each entry is a folder
// holding the entry and its images, e.g. src/content/recipes/ragu/index.mdx.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { journalSchema, listSchema, recipeSchema } from './lib/schemas';

const journal = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/journal' }),
  schema: ({ image }) => journalSchema(image),
});

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/recipes' }),
  schema: ({ image }) => recipeSchema(image),
});

const lists = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/lists' }),
  schema: ({ image }) => listSchema(image),
});

export const collections = { journal, recipes, lists };
