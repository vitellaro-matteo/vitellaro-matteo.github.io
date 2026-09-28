import { describe, expect, it } from 'vitest';
import { placeholderTone } from './placeholder';

describe('placeholderTone', () => {
  it('cycles through the three kraft tones', () => {
    expect([0, 1, 2, 3, 4, 5].map(placeholderTone)).toEqual([1, 2, 3, 1, 2, 3]);
  });
});
