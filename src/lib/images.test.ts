import { describe, expect, it } from 'vitest';
import { CARD_IMAGE, COLUMN_IMAGE, fixedImage } from './images';

describe('fixedImage', () => {
  it('offers the shown width and twice it', () => {
    expect(fixedImage(104)).toEqual({ widths: [104, 208], sizes: '104px' });
  });
});

describe('responsive presets', () => {
  it.each([
    ['column', COLUMN_IMAGE, 640],
    ['card', CARD_IMAGE, 352],
  ])('%s widths ascend and cover the desktop size at 2x', (_, preset, desktop) => {
    expect([...preset.widths].sort((a, b) => a - b)).toEqual(preset.widths);
    expect(Math.max(...preset.widths)).toBeGreaterThanOrEqual(desktop * 1.5);
    expect(preset.sizes.endsWith(`${desktop}px`)).toBe(true);
  });
});
