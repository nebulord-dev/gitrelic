import { describe, expect, it } from 'vitest';

import { contributorFlow } from '../contributors/flow';
import { contributorLanes, statusCutoffs } from '../contributors/lanes';
import { ids } from '../ids';
import { checkScene, type Mark } from '../model';
import { flowScene, OTHER_PEOPLE_ID } from './flow';
import { lanesScene } from './lanes';
import type { CommitLike } from '../commits/commitLike';
import type { Contributor, GitrelicReport } from '@gitrelic/core';

const VIEWPORT = { width: 1200, height: 800 };
const DAY = 86_400_000;

const person = (
  email: string,
  commitCount: number,
  status: 'active' | 'quiet' | 'ghost',
  lastCommit: string,
): Contributor => ({
  email,
  name: email.split('@')[0],
  commitCount,
  firstCommit: '2025-01-06T00:00:00Z',
  lastCommit,
  filesOwned: 0,
  linesChanged: 0,
  activeDays: 1,
  focusAreas: [],
  isActive: status === 'active',
  isGhost: status === 'ghost',
});

// A year of history ending 2026-01-05: ann active to the end, bob gone since
// March, and a 15th person beyond the Flow's 14 for the others' row.
const contributors = [
  person('ann@x', 3, 'active', '2026-01-05T00:00:00Z'),
  person('bob@x', 2, 'ghost', '2025-03-03T00:00:00Z'),
  ...Array.from({ length: 13 }, (_, i) =>
    person(`p${i}@x`, 1, 'quiet', '2025-09-01T00:00:00Z'),
  ),
];
const report = {
  meta: {
    firstCommit: '2025-01-06T00:00:00Z',
    lastCommit: '2026-01-05T00:00:00Z',
  },
  contributors: { contributors },
} as unknown as GitrelicReport;
const c = (author: string, iso: string, ...files: string[]): CommitLike => ({
  timeMs: Date.parse(iso),
  author,
  files,
});
const commits = [
  c('ann@x', '2025-01-06T09:00:00Z', 'packages/ui/a.ts'),
  c('ann@x', '2025-01-07T09:00:00Z', 'packages/ui/a.ts', 'packages/core/b.ts'),
  c('ann@x', '2026-01-05T09:00:00Z', 'packages/core/b.ts'),
  c('bob@x', '2025-03-03T09:00:00Z', 'packages/core/b.ts'),
  c('bob@x', '2025-03-04T09:00:00Z', 'packages/core/c.ts'),
  ...Array.from({ length: 12 }, (_, i) =>
    c(`p${i}@x`, '2025-09-01T09:00:00Z', 'docs/x.md'),
  ),
  c('p12@x', '2025-09-02T09:00:00Z', 'docs/y.md'),
];
const lanes = contributorLanes(report, commits);
const scene = lanesScene(lanes, VIEWPORT, {
  now: Date.parse('2026-01-05T00:00:00Z'),
});
const markOf = (id: string) => scene.marks.find((m) => m.id === id)!;
const bars = (id: string) =>
  scene.marks.filter((m) => m.id.startsWith(`lane:${id}:`));

describe('contributorLanes', () => {
  it('bins each drawn person’s commits, and the rest in one row', () => {
    expect(lanes.unit).toBe('week');
    const ann = lanes.rows[0];
    expect(ann.person?.email).toBe('ann@x');
    expect(ann.bins[0]).toBe(2);
    expect(ann.bins.at(-1)).toBe(1);
    expect(ann.bins.reduce((s, v) => s + v, 0)).toBe(3);
    // The week's busiest package for its tooltip; ties go by name.
    expect(ann.topPackage[0]).toBe('packages/ui');
    const others = lanes.rows.at(-1)!;
    expect(others.person).toBeNull();
    expect(others.bins.reduce((s, v) => s + v, 0)).toBe(1);
  });

  it('puts the cutoffs where core does: 90 and 180 days back on a year', () => {
    const { activeSince, goneBefore } = statusCutoffs(report);
    const end = Date.parse('2026-01-05T00:00:00Z');
    expect((end - activeSince) / DAY).toBe(91); // round(364 × 0.25)
    expect((end - goneBefore) / DAY).toBe(182); // round(364 × 0.5)
  });
});

