import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  // @gitlore/core is private and not published separately, so inline its source
  // into the CLI bundle. Its runtime dependencies (currently just execa) must
  // be declared in apps/cli/package.json so they resolve at install time.
  noExternal: ['@gitlore/core'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
