/**
 * Pins that fixture and generated files are classified in the report and
 * kept out of ownership analysis by default (bus factor, and everything
 * derived from it), while test files — real code with real owners — stay in.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runGitrelic } from './runner.js';
import type { GitrelicReport } from './types.js';

let repo = '';
let byDefault: GitrelicReport;
let withFixtures: GitrelicReport;

const FILES = {
  source: 'src/app.ts',
  test: 'src/__tests__/app.test.ts',
  fixture: 'src/__tests__/fixtures/case.expect.md',
  snapshot: 'src/__snapshots__/app.snap',
  generated: 'src/__generated__/schema.ts',
};

function commitAll(message: string) {
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '--quiet', '-m', message], {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Solo Dev',
      GIT_AUTHOR_EMAIL: 'solo@corp.com',
      GIT_COMMITTER_NAME: 'Solo Dev',
      GIT_COMMITTER_EMAIL: 'solo@corp.com',
      GIT_AUTHOR_DATE: '2026-01-10T10:00:00+00:00',
      GIT_COMMITTER_DATE: '2026-01-10T10:00:00+00:00',
    },
  });
}

beforeAll(async () => {
  repo = mkdtempSync(path.join(tmpdir(), 'gitrelic-fileclass-'));
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], {
    cwd: repo,
  });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  for (const file of Object.values(FILES)) {
    mkdirSync(path.join(repo, path.dirname(file)), { recursive: true });
    writeFileSync(path.join(repo, file), 'x\n');
  }
  commitAll('feat: init');

  byDefault = await runGitrelic({ repoPath: repo });
  withFixtures = await runGitrelic({ repoPath: repo, includeFixtures: true });
}, 30_000);

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

const owned = (r: GitrelicReport) =>
  r.busFactors.files.map((f) => f.file).sort();

describe('file classification (integration)', () => {
  it('records non-source files in report.fileClasses', () => {
    expect(byDefault.fileClasses).toEqual({
      [FILES.test]: 'test',
      [FILES.fixture]: 'fixture',
      [FILES.snapshot]: 'fixture',
      [FILES.generated]: 'generated',
    });
  });

  it('keeps fixtures and generated files out of bus factor by default', () => {
    expect(owned(byDefault)).toEqual([FILES.test, FILES.source].sort());
    expect(byDefault.busFactors.excluded).toEqual({ fixture: 2, generated: 1 });
  });

  it('flows the exclusion into analyzers built from bus factor', () => {
    expect(byDefault.knowledgeConcentration.totalFiles).toBe(2);
    expect(byDefault.contributors.contributors[0].filesOwned).toBe(2);
  });

  it('includes everything with includeFixtures', () => {
    expect(owned(withFixtures)).toEqual(Object.values(FILES).sort());
    expect(withFixtures.busFactors.excluded).toEqual({
      fixture: 0,
      generated: 0,
    });
  });

  it('leaves non-ownership analyzers untouched', () => {
    expect(byDefault.churn.files).toHaveLength(Object.keys(FILES).length);
  });
});
