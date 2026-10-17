#!/usr/bin/env node
// Regenerates the small report fixture that scene tests and the Atlas dev
// server use: the deterministic sample repo, analyzed with "now" pinned so
// age-based analyzers don't drift between runs.
//
// Usage: node scripts/make-scene-fixtures.mjs
// Requires a built core (`pnpm --filter @gitrelic/core build`). Rerun it when
// a report field is added; scene's fixture test fails until you do.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'packages/scene/test/fixtures');

// Same anchor as packages/core/src/fixture-regression.test.ts.
const FROZEN_NOW = Date.parse('2026-05-01T12:00:00Z');
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FROZEN_NOW);
    else super(...args);
  }
  static now() {
    return FROZEN_NOW;
  }
};

const { buildCommitIndex, runGitrelic } = await import(
  path.join(root, 'packages/core/dist/index.mjs')
);

const tmp = mkdtempSync(path.join(tmpdir(), 'gitrelic-fixture-'));
const repoPath = path.join(tmp, 'sample-repo');
try {
  execFileSync(
    'bash',
    [
      path.join(root, 'packages/core/tests/fixtures/build-sample-repo.sh'),
      repoPath,
    ],
    { stdio: 'ignore' },
  );
  const report = await runGitrelic({ repoPath, version: '0.0.0-fixture' });
  // Machine-specific: the temp checkout path.
  report.repoPath = '/fixtures/sample-repo';

  const files = {
    'report.small.json': report,
    'commits.small.json': buildCommitIndex(report.commits),
  };
  for (const [name, data] of Object.entries(files)) {
    writeFileSync(path.join(outDir, name), `${JSON.stringify(data)}\n`);
  }
  execFileSync('pnpm', ['exec', 'oxfmt', outDir], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log(
    `Wrote ${Object.keys(files).join(', ')} to ${path.relative(root, outDir)}`,
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
