import type { CookedCountry } from './world-map';

export interface ChallengeRecipe {
  id: string;
  data: { date: Date; challenge?: string };
}

/**
 * Which countries have been cooked, and by which recipe. When a country has
 * several recipes, the most recent one wins. A `challenge` code that isn't in
 * the country list fails the build, since it would silently never show.
 */
export function cookedByCountry(
  recipes: readonly ChallengeRecipe[],
  knownIsos: ReadonlySet<string>,
  hrefFor: (recipeId: string) => string,
): Map<string, CookedCountry> {
  const cooked = new Map<string, CookedCountry>();
  for (const recipe of recipes) {
    const iso = recipe.data.challenge;
    if (!iso) continue;
    if (!knownIsos.has(iso)) {
      throw new Error(
        `src/content/recipes/${recipe.id}.mdx: challenge "${iso}" is not an iso_n3 code in src/data/countries.yaml`,
      );
    }
    const current = cooked.get(iso);
    if (!current || recipe.data.date > current.date) {
      cooked.set(iso, { href: hrefFor(recipe.id), date: recipe.data.date });
    }
  }
  return cooked;
}
