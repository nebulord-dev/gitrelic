#!/usr/bin/env node
/**
 * Copies the built web dashboard into the cli's own dist/ so it ships with
 * the published package.
 *
 * Context: the published `gitlore` package declares `files: ["dist"]`, so
 * only `apps/cli/dist/` lands in the npm tarball. Before this script existed,
 * the CLI's `--web` flag resolved the dashboard via `../../web/dist` from
 * `import.meta.url`, which only works inside the monorepo. Once installed
 * via npm/npx, that path resolves to the non-existent `node_modules/web/dist`
 * and `--web` crashes with ENOENT.
 *
 * Fix: copy `apps/web/dist/*` → `apps/cli/dist/web/*` after tsup builds the
 * CLI. `apps/cli/src/index.tsx` resolves the dashboard via `./web` which
 * points at `dist/web/` regardless of install location.
 *
 * This script is invoked from `apps/cli/tsup.config.ts` via `onSuccess`.
 * It assumes `@gitlore/web` has already been built — turbo enforces this
 * because `apps/cli/package.json` declares `@gitlore/web` as a devDependency.
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIST = resolve(__dirname, '../../web/dist');
const CLI_DIST_WEB = resolve(__dirname, '../dist/web');

if (!existsSync(WEB_DIST)) {
  console.error(`✗ web dist not found at ${WEB_DIST}`);
  console.error('  Run `pnpm --filter @gitlore/web build` first, or use');
  console.error('  `pnpm build` at the repo root so turbo orders the builds.');
  process.exit(1);
}

if (!existsSync(resolve(WEB_DIST, 'index.html'))) {
  console.error(`✗ web dist at ${WEB_DIST} is missing index.html`);
  console.error('  The web build may have failed or been interrupted.');
  process.exit(1);
}

if (existsSync(CLI_DIST_WEB)) {
  rmSync(CLI_DIST_WEB, { recursive: true, force: true });
}

cpSync(WEB_DIST, CLI_DIST_WEB, { recursive: true });
console.log(`✓ copied web dashboard → apps/cli/dist/web`);
