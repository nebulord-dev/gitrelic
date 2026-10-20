/**
 * Fix rate against a real repository: blame must name the change whose lines
 * a fix rewrote, not every change before it.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { analyzeFixRate } from './analyzers/fix-rate.js';
import { runGitrelic } from './runner.js';
import { blameFixedLines, getAllCommits } from './utils/git.js';
import type { GitrelicReport } from './types.js';

const ANN = 'ann@corp.com';
const BOT = '49699333+dependabot[bot]@users.noreply.github.com';

let repo = '';
const hashes = new Map<string, string>();
let report: GitrelicReport;

function git(args: string[], date = '2026-01-01', email = ANN): string {
  const at = `${date}T10:00:00+00:00`;
  return execFileSync('git', args, {
    cwd: repo,
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Ann Lee',
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: 'Ann Lee',
      GIT_COMMITTER_EMAIL: email,
      GIT_AUTHOR_DATE: at,
      GIT_COMMITTER_DATE: at,
    },
  }).toString();
}

/** a.ts as ten lines, with the given ones rewritten. */
const body = (edits: Record<number, string>, extra = '') =>
  Array.from({ length: 10 }, (_, i) => edits[i + 1] ?? `line ${i + 1}`).join(
    '\n',
  ) +
  '\n' +
  extra;

const edits: Record<number, string> = {};
function commit(
  name: string,
  date: string,
  message: string,
  change: () => void,
  email = ANN,
) {
  change();
  git(['add', '-A'], date, email);
  git(['commit', '--quiet', '-m', message], date, email);
  hashes.set(name, git(['rev-parse', 'HEAD']).trim());
}
let tail = '';
const editLine = (line: number, text: string) => () => {
  edits[line] = text;
  writeFileSync(path.join(repo, 'a.ts'), body(edits, tail));
};

beforeAll(async () => {
  repo = mkdtempSync(path.join(tmpdir(), 'gitrelic-fixrate-'));
  git(['init', '--quiet', '--initial-branch=main']);
  git(['config', 'commit.gpgsign', 'false']);

  commit('base', '2026-01-01', 'feat: base', () => {
    writeFileSync(path.join(repo, 'a.ts'), body({}));
    writeFileSync(path.join(repo, 'old.ts'), 'one\ntwo\n');
  });
  // Seven more changes, each writing its own line.
  for (let d = 2; d <= 8; d++)
    commit(`c${d}`, `2026-01-0${d}`, `feat: line ${d}`, editLine(d, `v${d}`));
  // Rewrites the line c3 wrote: c3 is the one change it blames.
  commit('fix3', '2026-01-09', 'fix: line 3 was wrong', editLine(3, 'v3b'));
  // A bot's "fix" counts neither as a fix nor as a change.
  commit('bot', '2026-01-10', 'fix: bump', editLine(7, 'v7b'), BOT);
  // Adds a line and rewrites none: blames nothing.
  commit('guard', '2026-01-11', 'fix: add a guard', () => {
    tail = 'guard\n';
    editLine(1, 'line 1')();
  });
  commit('move', '2026-01-12', 'refactor: rename', () =>
    git(['mv', 'old.ts', 'new.ts']),
  );
  commit('fixNew', '2026-01-13', 'fix: two', () =>
    writeFileSync(path.join(repo, 'new.ts'), 'one\n2\n'),
  );
  // 55 days after c5: outside the window, so c5 stays clean.
  commit('late', '2026-03-01', 'fix: line 5', editLine(5, 'v5b'));

  report = await runGitrelic({ repoPath: repo });
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('blameFixedLines', () => {
  it('names the commit that wrote the rewritten line', async () => {
    expect(await blameFixedLines(repo, hashes.get('fix3')!, 'a.ts')).toEqual([
      { hash: hashes.get('c3'), file: 'a.ts' },
    ]);
  });

  it('blames nothing for a fix that only adds lines', async () => {
    expect(await blameFixedLines(repo, hashes.get('guard')!, 'a.ts')).toEqual(
      [],
    );
  });

  it('names the path the line had then, across a rename', async () => {
    expect(
      await blameFixedLines(repo, hashes.get('fixNew')!, 'new.ts'),
    ).toEqual([{ hash: hashes.get('base'), file: 'old.ts' }]);
  });

  it('returns nothing for a root commit, which has no parent to blame', async () => {
    expect(await blameFixedLines(repo, hashes.get('base')!, 'a.ts')).toEqual(
      [],
    );
  });
});

describe('fix rate on a real history', () => {
  it('rates a.ts from its human changes, one fixed in time', () => {
    const a = report.fixRate.files.find((f) => f.file === 'a.ts')!;
    // base, c2–c8, fix3 and guard; the bot's commit and the late fix (no
    // full window yet) aren't rated.
    expect(a.changes).toBe(10);
    expect(a.fixedAfter).toBe(1);
    expect(a.rate).toBeCloseTo(0.1);
    expect(a.fixes).toEqual([
      {
        hash: hashes.get('fix3'),
        message: 'fix: line 3 was wrong',
        date: '2026-01-09T10:00:00Z',
        revert: false,
        causes: [hashes.get('c3')],
      },
    ]);
  });

  it('leaves a file with too few changes unrated', () => {
    // new.ts: the rename and its fix, two changes.
    expect(report.fixRate.files.map((f) => f.file)).toEqual(['a.ts']);
    expect(report.fixRate.unratedFiles).toBe(1);
  });

  it('counts the traced fixes, bots left out', () => {
    expect(report.fixRate.fixCommits).toBe(4);
    expect(report.fixRate.reverts).toBe(0);
  });

  it('only blames tracked files it was asked to rate', async () => {
    const commits = await getAllCommits(repo);
    const none = await analyzeFixRate(repo, commits, new Set());
    expect(none.files).toEqual([]);
    expect(none.changes).toBe(0);
  });
});
