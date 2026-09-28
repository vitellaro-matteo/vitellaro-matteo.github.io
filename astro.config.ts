import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { site } from './site.config';
import { basePathPlugin } from './src/lib/base-path-plugin';

export default defineConfig({
  site: site.url,
  base: site.basePath,
  output: 'static',
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: satteri({ hastPlugins: [basePathPlugin] }),
  },
});
