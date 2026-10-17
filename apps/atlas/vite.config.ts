import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

import { devData } from './dev/devData';

export default defineConfig({
  plugins: [tailwindcss(), svelte(), svelteTesting(), devData()],
  // 7777 is classic's dev port and the CLI's preferred port.
  server: { port: 7778 },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
