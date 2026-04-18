import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.tsx'],
  // @gitrelic/core is private and not published separately, so inline its source
  // into the CLI bundle. Its runtime dependencies (currently just execa) must
  // be declared in apps/cli/package.json so they resolve at install time.
  deps: { alwaysBundle: ['@gitrelic/core'] },
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Copy the built web dashboard into dist/web/ so it ships inside the
  // published package (apps/cli/package.json files: ["dist"]). Without this
  // step the `--web` flag crashes at runtime because `../../web/dist` only
  // resolves inside the monorepo. See scripts/copy-web-dist.mjs for detail.
  onSuccess: 'node scripts/copy-web-dist.mjs',
});
