import { describe, expect, it } from 'vitest';

import { getDefaultMode } from './CommitGraph';
import { binCommitsForHeatmap } from './CommitHeatmap';
import type { RawCommit } from '@gitrelic/core';

describe('getDefaultMode', () => {
  it('returns dag for small repos', () => {
    expect(getDefaultMode(100)).toBe('dag');
  });

  it('returns dag at boundary', () => {
    expect(getDefaultMode(500)).toBe('dag');
  });

  it('returns heatmap for large repos', () => {
    expect(getDefaultMode(501)).toBe('heatmap');
  });
});

describe('binCommitsForHeatmap', () => {
  function makeCommit(overrides: Partial<RawCommit>): RawCommit {
    return {
      hash: 'abc',
      authorEmail: 'alice@dev.com',
      authorName: 'Alice',
      date: '2025-06-02T10:00:00Z',
      message: 'test',
      files: ['a.ts'],
      fileStats: [],
      insertions: 10,
      deletions: 5,
      ...overrides,
    };
  }

  it('creates a grid of week × author', () => {
    const commits = [
      makeCommit({
        date: '2025-06-02T10:00:00Z',
        authorEmail: 'alice@dev.com',
      }),
      makeCommit({
        date: '2025-06-02T12:00:00Z',
        authorEmail: 'alice@dev.com',
      }),
      makeCommit({ date: '2025-06-09T10:00:00Z', authorEmail: 'bob@dev.com' }),
    ];

    const { grid, authors, weeks } = binCommitsForHeatmap(commits);
    expect(authors).toContain('alice@dev.com');
    expect(authors).toContain('bob@dev.com');
    expect(weeks.length).toBeGreaterThanOrEqual(2);

    const aliceIdx = authors.indexOf('alice@dev.com');
    expect(grid[aliceIdx][0]).toBe(2);
  });
});
