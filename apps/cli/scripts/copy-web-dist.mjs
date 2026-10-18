#!/usr/bin/env node
/**
 * Copies the built dashboards into the cli's own dist/ so they ship with the
 * published package: `apps/web/dist` → `dist/web` (classic) and
 * `apps/atlas/dist` → `dist/atlas`.
 *
 * Context: the published `gitrelic` package declares `files: ["dist"]`, so
 * only `apps/cli/dist/` lands in the npm tarball. Before this script existed,
 * the CLI's `--web` flag resolved the dashboard via `../../web/dist` from
 * `import.meta.url`, which only works inside the monorepo. Once installed
 * via npm/npx, that path resolves to the non-existent `node_modules/web/dist`
 * and `--web` crashes with ENOENT. `apps/cli/src/index.tsx` resolves each
 * dashboard next to itself instead (`./web`, `./atlas`), which holds in every
 * install location.
 *
 * This script is invoked from `apps/cli/tsdown.config.ts` via `onSuccess`.
 * It assumes both dashboards have already been built — turbo enforces this
 * because `apps/cli/package.json` declares `@gitrelic/web` and
 * `@gitrelic/atlas` as devDependencies.
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DASHBOARDS = [
  { pkg: '@gitrelic/web', from: '../../web/dist', to: '../dist/web' },
  { pkg: '@gitrelic/atlas', from: '../../atlas/dist', to: '../dist/atlas' },
];

for (const { pkg, from, to } of DASHBOARDS) {
  const src = resolve(__dirname, from);
  const dest = resolve(__dirname, to);

  if (!existsSync(src)) {
    console.error(`✗ ${pkg} dist not found at ${src}`);
    console.error(`  Run \`pnpm --filter ${pkg} build\` first, or use`);
    console.error(
      '  `pnpm build` at the repo root so turbo orders the builds.',
    );
    process.exit(1);
  }

  if (!existsSync(resolve(src, 'index.html'))) {
    console.error(`✗ ${pkg} dist at ${src} is missing index.html`);
    console.error('  The build may have failed or been interrupted.');
    process.exit(1);
  }

  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }

  cpSync(src, dest, { recursive: true });
  console.log(`✓ copied ${pkg} → apps/cli/${to.slice('../'.length)}`);
}
