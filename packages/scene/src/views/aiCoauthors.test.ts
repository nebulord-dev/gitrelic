import { describe, expect, it } from 'vitest';

import commitsJson from '../../test/fixtures/commits.small.json';
import reportJson from '../../test/fixtures/report.small.json';
import { fromCommitIndex } from '../commits/commitLike';
import { checkScene } from '../model';
import {
  adoptionLanesLayout,
  aiCoauthorsFindings,
  aiCoauthorsTable,
  aiCoauthorsView,
  aiTier,
  whereAiLayout,
} from './aiCoauthors';
import type {
  CoAuthorReport,
  CommitIndex,
  FixRateAiSplit,
  GitrelicReport,
} from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;
const commits = fromCommitIndex(commitsJson as unknown as CommitIndex);
const viewport = { width: 1200, height: 800 };

function report(
  co: Partial<CoAuthorReport>,
  ai: FixRateAiSplit = { changes: 0, fixedAfter: 0, versusOthers: null },
  fix = { changes: 0, fixedAfter: 0 },
): GitrelicReport {
  return {
    ...base,
    coAuthors: { ...base.coAuthors, ...co },
    fixRate: { ...base.fixRate, ...fix, ai, windowDays: 30 },
  };
}
const text = (segments: (string | { text: string })[]) =>
  segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');
const find = (r: GitrelicReport, id: string) =>
  aiCoauthorsFindings({ report: r, commits: null }).find((f) => f.id === id);

const adopted: Partial<CoAuthorReport> = {
  humanAuthoredCommits: 526,
  aiAssistedCommits: 18,
  aiAuthoredCommits: 0,
  byMonth: [
    {
      month: '2026-05',
      aiAssisted: 0,
      pureHuman: 20,
      total: 20,
      aiAuthored: 0,
    },
    {
      month: '2026-06',
      aiAssisted: 2,
      pureHuman: 40,
      total: 42,
      aiAuthored: 0,
    },
  ],
  aiTools: [
    { product: 'Claude', assisted: 16, authored: 0 },
    { product: 'Amp', assisted: 1, authored: 0 },
    { product: 'Cursor', assisted: 1, authored: 0 },
  ],
  aiAuthors: [
    {
      author: 'seb@x',
      displayName: 'Sebastian Silbermann',
      aiCommits: 11,
      totalCommits: 111,
      personalRatio: 10,
    },
  ],
  packages: [
    {
      package: 'packages/react-dom',
      commits: 86,
      aiAssisted: 7,
      aiAuthored: 0,
    },
    { package: 'compiler', commits: 87, aiAssisted: 1, aiAuthored: 0 },
    { package: 'fixtures', commits: 19, aiAssisted: 2, aiAuthored: 0 },
  ],
};

describe('aiCoauthorsFindings', () => {
  it('reads low adoption as a finding: how much, since when, with what', () => {
    expect(text(find(report(adopted), 'adoption')!.segments)).toBe(
      '3% of commits had AI in them (18 of 526), the first in Jun 2026: Claude 16, Amp 1, Cursor 1.',
    );
    const people = find(report(adopted), 'people')!;
    expect(text(people.segments)).toBe(
      'Most AI commits: Sebastian Silbermann 11 of 111.',
    );
    // A package needs AI_SHARE_MIN_COMMITS before its share is called out.
    expect(text(find(report(adopted), 'where')!.segments)).toBe(
      'react-dom has the most AI: 7 of 86 commits (8%).',
    );
  });

  it('says so when no commit had AI in it', () => {
    const r = report({
      humanAuthoredCommits: 40,
      aiAssistedCommits: 0,
      aiAuthoredCommits: 0,
    });
    expect(text(find(r, 'adoption')!.segments)).toMatch(
      /^No commit had AI in it/,
    );
    expect(find(r, 'where')).toBeUndefined();
  });

  it('names agents’ own commits apart', () => {
    const r = report({
      ...adopted,
      aiAuthoredCommits: 3,
      aiAgents: [
        {
          author: 'claude[bot]@x',
          displayName: 'claude[bot]',
          product: 'Claude',
          commits: 3,
        },
      ],
    });
    expect(text(find(r, 'agents')!.segments)).toBe(
      'AI agents authored 3 commits themselves (Claude 3), counted apart from AI-assisted ones.',
    );
  });

  it('compares fixes with the rest when there are enough, with the caveat when above', () => {
    const above = report(
      adopted,
      { changes: 1095, fixedAfter: 80, versusOthers: 'above' },
      { changes: 1790, fixedAfter: 113 },
    );
    const f = find(above, 'fixes')!;
    expect(f.tone).toBe('warning');
    expect(text(f.segments)).toContain(
      '80 of 1,095 changes (7.3%) against 33 of 695 (4.7%)',
    );
    expect(text(f.segments)).toContain('a reason to look, not a verdict');
    const few = report(adopted, {
      changes: 14,
      fixedAfter: 0,
      versusOthers: null,
    });
    expect(text(find(few, 'fixes')!.segments)).toMatch(/too few to compare/);
    expect(find(report(adopted), 'fixes')).toBeUndefined();
  });

  it('says most human pairs are credited once, from squash merges', () => {
    const pair = (n: number) => ({
      authorA: 'a',
      authorB: 'b',
      coAuthoredCommits: n,
      files: [],
      classification: 'human-pair' as const,
    });
    const r = report({ ...adopted, humanPairs: [pair(1), pair(1), pair(4)] });
    expect(text(find(r, 'pairs')!.segments)).toMatch(
      /2 of them once: mostly GitHub squash-merging/,
    );
  });
});

describe('aiCoauthorsTable', () => {
  it('lists every package, tiered by its AI share', () => {
    const table = aiCoauthorsTable({ report: report(adopted), commits: null });
    expect(table.rows.map((r) => [r.id, r.tier, r.cells.share])).toEqual([
      ['dir:compiler', 1, 1],
      ['dir:packages/react-dom', 1, 8],
      ['dir:fixtures', 1, 11],
    ]);
  });

  it('tiers no AI apart from a little', () => {
    expect([
      aiTier(0, 10),
      aiTier(1, 10),
      aiTier(2, 10),
      aiTier(5, 10),
    ]).toEqual([0, 1, 2, 3]);
  });
});

describe('aiCoauthorsView', () => {
  it('draws both forms soundly on the sample repo', () => {
    const input = { report: base, commits };
    expect(checkScene(whereAiLayout.build(input, viewport))).toEqual([]);
    expect(checkScene(adoptionLanesLayout.build(input, viewport))).toEqual([]);
  });

  it('redraws Where AI writes from a selected person’s commits', () => {
    const person = `person:${commits[0].author}`;
    const scene = whereAiLayout.build(
      { report: base, commits, focus: person },
      viewport,
    );
    expect(scene.marks.find((m) => m.id === 'ai-head')!.label).toMatch(
      /^.+: \d+ of \d+ commits? with AI/,
    );
  });

  it('shades the time strip by commits with AI in them', () => {
    expect(
      aiCoauthorsView.strip!.split({
        timeMs: 0,
        author: 'a',
        files: [],
        ai: 1,
      }),
    ).toBe(true);
    expect(
      aiCoauthorsView.strip!.split({ timeMs: 0, author: 'a', files: [] }),
    ).toBe(false);
  });
});
