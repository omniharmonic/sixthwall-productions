import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { site } from './src/config/site';

// The canonical origin lives in src/config/site.ts so that the sitemap, the
// <link rel="canonical">, and the Open Graph tags can never drift apart from
// the CNAME we hand to GitHub Pages.
export default defineConfig({
  site: site.url,
  trailingSlash: 'never',
  build: {
    // One page today, but assets/ keeps the deploy artifact tidy as we grow.
    assets: 'assets',
  },
  integrations: [sitemap()],
  devToolbar: {
    enabled: false,
  },
});
