import { describe, expect, it } from 'vitest';
import { bookDetails, filmDetails, filmMeta, stars } from './labels';

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

describe('filmDetails', () => {
  it('spells out the year and rating', () => {
    expect(filmDetails(2023, 4.5)).toBe('(2023), rated 4.5 stars, on Letterboxd');
    expect(filmDetails(1952, 1)).toBe('(1952), rated 1 star, on Letterboxd');
  });

  it('leaves out a missing year or rating', () => {
    expect(filmDetails(1984, null)).toBe('(1984), on Letterboxd');
    expect(filmDetails(null, null)).toBe('on Letterboxd');
  });
});

describe('bookDetails', () => {
  it('names the author', () => {
    expect(bookDetails('Susanna Clarke')).toBe('by Susanna Clarke, on Goodreads');
    expect(bookDetails('')).toBe('on Goodreads');
  });
});
