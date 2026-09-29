import type { APIRoute } from 'astro';
import { url } from '../lib/paths';

export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${new URL(url('/sitemap-index.xml'), site)}\n`,
    {
      headers: { 'Content-Type': 'text/plain' },
    },
  );
