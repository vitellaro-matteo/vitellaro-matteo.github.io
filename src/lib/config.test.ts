import { describe, expect, it } from 'vitest';
import { isFilled } from './config';

describe('isFilled', () => {
  it('accepts real values', () => {
    expect(isFilled('matteo2601')).toBe(true);
    expect(isFilled('vitellaro-matteo')).toBe(true);
    expect(isFilled('182900584')).toBe(true);
    expect(isFilled('5vxDxvkiXxa8SCCT0MgJMI')).toBe(true);
  });

  it('rejects placeholders and blanks', () => {
    expect(isFilled('LASTFM_USERNAME')).toBe(false);
    expect(isFilled('  ')).toBe(false);
    expect(isFilled('')).toBe(false);
  });
});
