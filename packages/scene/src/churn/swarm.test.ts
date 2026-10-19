import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import {
  churnCharacter,
  churnSwarm,
  churnSwarmOf,
  perFile,
  swarmFileTip,
  swarmRowTip,
} from './swarm';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('churnSwarm', () => {
  it('groups source files by package, biggest total first', () => {
    const rows = churnSwarm(report);
    expect(rows.map((r) => r.dir)).toEqual(['src', '', 'docs']);
    const [src] = rows;
    expect(src.total).toBe(25);
    expect(src.files.map((f) => f.commits)).toEqual([7, 5, 4, 4, 3, 2]);
    expect(src.quiet).toBe(1);
    expect(perFile(src)).toBeCloseTo(25 / 6);
  });

  it('leaves tests, fixtures and generated files out', () => {
    const files = churnSwarm(report).flatMap((r) => r.files.map((f) => f.file));
    expect(files).not.toContain('src/__tests__/api.test.ts');
    const generated: GitrelicReport = {
      ...report,
      fileClasses: { ...report.fileClasses, 'src/helpers.ts': 'generated' },
    };
    expect(
      churnSwarm(generated).flatMap((r) => r.files.map((f) => f.file)),
    ).not.toContain('src/helpers.ts');
  });

  it('carries line counts, character and churn tier', () => {
    const helpers = churnSwarm(report)[0].files[0];
    expect(helpers).toEqual({
      file: 'src/helpers.ts',
      commits: 7,
      insertions: 20,
      deletions: 7,
      character: 'tweaking',
      tier: 3,
    });
  });

  it('computes once per report', () => {
    expect(churnSwarmOf(report)).toBe(churnSwarmOf(report));
  });
});

describe('churnCharacter', () => {
  it.each([
    [100, 90, 80, 'rewriting'],
    [300, 100, 10, 'growing'],
    [100, 300, 10, 'shrinking'],
    [100, 60, 20, 'tweaking'],
    [0, 0, 0, null],
  ] as const)('+%i −%i at score %i reads %s', (ins, del, score, want) => {
    expect(churnCharacter(ins, del, score)).toBe(want);
  });
});

describe('tooltips', () => {
  it('names a file with its commits, lines and character', () => {
    const helpers = churnSwarm(report)[0].files[0];
    expect(swarmFileTip(helpers, 'helpers.ts')).toEqual([
      'helpers.ts',
      '7 commits',
      '+20 −7 lines',
      'tweaking',
    ]);
  });

  it('gives a row its total, file count and quiet files', () => {
    expect(swarmRowTip(churnSwarm(report)[1])).toEqual([
      '(root)',
      '2 changes across 2 files',
      '2 with one or two commits',
    ]);
  });
});
