import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { checkScene } from '../model';
import {
  commitTimingFindings,
  commitTimingTable,
  commitTimingView,
  punchCardLayout,
  timingTier,
} from './commitTiming';
import type { GitrelicReport, PackageOffHours } from '@gitrelic/core';

const pkg = (
  name: string,
  commits: number,
  offHours: number,
  aboveChance = false,
): PackageOffHours => ({
  package: name,
  commits,
  offHours,
  percent: Math.round((offHours / commits) * 100),
  allowed: 5,
  aboveChance,
});

function report(packages: PackageOffHours[], rate = 0.1): GitrelicReport {
  const base = reportJson as unknown as GitrelicReport;
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  grid[1][16] = 8; // Mon 4pm
  grid[6][2] = 2; // Sat 2am
  return {
    ...base,
    commitTiming: {
      ...base.commitTiming,
      repoHourDayMatrix: grid,
      offHours: { commits: 200, offHours: 20, rate, minCommits: 10, packages },
    },
  } as GitrelicReport;
}
const text = (segments: (string | { text: string })[]) =>
  segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');

describe('commitTimingFindings', () => {
  it('names packages above chance, the team’s hours, and the most regular package', () => {
    const findings = commitTimingFindings({
      report: report([
        pkg('packages/server', 66, 15, true),
        pkg('packages/dom', 86, 16, true),
        pkg('compiler', 87, 2),
      ]),
      commits: null,
    });
    expect(findings.map((f) => f.id)).toEqual([
      'above-chance',
      'hours',
      'regular',
    ]);
    expect(text(findings[0].segments)).toBe(
      'server 15 of 66 (23%); dom 16 of 86 (19%) change off-hours more than chance explains at the repo’s 10%.',
    );
    expect(findings[0].segments).toContainEqual({
      ref: 'dir:packages/server',
      text: 'server',
    });
    expect(text(findings[1].segments)).toBe(
      '80% of commits land on weekdays between 9am and 7pm; the busiest hour is Mon 4pm.',
    );
    expect(text(findings[2].segments)).toBe(
      'compiler keeps the most regular hours: 2 of 87 commits off-hours (2%).',
    );
  });

  it('says so when no package is above chance', () => {
    const [first] = commitTimingFindings({
      report: report([pkg('src', 40, 4)]),
      commits: null,
    });
    expect(first.tone).toBe('neutral');
    expect(text(first.segments)).toBe(
      'No package changes off-hours more than chance explains; 10% of commits are off-hours repo-wide.',
    );
  });
});

describe('commitTimingTable', () => {
  it('lists tested packages, tiered against the rate and chance', () => {
    const table = commitTimingTable({
      report: report([
        pkg('packages/server', 40, 12, true),
        pkg('', 20, 3),
        pkg('src', 30, 1),
      ]),
      commits: null,
    });
    expect(table.rows.map((r) => [r.id, r.tier, r.cells.package])).toEqual([
      ['dir:packages/server', 3, 'packages/server'],
      ['repo', 1, '(root)'],
      ['dir:src', 0, 'src'],
    ]);
  });

  it('tiers: above chance at twice the rate is the top tier', () => {
    expect(timingTier(pkg('a', 40, 6, true), 0.1)).toBe(2);
    expect(timingTier(pkg('a', 40, 9, true), 0.1)).toBe(3);
  });
});

describe('commitTimingView', () => {
  it('draws the punch card, lit for a selected package once commits load', () => {
    expect(commitTimingView.layouts[0]).toBe(punchCardLayout);
    const r = report([]);
    const commits = [
      {
        timeMs: Date.parse('2025-06-07T02:00:00Z'),
        author: 'a@x',
        files: ['src/x.ts'],
        tz: 0,
      },
    ];
    const s = punchCardLayout.build(
      { report: r, commits, focus: 'dir:src' },
      { width: 1200, height: 800 },
    );
    expect(checkScene(s)).toEqual([]);
    expect(s.marks.find((m) => m.id === 'punch-head')!.label).toBe(
      'src: 1 commit, 100% off-hours',
    );
    // A person's own hours, named from the index.
    const ann = punchCardLayout.build(
      {
        report: r,
        commits,
        focus: 'person:a@x',
        index: {
          entries: [],
          get: (id: string) =>
            id === 'person:a@x'
              ? {
                  id,
                  kind: 'person' as const,
                  label: 'Ann',
                  detail: '',
                  keywords: [],
                }
              : undefined,
        },
      },
      { width: 1200, height: 800 },
    );
    expect(ann.marks.find((m) => m.id === 'punch-head')).toMatchObject({
      label: 'Ann: 1 commit, 100% off-hours',
      labelSub: 'their hours: every commit they made, in their local time',
    });
    // Kinds it doesn't draw: the repo.
    const plain = punchCardLayout.build(
      { report: r, commits, focus: 'analyzer:churn' },
      { width: 1200, height: 800 },
    );
    expect(plain.marks.find((m) => m.id === 'punch-head')!.label).toMatch(
      /each in its author’s local time/,
    );
  });
});
