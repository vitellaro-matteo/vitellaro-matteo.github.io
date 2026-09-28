import { describe, expect, it } from 'vitest';
import { firstSentence, readingTime } from './text';

describe('firstSentence', () => {
  it('stops at the first sentence end', () => {
    expect(firstSentence('Quiet and patient. Then it hits you.')).toBe('Quiet and patient.');
    expect(firstSentence('Really? Yes.')).toBe('Really?');
  });

  it('ignores full stops inside words and numbers', () => {
    expect(firstSentence('Shot on 35.5mm film, beautifully. Worth it.')).toBe(
      'Shot on 35.5mm film, beautifully.',
    );
  });

  it('returns the whole trimmed text when there is no sentence end', () => {
    expect(firstSentence('  just a fragment  ')).toBe('just a fragment');
  });
});

describe('readingTime', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

  it('rounds to whole minutes at 200 words per minute', () => {
    expect(readingTime(words(400))).toBe(2);
    expect(readingTime(words(700))).toBe(4);
  });

  it('is at least one minute, even for empty bodies', () => {
    expect(readingTime(words(10))).toBe(1);
    expect(readingTime('')).toBe(1);
    expect(readingTime(undefined)).toBe(1);
  });

  it('does not count component tags as words', () => {
    const body = `${words(200)} <Track id="abc" label="on repeat in spring" /> <Aside>`;
    expect(readingTime(body)).toBe(1);
  });
});