describe('lanesScene', () => {
  it('is a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
  });

  it('keeps the Flow’s ids for people, so they travel between the forms', () => {
    const flow = flowScene(contributorFlow(report, commits), VIEWPORT);
    const people = (marks: Mark[]) =>
      marks
        .filter((m) => m.id.startsWith('person:') || m.id === OTHER_PEOPLE_ID)
        .map((m) => m.id)
        .sort();
    expect(people(scene.marks)).toEqual(people(flow.marks));
  });

  it('draws a bar per busy week, in the person’s status colour, selecting them', () => {
    const bob = bars(ids.person('bob@x'));
    expect(bob).toHaveLength(1);
    expect(bob[0]).toMatchObject({
      paint: '--risk-2',
      selects: ids.person('bob@x'),
      parent: ids.person('bob@x'),
    });
    expect(bob[0].tip).toEqual([
      'bob',
      'Week of Mar 3, 2025 · 2 commits',
      'mostly core',
    ]);
    // The others' row selects nobody.
    expect(bars(OTHER_PEOPLE_ID)[0].selects).toBeUndefined();
  });

  it('names the three zones a last commit can fall in, under the rows', () => {
    const zone = (status: string) => markOf(`lanes-zone:${status}`);
    // Gone, then quiet, then active, left to right, edge to edge.
    expect(zone('ghost').x).toBeLessThan(zone('quiet').x);
    expect(zone('quiet').x).toBeLessThan(zone('active').x);
    expect(zone('ghost').paint).toBe('--risk-2');
    expect(markOf('lanes-zone-label:ghost')).toMatchObject({
      label: 'gone',
      labelSub: 'last commit before Jul 7',
    });
    expect(markOf('lanes-zone-label:quiet').labelSub).toBe(
      'last commit between',
    );
    expect(markOf('lanes-zone-label:active').labelSub).toBe(
      'last commit after Oct 6',
    );
    expect(zone('ghost').tip).toEqual([
      'Gone if the last commit falls here',
      'No commit in the 182 days before the newest',
    ]);
    // Faint lines carry the zones' edges up through the rows.
    expect(scene.guides.map((g) => g.id)).toEqual(
      expect.arrayContaining(['lanes-gone', 'lanes-active']),
    );
  });

  it('ends a row that isn’t active at its last commit, with a mark there', () => {
    const end = markOf(`lane-end:${ids.person('bob@x')}`);
    // Right of bob's last week, left of the gone zone's edge.
    expect(end.x).toBeGreaterThanOrEqual(bars(ids.person('bob@x')).at(-1)!.x);
    expect(end.x).toBeLessThan(markOf('lanes-zone:quiet').x);
    expect(end).toMatchObject({
      selects: ids.person('bob@x'),
      paint: '--risk-2',
    });
    expect(end.tip).toEqual([
      'bob',
      'Last commit Mar 3, 2025',
      'Gone: no commit in the 182 days before the newest',
    ]);
    // Bob's row stops there; ann's (active) runs to the end, with no mark.
    const row = (id: string) => markOf(`lane-row:${id}`);
    const rightEdge = (m: Mark) => m.x + m.w / 2;
    expect(rightEdge(row(ids.person('bob@x')))).toBeLessThan(
      rightEdge(row(ids.person('ann@x'))),
    );
    expect(
      scene.marks.find((m) => m.id === `lane-end:${ids.person('ann@x')}`),
    ).toBeUndefined();
  });

  it('says each person’s status and last commit at the right', () => {
    expect(markOf(`lane-status:${ids.person('bob@x')}`)).toMatchObject({
      label: 'gone',
      labelSub: 'last commit 10mo ago',
      labelClass: 'atlas-label--hot',
    });
    expect(markOf(`lane-status:${ids.person('ann@x')}`).labelSub).toBe(
      'last commit today',
    );
  });

  it('lights a selected person’s row and fades the others', () => {
    const focused = lanesScene(lanes, VIEWPORT, { focus: ids.person('bob@x') });
    expect(checkScene(focused)).toEqual([]);
    const of = (id: string) =>
      focused.marks.filter((m) => m.id.startsWith(`lane:${id}:`));
    expect(of(ids.person('bob@x'))[0].paint).toBe('--accent');
    expect(of(ids.person('ann@x'))[0].alpha).toBeLessThan(0.5);
    expect(focused.marks.map((m) => m.id)).toEqual(
      scene.marks.map((m) => m.id),
    );
  });

  it('says so when there are no commits', () => {
    const empty = lanesScene(contributorLanes(report, []), VIEWPORT);
    expect(checkScene(empty)).toEqual([]);
    expect(empty.marks[0].label).toBe('No commits in the window');
  });
});
