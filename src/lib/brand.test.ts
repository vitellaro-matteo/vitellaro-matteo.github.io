import { describe, expect, it } from 'vitest';
import { Path } from 'opentype.js';
import { faviconSvg, ogSvg, pathData, png, wrap } from './brand';

const chars = (line: string) => line.length;

describe('wrap', () => {
  it('fills each line up to the width', () => {
    expect(wrap('one two three four', 9, chars)).toEqual(['one two', 'three', 'four']);
  });

  it('keeps a word wider than the line on its own line', () => {
    expect(wrap('a extraordinarily b', 5, chars)).toEqual(['a', 'extraordinarily', 'b']);
  });

  it('collapses whitespace and returns nothing for blank text', () => {
    expect(wrap('  a   b  ', 10, chars)).toEqual(['a b']);
    expect(wrap('   ', 10, chars)).toEqual([]);
  });
});

describe('pathData', () => {
  it('rounds coordinates to two decimals', () => {
    const path = new Path();
    path.moveTo(159.20000000000002, 437);
    path.quadraticCurveTo(164.43333, 426.608, 163.736, 426.896);
    path.close();
    expect(pathData(path)).toBe('M159.2 437Q164.43 426.61 163.74 426.9Z');
  });
});

describe('images', () => {
  it('draws the favicon from the site tokens', () => {
    const svg = faviconSvg();
    expect(svg).toContain('fill="#f3efe7"');
    expect(svg).toContain('fill="#2a2724"');
    expect(svg).not.toContain('NaN');
  });

  it('never writes NaN into the share card', () => {
    expect(ogSvg('cooking', "What I've been cooking")).not.toContain('NaN');
  });

  it('rasterises the share card at 1200×630', () => {
    const image = png(ogSvg('journal', 'Notes & essays'), 1200);
    expect(image.subarray(1, 4).toString()).toBe('PNG');
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
  });
});
