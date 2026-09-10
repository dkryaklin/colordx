import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';

const dist = (file) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));
const plugins = ['a11y', 'cvd', 'harmonies', 'hsv', 'hwb', 'lab', 'lch', 'minify', 'mix', 'names', 'p3', 'rec2020'];

export default defineConfig({
  site: 'https://colordx.dev',
  // /palette, not /palette/ — the URLs the SPA already served
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [react()],
  vite: {
    resolve: {
      alias: [
        ...plugins.map((p) => ({ find: `@colordx/core/plugins/${p}`, replacement: dist(`plugins/${p}.mjs`) })),
        { find: '@colordx/core', replacement: dist('index.mjs') },
      ],
    },
  },
});
