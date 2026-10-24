/**
 * Workspace packages against a real repository: the pnpm workspace's
 * `apps/*` become separate packages for every analyzer that groups by one.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runGitrelic } from './runner.js';
import type { GitrelicReport } from './types.js';

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
  repo = mkdtempSync(path.join(tmpdir(), 'gitrelic-workspace-'));
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], {
    cwd: repo,
  });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  commit('2026-01-01', {
    'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n  - 'apps/*'\n",
    'package.json': '{"name":"root","private":true}',
    'apps/web/package.json': '{"name":"web"}',
    'apps/cli/package.json': '{"name":"cli"}',
    'packages/core/package.json': '{"name":"core"}',
  });
  // web and cli change together three times: a link between two packages
  // that the old rule folded into one "apps".
  for (const day of ['02', '03', '04'])
    commit(`2026-01-${day}`, {
      'apps/web/src/main.ts': `web ${day}\n`,
      'apps/cli/src/main.ts': `cli ${day}\n`,
    });
  report = await runGitrelic({ repoPath: repo });
}, 60_000);

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('workspace packages', () => {
  it('reads the roots the pnpm workspace declares', () => {
    expect(report.workspace).toEqual({
      sources: ['pnpm'],
      roots: ['apps/cli', 'apps/web', 'packages/core'],
    });
  });

  it('groups by them in coupling and commit timing', () => {
    expect(
      report.coupling.packages.map((p) => [p.packageA, p.packageB]),
    ).toEqual([['apps/cli', 'apps/web']]);
    const timed = report.commitTiming.offHours.packages.map((p) => p.package);
    expect(timed).not.toContain('apps');
  });
});
