import { describe, expect, it } from 'vitest';
import { cookedByCountry, type ChallengeRecipe } from './cooked';

const known = new Set(['380', '724']);
const href = (id: string) => `/cooking/${id}/`;
const recipe = (id: string, date: string, challenge?: string): ChallengeRecipe => ({
  id,
  data: { date: new Date(date), challenge },
});

describe('cookedByCountry', () => {
  it('maps each challenge country to its recipe', () => {
    const cooked = cookedByCountry(
      [recipe('ragu', '2026-09-01', '380'), recipe('toast', '2026-09-02')],
      known,
      href,
    );
    expect([...cooked.keys()]).toEqual(['380']);
    expect(cooked.get('380')?.href).toBe('/cooking/ragu/');
  });

  it('keeps the most recent recipe when a country is cooked twice', () => {
    const cooked = cookedByCountry(
      [recipe('older', '2026-01-01', '724'), recipe('newer', '2026-06-01', '724')],
      known,
      href,
    );
    expect(cooked.get('724')?.href).toBe('/cooking/newer/');
  });

  it('fails loudly on a code that is not in the country list', () => {
    expect(() => cookedByCountry([recipe('mystery', '2026-01-01', '999')], known, href)).toThrow(
      /mystery\.mdx: challenge "999"/,
    );
  });
});
