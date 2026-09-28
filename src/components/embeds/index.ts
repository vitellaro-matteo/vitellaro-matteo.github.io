// Components available in every .mdx entry without importing them.
import Track from './Track.astro';
import Film from './Film.astro';
import Book from './Book.astro';
import Recipe from './Recipe.astro';
import Aside from './Aside.astro';
import Ingredients from './Ingredients.astro';
import Ingredient from './Ingredient.astro';

export const embeds = { Track, Film, Book, Recipe, Aside, Ingredients, Ingredient };
