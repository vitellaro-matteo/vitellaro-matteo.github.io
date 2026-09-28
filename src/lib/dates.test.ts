import { describe, expect, it } from 'vitest';
import { formatDate, previousWeekMeta, relativeTime } from './dates';

const BERLIN = 'Europe/Berlin';

describe('previousWeekMeta', () => {
  it('describes the previous Monday–Sunday week', () => {
    expect(previousWeekMeta(new Date('2026-09-28T10:00:00Z'), BERLIN)).toBe(
      'week 39 · 21–27 sep 2026',
    );
  });

  it('gives the same week on any day of the current week', () => {
    expect(previousWeekMeta(new Date('2026-10-04T10:00:00Z'), BERLIN)).toBe(
      'week 39 · 21–27 sep 2026',
    );
  });

  it('names both months when the week crosses a month boundary', () => {
    expect(previousWeekMeta(new Date('2026-10-05T10:00:00Z'), BERLIN)).toBe(
      'week 40 · 28 sep–4 oct 2026',
    );
  });

  it('names both years when the week crosses a year boundary', () => {
    // 29 Dec 2025 – 4 Jan 2026 is ISO week 1 of 2026.
    expect(previousWeekMeta(new Date('2026-01-05T10:00:00Z'), BERLIN)).toBe(
      'week 01 · 29 dec 2025–4 jan 2026',
    );
  });

  it('handles week 53 in long ISO years', () => {
    expect(previousWeekMeta(new Date('2027-01-04T10:00:00Z'), BERLIN)).toBe(
      'week 53 · 28 dec 2026–3 jan 2027',
    );
  });

  it('uses the calendar date in the site timezone, not UTC', () => {
    // Still Sunday in UTC, but already Monday in Berlin.
    expect(previousWeekMeta(new Date('2026-09-27T23:30:00Z'), BERLIN)).toBe(
      'week 39 · 21–27 sep 2026',
    );
    expect(previousWeekMeta(new Date('2026-09-27T23:30:00Z'), 'UTC')).toBe(
      'week 38 · 14–20 sep 2026',
    );
  });
});

describe('formatDate', () => {
  it('formats plain dates without shifting the day', () => {
    expect(formatDate('2026-09-21', BERLIN)).toBe('21 sep 2026');
    expect(formatDate('2026-01-01', 'America/Los_Angeles')).toBe('1 jan 2026');
  });

  it('formats timestamps in the site timezone', () => {
    expect(formatDate('2026-12-31T23:30:00Z', BERLIN)).toBe('1 jan 2027');
    expect(formatDate(new Date('2026-03-15T12:00:00Z'), BERLIN)).toBe('15 mar 2026');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-09-28T12:00:00Z');

  it('uses minutes, then hours, then days', () => {
    expect(relativeTime('2026-09-28T11:20:00Z', now)).toBe('40m ago');
    expect(relativeTime('2026-09-28T07:00:00Z', now)).toBe('5h ago');
    expect(relativeTime('2026-09-25T12:00:00Z', now)).toBe('3d ago');
  });

  it('never goes negative for timestamps in the future', () => {
    expect(relativeTime('2026-09-28T13:00:00Z', now)).toBe('0m ago');
  });
});
