import { site } from '../../site.config';

/**
 * Prefixes a root-relative path with a base path. External URLs,
 * protocol-relative URLs and fragments pass through untouched, so any href or
 * src can be routed through here safely.
 */
export function withBase(base: string, path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${prefix}${path}`;
}

// Trailing slashes match the directory-style output, so GitHub Pages never redirects.
export function createRoutes(base: string) {
  const to = (path: string) => withBase(base, path);
  return {
    home: to('/'),
    journal: to('/journal/'),
    journalEntry: (id: string) => to(`/journal/${id}/`),
    cooking: to('/cooking/'),
    recipe: (id: string) => to(`/cooking/${id}/`),
    challenge: to('/cooking/around-the-world/'),
    lists: to('/lists/'),
    listYear: (year: string) => to(`/lists/${year}/`),
    rss: to('/rss.xml'),
  };
}

/** Routes a root-relative path through the site's configured base path. */
export const url = (path: string): string => withBase(site.basePath, path);

export const routes = createRoutes(site.basePath);
