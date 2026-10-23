/**
 * Non-ASCII paths against a real repository: `git log` quotes them by default
 * (`"caf\303\251.ts"`) while `git ls-tree -z` doesn't, so without
 * `core.quotePath=false` their history never matched a tracked file.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runGitrelic } from './runner.js';
import type { GitrelicReport } from './types.js';

const CAFE = 'src/café.ts';
const KANJI = 'docs/日本語.md';
let repo = '';
let report: GitrelicReport;

function commit(date: string, files: Record<string, string>) {
  const at = `${date}T10:00:00+00:00`;
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Ann',
    GIT_AUTHOR_EMAIL: 'ann@corp.com',
    GIT_COMMITTER_NAME: 'Ann',
    GIT_COMMITTER_EMAIL: 'ann@corp.com',
    GIT_AUTHOR_DATE: at,
    GIT_COMMITTER_DATE: at,
  };
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), text);
  }
  execFileSync('git', ['add', '-A'], { cwd: repo, env });
  execFileSync('git', ['commit', '--quiet', '-m', `change ${date}`], {
    cwd: repo,
    env,
  });
}

beforeAll(async () => {
  repo = mkdtempSync(path.join(tmpdir(), 'gitrelic-quotepath-'));
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], {
    cwd: repo,
  });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  commit('2023-01-10', { [CAFE]: 'v1\n', [KANJI]: 'v1\n' });
  commit('2026-02-01', { [CAFE]: 'v2\n', 'src/plain.ts': 'p\n' });
  commit('2026-03-01', { [CAFE]: 'v3\n' });
  report = await runGitrelic({ repoPath: repo, since: '2025-12-01' });
}, 60_000);

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('non-ASCII paths', () => {
  it('match their tracked files in the window', () => {
    expect(report.churn.files.find((f) => f.file === CAFE)?.commitCount).toBe(
      2,
    );
  });

  it('get their age from the history before the window', () => {
    const kanji = report.ageMap.files.find((f) => f.file === KANJI);
    expect(kanji?.ageInDays).toBeGreaterThan(365);
    expect(report.deadCode.candidates.map((c) => c.file)).toContain(KANJI);
  });

  it('never appear quoted', () => {
    const paths = [
      ...report.churn.files.map((f) => f.file),
      ...report.ageMap.files.map((f) => f.file),
    ];
    expect(paths.filter((p) => p.startsWith('"'))).toEqual([]);
  });
});
