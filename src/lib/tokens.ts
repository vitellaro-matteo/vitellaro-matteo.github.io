import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Colour tokens from a stylesheet: `--paper: #f3efe7;` → `{ paper: '#f3efe7' }`. */
export function parseColourTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  // Only declarations at the start of a line: the commented-out alternative
  // accents are indented inside a comment and start with "--accent" too.
  for (const [, name, value] of css.matchAll(/^\s{2}--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gim)) {
    if (name && value && !(name in tokens)) tokens[name] = value.toLowerCase();
  }
  return tokens;
}

/** The site's colour tokens, read from src/styles/tokens.css so images and checks never drift. */
// Read from disk rather than imported: Vitest stubs CSS imports, and this only runs at build time.
export const colours = parseColourTokens(
  readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8'),
);

export function colour(name: string): string {
  const value = colours[name];
  if (!value) throw new Error(`No colour token --${name} in src/styles/tokens.css`);
  return value;
}
