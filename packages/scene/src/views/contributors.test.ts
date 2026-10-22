import { describe, expect, it } from 'vitest';

import { ids } from '../ids';
import { checkScene } from '../model';
import {
  contributorsFindings,
  contributorsTable,
  contributorsView,
  flowLayout,
} from './contributors';
import type { CommitLike } from '../commits/commitLike';
import type { Contributor, GitrelicReport } from '@gitrelic/core';

const person = (
  email: string,
  commitCount: number,
  status: 'active' | 'quiet' | 'ghost' = 'active',
  filesOwned = 0,
): Contributor => ({
  email,
  name: email.split('@')[0],
  commitCount,
  firstCommit: '2025-10-01T09:00:00Z',
  lastCommit: '2026-03-01T09:00:00Z',
  filesOwned,
  linesChanged: 10 * commitCount,
  activeDays: 1,
  focusAreas: ['packages/ui'],
  isActive: status === 'active',
  isGhost: status === 'ghost',
});

function reportOf(contributors: Contributor[]): GitrelicReport {
  return {
    meta: { lastCommit: '2026-03-11T00:00:00Z' },
    contributors: {
      contributors,
      activeContributors: contributors.filter((c) => c.isActive),
      ghostContributors: contributors.filter((c) => c.isGhost),
      top3CommitShare: 75,
      newcomers90d: 1,
    },
  } as unknown as GitrelicReport;
}

const text = (segments: (string | { text: string })[]) =>
  segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');

const team = [
  person('ann@x', 9),
  person('bob@x', 5, 'ghost', 12),
  person('cy@x', 3, 'ghost'),
  person('di@x', 1, 'quiet'),
];

let t = 0;
const commit = (author: string, ...files: string[]): CommitLike => ({
  timeMs: ++t,
  author,
  files,
});

describe('contributorsFindings', () => {
  it('names the carriers who left, their commits and the files still theirs', () => {
    const [carriers] = contributorsFindings({
      report: reportOf(team),
      commits: null,
    });
    expect(carriers.tone).toBe('warning');
    expect(text(carriers.segments)).toBe(
      '2 of the top 4 are gone: bob and cy; 8 commits between them, and 12 files still theirs.',
    );
    expect(carriers.segments).toContainEqual({
      ref: ids.person('bob@x'),
      text: 'bob',
    });
  });

  it('says the team’s shape', () => {
    const findings = contributorsFindings({
      report: reportOf(team),
      commits: null,
    });
    expect(text(findings.at(-1)!.segments)).toBe(
      '1 of 4 contributors is active, and 1 joined in the 90 days before the last commit. The top 3 made 75% of the commits; 1 person made one.',
    );
  });

  it('names packages left behind once the history is in', () => {
    const report = reportOf(team);
    const commits = [
      commit('bob@x', 'packages/core/a.ts'),
      commit('cy@x', 'packages/core/a.ts'),
      commit('ann@x', 'packages/core/a.ts'),
      commit('ann@x', 'packages/ui/a.ts'),
    ];
    const ids_ = contributorsFindings({ report, commits }).map((f) => f.id);
    expect(ids_).toContain('left-behind:packages/core');
    expect(ids_).not.toContain('left-behind:packages/ui');
    const behind = contributorsFindings({ report, commits }).find(
      (f) => f.id === 'left-behind:packages/core',
    )!;
    expect(text(behind.segments)).toBe(
      'core: 67% of its 3 commits came from people no longer active.',
    );
  });

  it('has no departures to report when nobody left', () => {
    const findings = contributorsFindings({
      report: reportOf([person('ann@x', 3)]),
      commits: null,
    });
    expect(findings.map((f) => f.id)).toEqual(['team']);
  });
});

describe('contributorsTable', () => {
  it('lists everyone, tiered by status, gone owners on top', () => {
    const table = contributorsTable({ report: reportOf(team), commits: null });
    expect(table.rows.map((r) => [r.id, r.tier])).toEqual([
      [ids.person('ann@x'), 0],
      [ids.person('bob@x'), 3],
      [ids.person('cy@x'), 2],
      [ids.person('di@x'), 1],
    ]);
    expect(table.rows[1].cells).toMatchObject({
      status: 'gone',
      commits: 5,
      owned: 12,
      first: '2025-10-01',
      last: '2026-03-01',
    });
  });
});

describe('contributorsView', () => {
  it('draws the flow from the history', () => {
    expect(contributorsView.layouts[0]).toBe(flowLayout);
    expect(flowLayout.needsCommits).toBe(true);
    const scene = flowLayout.build(
      {
        report: reportOf(team),
        commits: [commit('ann@x', 'packages/ui/a.ts')],
      },
      { width: 1200, height: 800 },
    );
    expect(checkScene(scene)).toEqual([]);
  });
});
