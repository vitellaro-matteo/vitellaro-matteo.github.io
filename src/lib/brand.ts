import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import opentype, { type Font, type Path } from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import { site } from '../../site.config';
import { colour } from './tokens';

// Build-time images (favicon, Open Graph cards) drawn from the site's own
// fonts and tokens. Text is converted to outlines, so the images never depend
// on fonts installed on the machine that renders them.

const require = createRequire(import.meta.url);
const fonts = new Map<string, Font>();

function font(file: string): Font {
  let loaded = fonts.get(file);
  if (!loaded) {
    const buffer = readFileSync(require.resolve(file));
    loaded = opentype.parse(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length),
    );
    fonts.set(file, loaded);
  }
  return loaded;
}

const display = () =>
  font('@fontsource/shippori-mincho/files/shippori-mincho-latin-400-normal.woff');
const mono = () => font('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff');

interface TextStyle {
  font: Font;
  size: number;
  /** Extra space after each glyph, in em, like CSS letter-spacing. */
  tracking?: number;
}

/** Rendered width of a line of text, in px. */
export function measure(text: string, style: TextStyle): number {
  const { font: f, size, tracking = 0 } = style;
  const glyphs = f.stringToGlyphs(text);
  const scale = size / f.unitsPerEm;
  return glyphs.reduce((width, glyph, i) => {
    const previous = glyphs[i - 1];
    const kerning = previous ? f.getKerningValue(previous, glyph) * scale : 0;
    return width + kerning + (glyph.advanceWidth ?? 0) * scale + tracking * size;
  }, 0);
}

const n = (value: number) => String(Math.round(value * 100) / 100);

/**
 * SVG path data for an outline. Written out here because opentype.js 2's own
 * toPathData prints some finite coordinates as NaN, and resvg stops drawing a
 * path at the first NaN, cutting the rest of the text from the image.
 */
export function pathData(path: Path): string {
  return path.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${n(c.x)} ${n(c.y)}`;
        case 'Q':
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case 'C':
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case 'Z':
          return 'Z';
      }
    })
    .join('');
}

/** SVG path data for a line of text with its baseline starting at (x, y). */
function outline(text: string, x: number, y: number, style: TextStyle): string {
  const { font: f, size, tracking = 0 } = style;
  const glyphs = f.stringToGlyphs(text);
  const scale = size / f.unitsPerEm;
  let cursor = x;
  return glyphs
    .map((glyph, i) => {
      const previous = glyphs[i - 1];
      if (previous) cursor += f.getKerningValue(previous, glyph) * scale;
      const data = pathData(glyph.getPath(cursor, y, size));
      cursor += (glyph.advanceWidth ?? 0) * scale + tracking * size;
      return data;
    })
    .join('');
}

/**
 * Greedy word wrap. A word wider than the line gets a line of its own rather
 * than being broken.
 */
export function wrap(text: string, maxWidth: number, width: (line: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && width(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const svg = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

/** The favicon: a lowercase "m" in the display face, ink on paper. */
export function faviconSvg(): string {
  const box = 32;
  const glyph = display().getPath('m', 0, 0, box);
  const { x1, y1, x2, y2 } = glyph.getBoundingBox();
  // Fit the glyph's ink (not its advance box) to 26 of 32px so it reads at 16px.
  const scale = 26 / Math.max(x2 - x1, y2 - y1);
  const size = box * scale;
  const x = (box - (x2 - x1) * scale) / 2 - x1 * scale;
  const y = (box - (y2 - y1) * scale) / 2 - y1 * scale;
  return svg(
    box,
    box,
    `<rect width="${box}" height="${box}" fill="${colour('paper')}"/>` +
      `<path fill="${colour('ink')}" d="${pathData(display().getPath('m', x, y, size))}"/>`,
  );
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * A 1200×630 share card in the page-intro style: the wordmark and tagline
 * over the header rule, then the mono accent label and the title in the
 * display face.
 */
export function ogSvg(label: string, title: string): string {
  const pad = 80;
  const wordmark: TextStyle = { font: display(), size: 48 };
  const tagline: TextStyle = { font: mono(), size: 20, tracking: 0.06 };
  const labelStyle: TextStyle = { font: mono(), size: 24, tracking: 0.06 };
  const titleStyle: TextStyle = { font: display(), size: 84 };
  const lineHeight = titleStyle.size * 1.1;

  const lines = wrap(title, OG_WIDTH - pad * 2, (line) => measure(line, titleStyle));
  const lastBaseline = OG_HEIGHT - pad - 12;
  const firstBaseline = lastBaseline - (lines.length - 1) * lineHeight;
  const brandBaseline = pad + 36;

  const paths = [
    { fill: 'ink', d: outline(site.name, pad, brandBaseline, wordmark) },
    {
      fill: 'muted',
      d: outline(site.tagline, pad + measure(site.name, wordmark) + 20, brandBaseline, tagline),
    },
    { fill: 'accent', d: outline(label, pad, firstBaseline - titleStyle.size - 8, labelStyle) },
    ...lines.map((line, i) => ({
      fill: 'ink',
      d: outline(line, pad, firstBaseline + i * lineHeight, titleStyle),
    })),
  ];

  return svg(
    OG_WIDTH,
    OG_HEIGHT,
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${colour('paper')}"/>` +
      `<rect x="0" y="${brandBaseline + 36}" width="${OG_WIDTH}" height="1" fill="${colour('line')}"/>` +
      paths.map(({ fill, d }) => `<path fill="${colour(fill)}" d="${d}"/>`).join(''),
  );
}

/** Rasterises an SVG to a PNG of the given width. */
export function png(source: string, width: number): Buffer {
  return new Resvg(source, { fitTo: { mode: 'width', value: width } }).render().asPng();
}
