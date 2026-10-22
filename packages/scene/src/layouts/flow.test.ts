import { describe, expect, it } from 'vitest';

import { contributorFlow, FLOW_PEOPLE } from '../contributors/flow';
import { ids, REPO_ID } from '../ids';
import { checkScene, type Link, type Mark } from '../model';
import {
  flowScene,
  OTHER_PACKAGES_ID,
  OTHER_PEOPLE_ID,
  packageName,
} from './flow';
import type { CommitLike } from '../commits/commitLike';
import type { Contributor, GitrelicReport } from '@gitrelic/core';

const VIEWPORT = { width: 1200, height: 800 };

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
  filesOwned: 3,
  linesChanged: 0,
  activeDays: 1,
  focusAreas: [],
  isActive: status === 'active',
  isGhost: status === 'ghost',
});

let t = 0;
const commit = (author: string, ...files: string[]): CommitLike => ({
  timeMs: ++t,
  author,
  files,
});

// Three people (one gone) and three packages, plus the root.
const report = {
  contributors: {
    contributors: [
      person('ann@x', 4),
      person('bob@x', 2, 'ghost'),
      person('cy@x', 1, 'quiet'),
    ],
  },
} as unknown as GitrelicReport;
const commits = [
  commit('ann@x', 'packages/ui/a.ts'),
  commit('ann@x', 'packages/ui/b.ts', 'packages/core/c.ts'),
  commit('ann@x', 'README.md'),
  commit('ann@x', 'packages/core/c.ts'),
  commit('bob@x', 'packages/core/c.ts'),
  commit('bob@x', 'packages/core/d.ts'),
  commit('cy@x', 'scripts/x.sh'),
];
const flow = contributorFlow(report, commits);

const markOf = (marks: Mark[], id: string) => marks.find((m) => m.id === id)!;
const linksAt = (links: Link[], id: string, end: 'source' | 'target') =>
  links.filter((l) => l[end] === id);

