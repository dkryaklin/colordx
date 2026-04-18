import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const dist = (file) => path.resolve(__dirname, '../dist', file);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@colordx/core/plugins/a11y', replacement: dist('plugins/a11y.mjs') },
      { find: '@colordx/core/plugins/harmonies', replacement: dist('plugins/harmonies.mjs') },
      { find: '@colordx/core/plugins/hsv', replacement: dist('plugins/hsv.mjs') },
      { find: '@colordx/core/plugins/hwb', replacement: dist('plugins/hwb.mjs') },
      { find: '@colordx/core/plugins/lab', replacement: dist('plugins/lab.mjs') },
      { find: '@colordx/core/plugins/lch', replacement: dist('plugins/lch.mjs') },
      { find: '@colordx/core/plugins/mix', replacement: dist('plugins/mix.mjs') },
      { find: '@colordx/core/plugins/p3', replacement: dist('plugins/p3.mjs') },
      { find: '@colordx/core', replacement: dist('index.mjs') },
    ],
  },
});
