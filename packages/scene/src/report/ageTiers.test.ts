import { describe, expect, it } from 'vitest';

import { filesInTier } from './ageTiers';
import type { AgeMapReport, FileAge } from '@gitrelic/core';

const file = (name: string, status: FileAge['status']): FileAge => ({
  file: name,
  lastCommitDate: '2026-01-01T00:00:00Z',
  ageInDays: 0,
  status,
});

describe('filesInTier', () => {
  it('picks the files in one tier, in report order', () => {
    const ageMap = {
      files: [
        file('a.ts', 'ancient'),
        file('b.ts', 'stale'),
        file('c.ts', 'ancient'),
        file('d.ts', 'fresh'),
      ],
    } as AgeMapReport;
    expect(filesInTier(ageMap, 'ancient').map((f) => f.file)).toEqual([
      'a.ts',
      'c.ts',
    ]);
    expect(filesInTier(ageMap, 'stale').map((f) => f.file)).toEqual(['b.ts']);
    expect(filesInTier(ageMap, 'aging')).toEqual([]);
  });
});
