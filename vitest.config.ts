import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/core/vitest.config.ts',
      'packages/scene/vitest.config.ts',
      'apps/web/vite.config.ts',
      'apps/cli/vitest.config.ts',
    ],
  },
});
