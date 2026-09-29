import { describe, expect, it } from 'vitest';
import { bookLabel, filmLabel, filmMeta, stars } from './labels';

describe('stars', () => {
  it('shows a rating and nothing for unrated items', () => {
    expect(stars(4.5)).toBe('★ 4.5');
    expect(stars(5)).toBe('★ 5');
    expect(stars(null)).toBeNull();
    expect(stars(0)).toBeNull();
  });
});

describe('filmMeta', () => {
  it('joins year and rating, leaving out what is missing', () => {
    expect(filmMeta(1997, 4.5)).toBe('1997 · ★ 4.5');
    expect(filmMeta(2024, null)).toBe('2024');
    expect(filmMeta(null, 3)).toBe('★ 3');
    expect(filmMeta(null, null)).toBe('');
  });
});

describe('filmLabel', () => {
  it('names the film, year and rating', () => {
    expect(filmLabel('Perfect Days', 2023, 4.5)).toBe(
      'Perfect Days (2023), rated 4.5 stars on Letterboxd',
    );
    expect(filmLabel('Ikiru', 1952, 1)).toBe('Ikiru (1952), rated 1 star on Letterboxd');
  });

  it('leaves out a missing year or rating', () => {
    expect(filmLabel('Paris, Texas', 1984, null)).toBe('Paris, Texas (1984) on Letterboxd');
    expect(filmLabel('Untitled', null, null)).toBe('Untitled on Letterboxd');
  });
});

describe('bookLabel', () => {
  it('names the book and its author', () => {
    expect(bookLabel('Piranesi', 'Susanna Clarke')).toBe('Piranesi by Susanna Clarke on Goodreads');
    expect(bookLabel('Anonymous', '')).toBe('Anonymous on Goodreads');
  });
});
