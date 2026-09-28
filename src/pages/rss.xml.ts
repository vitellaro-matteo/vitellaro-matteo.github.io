import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../../site.config';

// Journal entries and recipes, newest first. Drafts are never included.
export async function GET(context: APIContext) {
  const journal = await getCollection('journal', (e) => !e.data.draft);
  const recipes = await getCollection('recipes', (e) => !e.data.draft);

  const items = [
    ...journal.map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.summary,
      link: `/journal/${e.id}/`,
    })),
    ...recipes.map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.lead,
      link: `/cooking/${e.id}/`,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: site.name,
    description: site.tagline,
    site: context.site!,
    items,
  });
}
