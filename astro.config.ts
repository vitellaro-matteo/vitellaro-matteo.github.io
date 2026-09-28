import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { site } from './site.config';

export default defineConfig({
  site: site.url,
  output: 'static',
  integrations: [mdx(), sitemap()],
});
