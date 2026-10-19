import { describe, expect, it } from 'vitest';

import commitsJson from '../../test/fixtures/commits.small.json';
import reportJson from '../../test/fixtures/report.small.json';
import { fromCommitIndex } from '../commits/commitLike';
import { churnRhythm, churnRhythmOf, topChurnFiles } from './rhythm';
import type { CommitLike } from '../commits/commitLike';
import type { CommitIndex, GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const commits = fromCommitIndex(commitsJson as unknown as CommitIndex);

const pair = (fileA: string, fileB: string) => ({
  fileA,
  fileB,
  coCommits: 6,
  totalCommitsA: 6,
  totalCommitsB: 6,
  couplingStrength: 100,
});

describe('topChurnFiles', () => {
  it('takes the source files with the most commits', () => {
    expect(topChurnFiles(report, 3).map((f) => f.file)).toEqual([
      'src/helpers.ts',
      'src/index.ts',
      'src/api.ts',
    ]);
  });
});

describe('churnRhythm', () => {
  it('counts each file’s commits per week over the whole window', () => {
    const rhythm = churnRhythm(report, commits);
    expect(new Date(rhythm.start).toISOString()).toBe(
      '2025-12-29T00:00:00.000Z',
    );
    expect(rhythm.weekCount).toBe(14);
    const [helpers] = rhythm.rows;
    expect(helpers.file.file).toBe('src/helpers.ts');
    expect(helpers.weeks.join('')).toBe('00000011202001');
    // Every row's weeks add up to its churn count.
    for (const row of rhythm.rows)
      expect(row.weeks.reduce((s, v) => s + v, 0)).toBe(row.file.commits);
  });

  it('counts the later half of the weeks as recent', () => {
    const [helpers, , , config] = churnRhythm(report, commits).rows;
    expect(helpers.recent).toBe(6);
    expect(config.file.file).toBe('src/config.ts');
    expect(config.recent).toBe(1);
  });

  it('caps the rows', () => {
    expect(churnRhythm(report, commits, 4).rows).toHaveLength(4);
  });

  it('numbers lockstep groups by their members among its rows', () => {
    const locked: GitrelicReport = {
      ...report,
      coupling: {
        ...report.coupling,
        pairs: [
          pair('src/api.ts', 'src/config.ts'),
          pair('src/config.ts', 'src/auth.ts'),
          // A group with one member shown can't be drawn as a tie.
          pair('src/helpers.ts', 'lib/x.ts'),
          pair('lib/x.ts', 'lib/y.ts'),
        ],
      },
    };
    const rhythm = churnRhythm(locked, commits);
    expect(rhythm.groups).toEqual([
      ['src/api.ts', 'src/config.ts', 'src/auth.ts'],
    ]);
    const groupOf = (file: string) =>
      rhythm.rows.find((r) => r.file.file === file)!.group;
    expect(groupOf('src/auth.ts')).toBe(0);
    expect(groupOf('src/helpers.ts')).toBeNull();
  });

  it('draws empty weeks without commits', () => {
    const rhythm = churnRhythm(report, []);
    expect(rhythm.weekCount).toBe(0);
    expect(rhythm.rows[0].weeks).toEqual([]);
    expect(rhythm.rows[0].recent).toBe(0);
  });

  it('computes once per report and commit list', () => {
    expect(churnRhythmOf(report, commits)).toBe(churnRhythmOf(report, commits));
    const other: CommitLike[] = [...commits];
    expect(churnRhythmOf(report, other)).not.toBe(
      churnRhythmOf(report, commits),
    );
  });
});
