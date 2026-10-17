/**
 * Pins that every part of the report describes the analyzed commit: the
 * branch passed via `branch`, not whatever is checked out, and never the
 * working copy's uncommitted state.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runGitrelic } from './runner.js';
import type { GitrelicReport } from './types.js';

let repo = '';
let onMain: GitrelicReport;
let onFeature: GitrelicReport;

function git(...args: string[]) {
  execFileSync('git', args, {
    cwd: repo,
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Ann Lee',
      GIT_AUTHOR_EMAIL: 'ann@corp.com',
      GIT_COMMITTER_NAME: 'Ann Lee',
      GIT_COMMITTER_EMAIL: 'ann@corp.com',
      GIT_AUTHOR_DATE: '2026-01-10T10:00:00+00:00',
      GIT_COMMITTER_DATE: '2026-01-10T10:00:00+00:00',
    },
  });
}
const write = (file: string, body: string) =>
  writeFileSync(path.join(repo, file), body);
const lines = (n: number) => 'x\n'.repeat(n);
const locOf = (r: GitrelicReport, file: string) =>
  r.loc.files.find((f) => f.file === file)?.lines;

beforeAll(async () => {
  repo = mkdtempSync(path.join(tmpdir(), 'gitrelic-branch-'));
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'commit.gpgsign', 'false');

  write('a.ts', lines(3));
  write('logo.bin', 'PNG\0\0\nbinary\n');
  git('add', '-A');
  git('commit', '--quiet', '-m', 'feat: base');

  git('switch', '--quiet', '-c', 'feature');
  write('a.ts', lines(10));
  write('feat.ts', lines(5));
  git('add', '-A');
  git('commit', '--quiet', '-m', 'feat: feature work');

  git('switch', '--quiet', 'main');
  // Uncommitted noise that must not leak into the report.
  write('a.ts', lines(50));
  write('scratch.ts', lines(7));

  onMain = await runGitrelic({ repoPath: repo, since: undefined });
  onFeature = await runGitrelic({ repoPath: repo, branch: 'feature' });
}, 30_000);

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

describe('analyzed snapshot (integration)', () => {
  it('reads files and LOC from the checked-out commit, not the working copy', () => {
    expect(onMain.loc.files.map((f) => f.file).sort()).toEqual([
      'a.ts',
      'logo.bin',
    ]);
    expect(locOf(onMain, 'a.ts')).toBe(3);
  });

  it('analyzes another branch without checking it out', () => {
    expect(onFeature.meta.totalCommits).toBe(2);
    expect(onFeature.meta.totalFiles).toBe(3);
    expect(locOf(onFeature, 'feat.ts')).toBe(5);
    expect(locOf(onFeature, 'a.ts')).toBe(10);
    expect(onFeature.churn.files.map((f) => f.file)).toContain('feat.ts');
  });

  it('counts binary files as zero lines', () => {
    expect(locOf(onMain, 'logo.bin')).toBe(0);
  });

  it('rejects an unknown branch with a readable error', async () => {
    await expect(
      runGitrelic({ repoPath: repo, branch: 'no-such-branch' }),
    ).rejects.toThrow('Unknown branch or revision: "no-such-branch"');
  });

  it('never lets a branch value act as a git option', async () => {
    const target = path.join(repo, 'pwned.txt');
    await expect(
      runGitrelic({ repoPath: repo, branch: `--output=${target}` }),
    ).rejects.toThrow(/Unknown branch or revision/);
    expect(existsSync(target)).toBe(false);
  });
});
