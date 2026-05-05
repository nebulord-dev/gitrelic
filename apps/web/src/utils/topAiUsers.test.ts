import { describe, it, expect } from 'vitest';

import { topAiUsers } from './topAiUsers';
import type { AiAuthorStat, Contributor } from '@gitrelic/core';

function makeAi(overrides: Partial<AiAuthorStat>): AiAuthorStat {
  return {
    author: 'a@b.com',
    displayName: 'A',
    aiCommits: 1,
    totalCommits: 1,
    personalRatio: 100,
    ...overrides,
  };
}

function makeContributor(email: string, name: string): Contributor {
  return {
    email,
    name,
    commitCount: 0,
    firstCommit: '',
    lastCommit: '',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 0,
    focusAreas: [],
    isActive: true,
    isGhost: false,
  };
}

describe('topAiUsers', () => {
  it('returns top-N entries from aiAuthors (already sorted desc)', () => {
    const aiAuthors = [
      makeAi({ author: 'a@b.com', displayName: 'A', aiCommits: 10 }),
      makeAi({ author: 'b@b.com', displayName: 'B', aiCommits: 5 }),
      makeAi({ author: 'c@b.com', displayName: 'C', aiCommits: 2 }),
    ];
    const result = topAiUsers(aiAuthors, [], 2);
    expect(result).toHaveLength(2);
    expect(result[0].author).toBe('a@b.com');
    expect(result[1].author).toBe('b@b.com');
  });

  it('resolves display name from contributors map when name is missing', () => {
    const aiAuthors = [
      makeAi({
        author: 'alice@co.com',
        displayName: 'alice@co.com',
        aiCommits: 5,
      }),
    ];
    const contributors = [makeContributor('alice@co.com', 'Alice Smith')];
    const result = topAiUsers(aiAuthors, contributors, 5);
    expect(result[0].displayName).toBe('Alice Smith');
  });

  it('falls back to email when contributor has no name', () => {
    const aiAuthors = [
      makeAi({ author: 'bob@co.com', displayName: 'bob@co.com', aiCommits: 5 }),
    ];
    const contributors = [makeContributor('bob@co.com', '')];
    const result = topAiUsers(aiAuthors, contributors, 5);
    expect(result[0].displayName).toBe('bob@co.com');
  });

  it('returns empty array on empty input', () => {
    expect(topAiUsers([], [], 5)).toEqual([]);
  });

  it('handles N greater than input length', () => {
    const aiAuthors = [makeAi({ author: 'a@b.com', aiCommits: 10 })];
    expect(topAiUsers(aiAuthors, [], 10)).toHaveLength(1);
  });
});
