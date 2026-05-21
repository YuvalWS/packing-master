import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'src/lib'),
      $app: path.resolve(__dirname, 'tests/component/mocks/app')
    },
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/component/**/*.test.ts'],
    setupFiles: ['./tests/component/setup.ts']
  }
});
