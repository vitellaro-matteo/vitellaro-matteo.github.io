import type { APIRoute } from 'astro';
import { faviconSvg, png } from '../lib/brand';

export const GET: APIRoute = () =>
  new Response(new Uint8Array(png(faviconSvg(), 180)), {
    headers: { 'Content-Type': 'image/png' },
  });
