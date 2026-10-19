import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import {
  churnFindings,
  churnTable,
  hardestRow,
  lockstepGroups,
  PER_FILE_MIN_FILES,
} from './churn';
import type { SwarmRow } from '../churn/swarm';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

const row = (dir: string, files: number, perFile: number): SwarmRow => ({
  dir,
  total: files * perFile,
  quiet: 0,
  files: Array.from({ length: files }, (_, k) => ({
    file: `${dir}/f${k}.ts`,
    commits: perFile,
    insertions: 1,
    deletions: 1,
    character: 'tweaking' as const,
    tier: 1 as const,
  })),
});

/** A report whose churn is `files` (path → commits), all source. */
function withChurn(files: Record<string, number>): GitrelicReport {
  return {
    ...report,
    fileClasses: {},
    churn: {
      ...report.churn,
      files: Object.entries(files).map(([file, commitCount]) => ({
        file,
        commitCount,
        churnScore: 50,
        category: 'warm' as const,
      })),
    },
  };
}

const pair = (
  fileA: string,
  fileB: string,
  coCommits: number,
  couplingStrength: number,
) => ({
  fileA,
  fileB,
  coCommits,
  totalCommitsA: coCommits,
  totalCommitsB: coCommits,
  couplingStrength,
});

describe('hardestRow', () => {
  it('picks the most changes per file among packages big enough', () => {
    const wide = row('compiler', 400, 2);
    const tall = row('shared', 7, 12);
    const tiny = row('one', 1, 40);
    expect(hardestRow([wide, tall, tiny])).toBe(tall);
    expect(hardestRow([tiny])).toBeUndefined();
    expect(hardestRow([row('edge', PER_FILE_MIN_FILES, 1)])?.dir).toBe('edge');
  });
});

describe('churnFindings', () => {
  it('says one package leads when it leads both ways', () => {
    expect(churnFindings({ report, commits: null })).toEqual([
      {
        id: 'leaders',
        tone: 'notable',
        segments: [
          { ref: 'dir:src', text: 'src/' },
          ' leads on changes: 25 changes across 6 files, 4.2 each.',
        ],
      },
    ]);
  });

  it('sets the biggest total against the hardest per file', () => {
    const files: Record<string, number> = {};
    for (let k = 0; k < 40; k++) files[`compiler/f${k}.ts`] = 2;
    for (let k = 0; k < 5; k++) files[`packages/shared/flag${k}.js`] = 10;
    const [leaders] = churnFindings({
      report: withChurn(files),
      commits: null,
    });
    expect(leaders.segments).toEqual([
      { ref: 'dir:compiler', text: 'compiler/' },
      ' has the most changes (80 changes across 40 files, 2 each); ',
      { ref: 'dir:packages/shared', text: 'packages/shared/' },
      ' churns hardest per file (50 changes across 5 files, 10 each).',
    ]);
  });

  it('names a lockstep group', () => {
    const lock: GitrelicReport = {
      ...report,
      coupling: {
        ...report.coupling,
        pairs: [
          pair('src/a.ts', 'src/b.ts', 8, 100),
          pair('src/b.ts', 'src/c.ts', 8, 95),
          pair('src/c.ts', 'src/d.ts', 8, 90),
        ],
      },
    };
    const lockstep = churnFindings({ report: lock, commits: null }).find(
      (f) => f.id === 'lockstep',
    );
    expect(lockstep?.segments).toEqual([
      '4 files change commit for commit (',
      { ref: 'file:src/a.ts', text: 'a.ts' },
      ', ',
      { ref: 'file:src/b.ts', text: 'b.ts' },
      ' and 2 more',
      '): one change, made 4 times.',
    ]);
  });

  it('says nothing for an empty report', () => {
    expect(churnFindings({ report: withChurn({}), commits: null })).toEqual([]);
  });
});

describe('lockstepGroups', () => {
  const groupsOf = (pairs: ReturnType<typeof pair>[], r = report) =>
    lockstepGroups({ ...r, coupling: { ...r.coupling, pairs } });

  it('joins pairs into groups, biggest first', () => {
    expect(
      groupsOf([
        pair('x/1.ts', 'x/2.ts', 6, 100),
        pair('x/2.ts', 'x/3.ts', 6, 100),
        pair('y/1.ts', 'y/2.ts', 6, 100),
        pair('y/2.ts', 'y/3.ts', 6, 100),
        pair('y/3.ts', 'y/4.ts', 6, 100),
      ]),
    ).toEqual([
      ['y/1.ts', 'y/2.ts', 'y/3.ts', 'y/4.ts'],
      ['x/1.ts', 'x/2.ts', 'x/3.ts'],
    ]);
  });

  it('ignores weak, thin and test pairs, and groups under three files', () => {
    expect(groupsOf([pair('a.ts', 'b.ts', 9, 100)])).toEqual([]);
    expect(
      groupsOf([pair('a.ts', 'b.ts', 9, 80), pair('b.ts', 'c.ts', 9, 80)]),
    ).toEqual([]);
    expect(
      groupsOf([pair('a.ts', 'b.ts', 4, 100), pair('b.ts', 'c.ts', 4, 100)]),
    ).toEqual([]);
    expect(
      groupsOf([
        pair('a.ts', 'b.ts', 9, 100),
        pair('b.ts', 'src/__tests__/api.test.ts', 9, 100),
      ]),
    ).toEqual([]);
  });
});

describe('churnTable', () => {
  it('lists every source file with its lines and character', () => {
    const table = churnTable({ report, commits: null });
    expect(table.rows).toHaveLength(9);
    expect(table.rows[0]).toEqual({
      id: 'file:src/helpers.ts',
      tier: 3,
      search: 'src/helpers.ts',
      cells: {
        file: 'src/helpers.ts',
        commits: 7,
        added: 20,
        deleted: 7,
        character: 'tweaking',
        package: 'src',
      },
    });
    expect(
      table.rows.find((r) => r.id === 'file:README.md')!.cells.package,
    ).toBe('(root)');
    expect(table.tierNames).toEqual(['Frozen', 'Cold', 'Warm', 'Hot']);
  });
});
