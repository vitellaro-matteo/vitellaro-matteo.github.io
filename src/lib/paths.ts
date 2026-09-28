import { site } from '../../site.config';

const base = site.basePath.replace(/\/+$/, '');

/**
 * Prefixes a root-relative path with the site's base path. External URLs,
 * protocol-relative URLs and fragments pass through untouched, so any href or
 * src can be routed through here safely.
 */
export function url(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return `${base}${path}`;
}

// Trailing slashes match the directory-style output, so GitHub Pages never redirects.
export const routes = {
  home: url('/'),
  journal: url('/journal/'),
  journalEntry: (id: string) => url(`/journal/${id}/`),
  cooking: url('/cooking/'),
  recipe: (id: string) => url(`/cooking/${id}/`),
  challenge: url('/cooking/around-the-world/'),
  lists: url('/lists/'),
  listYear: (year: string) => url(`/lists/${year}/`),
  rss: url('/rss.xml'),
};
