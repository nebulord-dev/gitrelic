import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { fileMentions } from './fileMentions';
import type { GitrelicReport } from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;

describe('fileMentions', () => {
  it('lists the analyzers that flag a file, in rail order', () => {
    const report = {
      ...base,
      hotspots: {
        ...base.hotspots,
        files: [
          { file: 'a.ts', category: 'warning' },
          { file: 'b.ts', category: 'low' },
        ],
      },
      cursedFiles: { ...base.cursedFiles, files: [{ file: 'a.ts' }] },
      deadCode: { ...base.deadCode, candidates: [] },
      busFactors: { ...base.busFactors, criticalFiles: [{ file: 'a.ts' }] },
      coupling: {
        ...base.coupling,
        topPairs: [{ fileA: 'x.ts', fileB: 'a.ts' }],
      },
      ghostFiles: { ...base.ghostFiles, files: [] },
    } as unknown as GitrelicReport;
    expect(fileMentions('a.ts', report)).toEqual([
      'hotspots',
      'cursed-files',
      'bus-factor',
      'coupling',
    ]);
    expect(fileMentions('b.ts', report)).toEqual([]);
  });
});
