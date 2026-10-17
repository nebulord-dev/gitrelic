import { describe, expect, it } from 'vitest';

import { aggregateGhostFilesByDirectory } from './ghostFilesByDirectory';
import type { GhostFile } from '@gitrelic/core';

function makeFile(file: string): GhostFile {
  return {
    file,
    dominantAuthor: 'g@x.com',
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays: 200,
    loc: 1,
  };
}

describe('aggregateGhostFilesByDirectory', () => {
  it('returns [] for empty input', () => {
    expect(aggregateGhostFilesByDirectory([])).toEqual([]);
  });

  it('groups by parent directory', () => {
    const rows = aggregateGhostFilesByDirectory([
      makeFile('src/a.ts'),
      makeFile('src/b.ts'),
      makeFile('lib/c.ts'),
    ]);
    expect(rows).toEqual([
      { directory: 'src', count: 2, share: 2 / 3 },
      { directory: 'lib', count: 1, share: 1 / 3 },
    ]);
  });

  it('treats root-level files with empty directory string', () => {
    const rows = aggregateGhostFilesByDirectory([makeFile('README.md')]);
    expect(rows[0].directory).toBe('');
  });

  it('sorts ties by directory name alphabetical', () => {
    const rows = aggregateGhostFilesByDirectory([
      makeFile('z/a.ts'),
      makeFile('a/b.ts'),
    ]);
    expect(rows[0].directory).toBe('a');
    expect(rows[1].directory).toBe('z');
  });
});
