import type { APIRoute } from 'astro';
import { faviconSvg, png } from '../lib/brand';

// PNG fallback for browsers without SVG favicon support.
export const GET: APIRoute = () =>
  new Response(new Uint8Array(png(faviconSvg(), 32)), { headers: { 'Content-Type': 'image/png' } });
