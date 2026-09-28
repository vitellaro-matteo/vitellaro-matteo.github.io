const WORDS_PER_MINUTE = 200;

/** The first sentence of a text, or the whole trimmed text if it has no sentence end. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = /[.!?](?=\s|$)/.exec(trimmed);
  return end ? trimmed.slice(0, end.index + 1) : trimmed;
}

/**
 * Reading time in whole minutes (at least 1). MDX/HTML tags are stripped first
 * so embedded components don't count as words.
 */
export function readingTime(body: string | undefined): number {
  const words = (body ?? '')
    .replace(/<[^<>]*>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
