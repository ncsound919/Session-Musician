import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const disableHmr = process.env.DISABLE_HMR === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },

  server: {
    // HMR is disabled in AI Studio when DISABLE_HMR=true.
    // File watching is also disabled to prevent flickering during agent edits.
    hmr: disableHmr ? false : undefined,
    watch: disableHmr ? null : {},
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});