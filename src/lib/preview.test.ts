import { describe, expect, it } from 'vitest';
import { PREVIEW_SECONDS, previewFinished, previewProgress } from './preview';

describe('previewProgress', () => {
  it('is the share of a 30-second clip played', () => {
    expect(previewProgress(0, 30)).toBe(0);
    expect(previewProgress(15, 30)).toBe(0.5);
    expect(previewProgress(30, 30)).toBe(1);
  });

  it('caps longer clips at 30 seconds', () => {
    expect(previewProgress(15, 120)).toBe(0.5);
    expect(previewProgress(45, 120)).toBe(1);
  });

  it('uses the real length of shorter clips', () => {
    expect(previewProgress(10, 20)).toBe(0.5);
  });

  it('treats an unknown duration as 30 seconds', () => {
    expect(previewProgress(6, Number.NaN)).toBeCloseTo(0.2);
    expect(previewProgress(6, Number.POSITIVE_INFINITY)).toBeCloseTo(0.2);
    expect(previewProgress(6, 0)).toBeCloseTo(0.2);
  });

  it('stays between 0 and 1', () => {
    expect(previewProgress(-1, 30)).toBe(0);
    expect(previewProgress(99, 30)).toBe(1);
  });
});

describe('previewFinished', () => {
  it('ends at 30 seconds or at the end of a shorter clip', () => {
    expect(PREVIEW_SECONDS).toBe(30);
    expect(previewFinished(29.9, 120)).toBe(false);
    expect(previewFinished(30, 120)).toBe(true);
    expect(previewFinished(20, 20)).toBe(true);
  });
});
