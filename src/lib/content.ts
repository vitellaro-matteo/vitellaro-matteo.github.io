import { getCollection, type CollectionEntry } from 'astro:content';

// Drafts (including the example files) show in `npm run dev` only, never in the build.
const showDrafts = import.meta.env.DEV;
const visible = (entry: { data: { draft: boolean } }) => showDrafts || !entry.data.draft;
const newestFirst = (a: { data: { date: Date } }, b: { data: { date: Date } }) =>
  b.data.date.getTime() - a.data.date.getTime();

/** Shown where the rows would be while a section has nothing published. */
export const emptyNotes = {
  journal: 'First entry coming soon.',
  cooking: 'Nothing cooked yet.',
  lists: 'The first list arrives in December.',
};

const isYear = (id: string) => /^\d{4}$/.test(id);

export type JournalEntry = CollectionEntry<'journal'>;
export type Recipe = CollectionEntry<'recipes'>;
export type List = CollectionEntry<'lists'>;

export async function getJournal(): Promise<JournalEntry[]> {
  return (await getCollection('journal', visible)).sort(newestFirst);
}

export async function getRecipes(): Promise<Recipe[]> {
  return (await getCollection('recipes', visible)).sort(newestFirst);
}

/** Lists, newest year first. Non-draft files must be named after their year, e.g. 2025.yaml. */
export async function getLists(): Promise<List[]> {
  const lists = await getCollection('lists', visible);
  for (const list of lists) {
    if (!list.data.draft && !isYear(list.id)) {
      throw new Error(
        `src/content/lists/${list.id}.yaml: list files must be named after their year, e.g. 2025.yaml`,
      );
    }
  }
  return lists.sort((a, b) => b.id.localeCompare(a.id));
}

/** Latest year that has a list file (drafts and non-year names excluded). */
export async function latestListYear(): Promise<string | null> {
  const latest = (await getLists()).find((list) => isYear(list.id));
  return latest?.id ?? null;
}

/** Number of distinct challenge countries cooked. */
export function cookedCount(recipes: Recipe[]): number {
  return new Set(recipes.map((r) => r.data.challenge).filter(Boolean)).size;
}

/** Reading time in minutes, at 200 words per minute. */
export function readingTime(body: string | undefined): number {
  const words = (body ?? '')
    .replace(/<[^<>]*>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Older / newer neighbours in a newest-first list. */
export function neighbours<T>(items: T[], index: number): { older?: T; newer?: T } {
  return { older: items[index + 1], newer: items[index - 1] };
}
