/** "★ 4.5", or null when there is no rating to show. */
export function stars(rating: number | null | undefined): string | null {
  return rating ? `★ ${rating}` : null;
}

/** The meta line under a film: "1997 · ★ 4.5", leaving out whichever is missing. */
export function filmMeta(year: number | null, rating: number | null): string {
  return [year, stars(rating)].filter((part) => part != null).join(' · ');
}

/**
 * What a screen reader hears after a film's title, in place of the symbol-heavy
 * meta line: "(1997), rated 4.5 stars, on Letterboxd".
 */
export function filmDetails(year: number | null, rating: number | null): string {
  const rated = rating ? `rated ${rating} ${rating === 1 ? 'star' : 'stars'}` : null;
  return [year ? `(${year})` : null, rated, 'on Letterboxd']
    .filter((part) => part != null)
    .join(', ');
}

/** What a screen reader hears after a book's title: "by Author, on Goodreads". */
export function bookDetails(author: string): string {
  return author ? `by ${author}, on Goodreads` : 'on Goodreads';
}
