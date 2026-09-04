import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const dist = (file) => path.resolve(__dirname, '../dist', file);
const plugins = ['a11y', 'cvd', 'harmonies', 'hsv', 'hwb', 'lab', 'lch', 'minify', 'mix', 'names', 'p3', 'rec2020'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      ...plugins.map((p) => ({ find: `@colordx/core/plugins/${p}`, replacement: dist(`plugins/${p}.mjs`) })),
      { find: '@colordx/core', replacement: dist('index.mjs') },
    ],
  },
});
