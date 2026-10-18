import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  // Relative asset URLs, so the same build works at `/` (--ui classic) and
  // under `/classic/` (--ui atlas).
  base: './',
  server: { port: 7777 },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    pool: 'vmThreads',
  },
});
