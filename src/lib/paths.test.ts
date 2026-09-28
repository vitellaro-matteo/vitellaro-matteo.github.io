import { describe, expect, it } from 'vitest';
import { createRoutes, withBase } from './paths';

describe('withBase', () => {
  it('prefixes root-relative paths with a project base', () => {
    expect(withBase('/blog', '/journal/')).toBe('/blog/journal/');
    expect(withBase('/blog/', '/journal/')).toBe('/blog/journal/');
    expect(withBase('/blog', '/')).toBe('/blog/');
  });

  it('leaves paths unchanged with a root base', () => {
    expect(withBase('/', '/journal/')).toBe('/journal/');
    expect(withBase('/', '/')).toBe('/');
  });

  it('passes external, protocol-relative and fragment links through', () => {
    for (const base of ['/', '/blog']) {
      expect(withBase(base, 'https://example.com/a')).toBe('https://example.com/a');
      expect(withBase(base, '//cdn.example.com/a.js')).toBe('//cdn.example.com/a.js');
      expect(withBase(base, '#songs')).toBe('#songs');
    }
  });
});

describe('createRoutes', () => {
  it('builds every route under a project base', () => {
    const routes = createRoutes('/blog');
    expect(routes.home).toBe('/blog/');
    expect(routes.journalEntry('first-post')).toBe('/blog/journal/first-post/');
    expect(routes.recipe('ragu')).toBe('/blog/cooking/ragu/');
    expect(routes.challenge).toBe('/blog/cooking/around-the-world/');
    expect(routes.listYear('2025')).toBe('/blog/lists/2025/');
    expect(routes.rss).toBe('/blog/rss.xml');
  });

  it('builds every route at the root', () => {
    const routes = createRoutes('/');
    expect(routes.home).toBe('/');
    expect(routes.journal).toBe('/journal/');
    expect(routes.cooking).toBe('/cooking/');
    expect(routes.lists).toBe('/lists/');
    expect(routes.rss).toBe('/rss.xml');
  });
});