describe('flowScene', () => {
  const scene = flowScene(flow, VIEWPORT);

  it('is a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
  });

  it('draws people and packages as their entities, the root as repo', () => {
    const idsDrawn = scene.marks.map((m) => m.id);
    expect(idsDrawn).toContain(ids.person('ann@x'));
    expect(idsDrawn).toContain(ids.dir('packages/core'));
    expect(idsDrawn).toContain(REPO_ID);
    // Everyone fits: no others' nodes.
    expect(idsDrawn).not.toContain(OTHER_PEOPLE_ID);
    expect(idsDrawn).not.toContain(OTHER_PACKAGES_ID);
  });

  it('stacks each node’s bands edge to edge along it, filling it', () => {
    for (const m of scene.marks.filter((x) => x.shape === 'bar')) {
      for (const end of ['source', 'target'] as const) {
        const bands = linksAt(scene.links, m.id, end);
        if (bands.length === 0) continue;
        const k = end === 'source' ? 0 : 1;
        const spans = bands
          .map((b) => [b.ends![k] - b.width / 2, b.ends![k] + b.width / 2])
          .sort((a, b) => a[0] - b[0]);
        // From the node's top edge to its bottom, with no gaps or overlaps.
        expect(spans[0][0]).toBeCloseTo(-m.h / 2, 6);
        expect(spans.at(-1)![1]).toBeCloseTo(m.h / 2, 6);
        for (let i = 1; i < spans.length; i++)
          expect(spans[i][0]).toBeCloseTo(spans[i - 1][1], 6);
      }
    }
  });

  it('paints bands by their person’s status, gone louder than active', () => {
    const ann = linksAt(scene.links, ids.person('ann@x'), 'source')[0];
    const bob = linksAt(scene.links, ids.person('bob@x'), 'source')[0];
    expect(ann.paint).toBe('--soft');
    expect(bob.paint).toBe('--risk-2');
    expect(bob.alpha).toBeGreaterThan(ann.alpha);
    expect(bob.tip).toEqual(['bob → core', '2 commits']);
  });

  it('flags a package mostly built by people no longer active', () => {
    // core: 2 of ann's commits, 2 of bob's (gone): 50%.
    const core = markOf(scene.marks, ids.dir('packages/core'));
    expect(core.labelSub).toContain('50% by people no longer active');
    expect(core.labelClass).toBe('atlas-label--hot');
    const ui = markOf(scene.marks, ids.dir('packages/ui'));
    expect(ui.labelClass).toBeUndefined();
  });

  it('lights a selected person’s bands and dims what they never touched', () => {
    const focused = flowScene(flow, VIEWPORT, {
      focus: ids.person('bob@x'),
    });
    expect(checkScene(focused)).toEqual([]);
    // The same marks and links, so a click only re-tints.
    expect(focused.marks.map((m) => m.id)).toEqual(
      scene.marks.map((m) => m.id),
    );
    expect(focused.links.map((l) => l.id)).toEqual(
      scene.links.map((l) => l.id),
    );
    for (const l of focused.links) {
      if (l.source === ids.person('bob@x')) {
        expect(l.paint).toBe('--accent');
      } else {
        expect(l.alpha).toBeLessThan(0.1);
      }
    }
    // Dimmed, but over the label floor (0.5), so it keeps its name.
    const ui = markOf(focused.marks, ids.dir('packages/ui')).alpha;
    expect(ui).toBeLessThan(0.95);
    expect(ui).toBeGreaterThan(0.5);
    expect(markOf(focused.marks, ids.dir('packages/core')).labelSub).toBe(
      '2 commits by bob',
    );
  });

  it('lights a selected package’s bands and dims the people who never touched it', () => {
    const focused = flowScene(flow, VIEWPORT, { focus: REPO_ID });
    const lit = focused.links.filter((l) => l.paint === '--accent');
    expect(lit.map((l) => l.source)).toEqual([ids.person('ann@x')]);
    expect(markOf(focused.marks, ids.person('cy@x')).alpha).toBeLessThan(0.95);
  });

  it('lets the stage light a hovered node’s bands', () => {
    expect(scene.hoverLinks).toBe(true);
  });

  it('places each package level with the people who commit to it', () => {
    // A team of two people per package, listed against their commit rank:
    // p0/p1 → late, p2/p3 → early. By size, late leads; by people, early.
    const team = {
      contributors: {
        contributors: [
          person('p0@x', 9),
          person('p1@x', 8),
          person('p2@x', 2),
          person('p3@x', 1),
        ],
      },
    } as unknown as GitrelicReport;
    const history = [
      ...Array.from({ length: 4 }, () => commit('p0@x', 'late/a.ts')),
      ...Array.from({ length: 4 }, () => commit('p1@x', 'late/a.ts')),
      ...Array.from({ length: 2 }, () => commit('p2@x', 'early/a.ts')),
      commit('p3@x', 'early/a.ts'),
      // One stray commit from the bottom of the list pulls `late` a little.
      commit('p3@x', 'late/a.ts'),
    ];
    const s = flowScene(contributorFlow(team, history), VIEWPORT);
    const y = (id: string) => markOf(s.marks, id).y;
    expect(y(ids.dir('late'))).toBeLessThan(y(ids.dir('early')));
    // And an all-lower team sorts below an all-upper one even when bigger.
    const flipped = flowScene(
      contributorFlow(team, [
        ...Array.from({ length: 2 }, () => commit('p0@x', 'up/a.ts')),
        ...Array.from({ length: 9 }, () => commit('p3@x', 'down/a.ts')),
      ]),
      VIEWPORT,
    );
    expect(markOf(flipped.marks, ids.dir('up')).y).toBeLessThan(
      markOf(flipped.marks, ids.dir('down')).y,
    );
  });

  it('ignores a focus it doesn’t draw', () => {
    const focused = flowScene(flow, VIEWPORT, { focus: ids.file('README.md') });
    expect(focused.links.map((l) => [l.paint, l.alpha])).toEqual(
      scene.links.map((l) => [l.paint, l.alpha]),
    );
  });

  it('dates the last commit in a person’s tip from `now`', () => {
    const dated = flowScene(flow, VIEWPORT, {
      now: Date.parse('2026-03-11T00:00:00Z'),
    });
    expect(markOf(dated.marks, ids.person('ann@x')).tip).toEqual([
      'ann',
      '4 commits · active',
      'Last commit 10d ago',
      'Most in core (2), ui (2), (root) (1)',
      'Owns 3 files',
    ]);
  });

  it('folds the rest into the others’ nodes past the cut', () => {
    const many = {
      contributors: {
        contributors: Array.from({ length: FLOW_PEOPLE + 3 }, (_, i) =>
          person(`p${i}@x`, 100 - i, i % 2 ? 'active' : 'quiet'),
        ),
      },
    } as unknown as GitrelicReport;
    const history = many.contributors.contributors.flatMap((c, i) =>
      Array.from({ length: 1 + (i % 4) }, (_, k) =>
        commit(c.email, `pkg${(i + k) % 15}/f.ts`),
      ),
    );
    const big = flowScene(contributorFlow(many, history), VIEWPORT);
    expect(checkScene(big)).toEqual([]);
    // Thin nodes keep room for their two-line labels.
    const lefts = big.marks
      .filter((m) => m.shape === 'bar' && m.labelAnchor === 'left')
      .map((m) => m.y)
      .sort((x, y) => x - y);
    for (let i = 1; i < lefts.length; i++)
      expect(lefts[i] - lefts[i - 1]).toBeGreaterThanOrEqual(40);
    const others = markOf(big.marks, OTHER_PEOPLE_ID);
    expect(others.label).toBe('3 others');
    expect(markOf(big.marks, OTHER_PACKAGES_ID).label).toBe('4 other packages');
  });

  it('says so when there are no commits', () => {
    const empty = flowScene(contributorFlow(report, []), VIEWPORT);
    expect(checkScene(empty)).toEqual([]);
    expect(empty.marks[0].label).toBe('No commits in the window');
  });
});

describe('packageName', () => {
  it('drops packages/ and names the root', () => {
    expect(packageName('packages/react-dom')).toBe('react-dom');
    expect(packageName('compiler')).toBe('compiler');
    expect(packageName('')).toBe('(root)');
  });
});
