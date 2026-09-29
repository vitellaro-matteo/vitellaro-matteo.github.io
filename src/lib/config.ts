/**
 * Whether a site.config.ts value has been filled in. Placeholders are written in
 * CAPITALS (e.g. `LASTFM_USERNAME`); an all-digit value like a Goodreads id is
 * real. Same rule as scripts/site_config.py, so the site and the fetchers agree.
 */
export function isFilled(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== '' && !/^(?=.*[A-Z])[A-Z0-9_]+$/.test(trimmed);
}
