/** "★ 4.5", or null when there is no rating to show. */
export function stars(rating: number | null | undefined): string | null {
  return rating ? `★ ${rating}` : null;
}

/** The meta line under a film: "1997 · ★ 4.5", leaving out whichever is missing. */
export function filmMeta(year: number | null, rating: number | null): string {
  return [year, stars(rating)].filter((part) => part != null).join(' · ');
}

/** Screen-reader name of a film tile: "Title (1997), rated 4.5 stars on Letterboxd". */
export function filmLabel(title: string, year: number | null, rating: number | null): string {
  const name = year ? `${title} (${year})` : title;
  const rated = rating ? `, rated ${rating} ${rating === 1 ? 'star' : 'stars'}` : '';
  return `${name}${rated} on Letterboxd`;
}

/** Screen-reader name of a book tile: "Title by Author on Goodreads". */
export function bookLabel(title: string, author: string): string {
  return author ? `${title} by ${author} on Goodreads` : `${title} on Goodreads`;
}
