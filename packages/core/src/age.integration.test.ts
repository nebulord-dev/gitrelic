/**
 * Age against a real repository: a file untouched in the window still gets
 * its real last change, and Stale Files gets its date.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runGitrelic } from './runner.js';
import type { GitrelicReport } from './types.js';

let repo = '';
const days = (from: string, to: string) =>
  Math.floor(
    (Date.parse(`${to}T10:00:00Z`) - Date.parse(`${from}T10:00:00Z`)) /
      86_400_000,
  );

function commit(
  date: string,
  [name, email]: [string, string],
  files: Record<string, string>,
) {
  const at = `${date}T10:00:00+00:00`;
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email,
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

const BOB: [string, string] = ['Bob', 'bob@corp.com'];
const ANN: [string, string] = ['Ann', 'ann@corp.com'];
// One person, a new email by the window: only the older history links them.
const CY_THEN: [string, string] = ['Cy Doe', 'cy@old.com'];
const CY_NOW: [string, string] = ['Cy Doe', 'cy@new.com'];
let windowed: GitrelicReport;
let full: GitrelicReport;

beforeAll(async () => {
  repo = mkdtempSync(path.join(tmpdir(), 'gitrelic-age-'));
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], {
    cwd: repo,
  });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  commit(
    '2023-01-10',
    BOB,
    Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e'].map((n) => [`old/${n}.ts`, `${n}\n`]),
    ),
  );
  commit('2023-01-20', CY_THEN, { 'keep/x.ts': 'x\n' });
  commit('2023-02-01', BOB, { 'lib/woke.ts': 'v1\n' });
  commit('2026-01-05', ANN, { 'src/new.ts': 'v1\n' });
  commit('2026-02-01', ANN, { 'lib/woke.ts': 'v2\n' });
  commit('2026-02-15', CY_NOW, { 'src/other.ts': 'o\n' });
  commit('2026-03-01', ANN, { 'src/new.ts': 'v2\n' });
  windowed = await runGitrelic({ repoPath: repo, since: '2025-12-01' });
  full = await runGitrelic({ repoPath: repo });
}, 60_000);

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('Age over a windowed run', () => {
  it('ages files the window never touched', () => {
    const a = windowed.ageMap.files.find((f) => f.file === 'old/a.ts')!;
    expect(windowed.ageMap.source).toBe('history');
    expect(a.ageInDays).toBe(days('2023-01-10', '2026-03-01'));
    expect(a.orphaned).toBe(true);
    expect(a.orphanedAuthors).toEqual(['Bob']);
  });

  it('knows someone who changed email is still around', () => {
    const x = windowed.ageMap.files.find((f) => f.file === 'keep/x.ts')!;
    expect(x.ageInDays).toBe(days('2023-01-20', '2026-03-01'));
    expect(x.orphaned).toBeUndefined();
  });

  it('finds the woken file and the dormant package', () => {
    const woke = windowed.ageMap.files.find((f) => f.file === 'lib/woke.ts')!;
    expect(woke.wokeAfterDays).toBe(days('2023-02-01', '2026-02-01'));
    expect(windowed.ageMap.dormantPackages).toEqual([
      {
        package: 'old',
        sourceFiles: 5,
        newestAgeDays: days('2023-01-10', '2026-03-01'),
      },
    ]);
  });

  it('gives Stale Files real dates', () => {
    const stale = windowed.deadCode.candidates.find(
      (c) => c.file === 'old/a.ts',
    )!;
    expect(Date.parse(stale.lastCommitDate)).toBe(
      Date.parse('2023-01-10T10:00:00Z'),
    );
    expect(stale.ageInDays).toBe(days('2023-01-10', '2026-03-01'));
  });

  it('matches a run over all of history', () => {
    const pick = (r: GitrelicReport) =>
      r.ageMap.files.map((f) => [
        f.file,
        f.ageInDays,
        f.orphaned ?? false,
        f.wokeAfterDays ?? 0,
      ]);
    expect(pick(windowed)).toEqual(pick(full));
    expect(full.ageMap.source).toBe('history');
  });
});
