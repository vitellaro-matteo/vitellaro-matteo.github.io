import type { APIRoute, GetStaticPaths } from 'astro';
import { ogSvg, OG_WIDTH, png } from '../../lib/brand';
import { OG_CARDS, type OgType } from '../../lib/og';

export const getStaticPaths = (() =>
  Object.keys(OG_CARDS).map((type) => ({ params: { type } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const { label, title } = OG_CARDS[params.type as OgType];
  return new Response(new Uint8Array(png(ogSvg(label, title), OG_WIDTH)), {
    headers: { 'Content-Type': 'image/png' },
  });
};
