import { describe, expect, it } from 'vitest';

import commitsJson from '../../test/fixtures/commits.small.json';
import reportJson from '../../test/fixtures/report.small.json';
import { fromCommitIndex, type CommitLike } from '../commits/commitLike';
import {
  contributorFlow,
  contributorFlowOf,
  FLOW_PACKAGES,
  FLOW_PEOPLE,
  notActiveShare,
  personStatus,
} from './flow';
import type { CommitIndex, Contributor, GitrelicReport } from '@gitrelic/core';

const person = (
  email: string,
  commitCount: number,
  status: 'active' | 'quiet' | 'ghost' = 'active',
): Contributor => ({
  email,
  name: email.split('@')[0],
  commitCount,
  firstCommit: '2026-01-01T00:00:00Z',
  lastCommit: '2026-03-01T00:00:00Z',
  filesOwned: 0,
  linesChanged: 0,
  activeDays: 1,
  focusAreas: [],
  isActive: status === 'active',
  isGhost: status === 'ghost',
});

const reportOf = (contributors: Contributor[]) =>
  ({ contributors: { contributors } }) as unknown as GitrelicReport;

let t = 0;
const commit = (author: string, ...files: string[]): CommitLike => ({
  timeMs: ++t,
  author,
  files,
});

describe('contributorFlow', () => {
  it('counts a commit once per package it touches', () => {
    const report = reportOf([person('a@x', 2), person('b@x', 1, 'ghost')]);
    const flow = contributorFlow(report, [
      // Two files in one package, one at the root: two packages, one each.
      commit('a@x', 'packages/core/a.ts', 'packages/core/b.ts', 'README.md'),
      commit('a@x', 'packages/core/a.ts'),
      commit('b@x', 'packages/core/a.ts'),
    ]);
    const core = flow.packages.find((p) => p.dir === 'packages/core')!;
    expect(core).toMatchObject({
      commits: 3,
      people: 2,
      byStatus: { active: 2, quiet: 0, ghost: 1 },
      top: { email: 'a@x', name: 'a', commits: 2 },
    });
    expect(flow.packages.find((p) => p.dir === '')?.commits).toBe(1);
    expect(flow.people[0].packages).toEqual([
      { dir: 'packages/core', commits: 2 },
      { dir: '', commits: 1 },
    ]);
    expect(notActiveShare(core)).toBeCloseTo(1 / 3);
  });

  it('folds the people and packages past the cut into the others’ nodes', () => {
    const contributors = Array.from({ length: FLOW_PEOPLE + 2 }, (_, i) =>
      person(`p${i}@x`, 100 - i),
    );
    const commits: CommitLike[] = [];
    contributors.forEach((c, i) => {
      // Package k gets more commits the lower k is, so the cut is stable.
      for (let k = 0; k <= i % (FLOW_PACKAGES + 2); k++)
        commits.push(commit(c.email, `pkg${k}/f.ts`));
    });
    const flow = contributorFlow(reportOf(contributors), commits);

    expect(flow.people).toHaveLength(FLOW_PEOPLE);
    expect(flow.packages).toHaveLength(FLOW_PACKAGES);
    expect(flow.otherPeople.count).toBe(2);
    expect(flow.otherPackages.count).toBe(2);
    // Both sides of the flow carry the same total.
    const total = flow.links.reduce((s, l) => s + l.commits, 0);
    const left =
      flow.people.reduce(
        (s, p) => s + p.packages.reduce((a, q) => a + q.commits, 0),
        0,
      ) + flow.otherPeople.commits;
    const right =
      flow.packages.reduce((s, p) => s + p.commits, 0) +
      flow.otherPackages.commits;
    expect(left).toBe(total);
    expect(right).toBe(total);
    // At most one link per pair of nodes.
    const keys = flow.links.map((l) => `${l.email}|${l.dir}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('runs on the sample repo', () => {
    const report = reportJson as unknown as GitrelicReport;
    const commits = fromCommitIndex(commitsJson as unknown as CommitIndex);
    const flow = contributorFlowOf(report, commits);
    expect(flow.people.length).toBe(
      Math.min(FLOW_PEOPLE, report.contributors.contributors.length),
    );
    expect(flow.links.length).toBeGreaterThan(0);
    // Memoised per report and commit list.
    expect(contributorFlowOf(report, commits)).toBe(flow);
  });
});

describe('personStatus', () => {
  it('reads active, then gone, else quiet', () => {
    expect(personStatus({ isActive: true, isGhost: false })).toBe('active');
    expect(personStatus({ isActive: false, isGhost: true })).toBe('ghost');
    expect(personStatus({ isActive: false, isGhost: false })).toBe('quiet');
  });
});
