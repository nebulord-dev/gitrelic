import { describe, it, expect } from 'vitest';

import { perAuthorAiMix } from './perAuthorAiMix';
import type { PerAuthorMixEntry } from '@gitrelic/core';

function makeEntry(overrides: Partial<PerAuthorMixEntry>): PerAuthorMixEntry {
  return {
    author: 'a@b.com',
    displayName: 'A',
    aiCommits: 0,
    soloCommits: 0,
    totalCommits: 0,
    personalRatio: 0,
    ...overrides,
  };
}

describe('perAuthorAiMix', () => {
  it('returns top-20 by totalCommits when no AI users', () => {
    const entries = Array.from({ length: 25 }, (_, i) =>
      makeEntry({
        author: `u${String(i).padStart(2, '0')}@x.com`,
        displayName: `U${i}`,
        totalCommits: 25 - i,
        soloCommits: 25 - i,
      }),
    );
    const result = perAuthorAiMix(entries);
    expect(result).toHaveLength(20);
  });

  it('includes all AI users even if outside top-20 by totalCommits', () => {
    const entries = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeEntry({
          author: `top${i}@x.com`,
          displayName: `Top${i}`,
          totalCommits: 100 - i,
          soloCommits: 100 - i,
        }),
      ),
      makeEntry({
        author: 'aiuser@x.com',
        displayName: 'AI User',
        totalCommits: 5,
        aiCommits: 3,
        soloCommits: 2,
        personalRatio: 60,
      }),
    ];
    const result = perAuthorAiMix(entries);
    const aiUser = result.find((e) => e.author === 'aiuser@x.com');
    expect(aiUser).toBeDefined();
    expect(aiUser!.personalRatio).toBe(60);
  });

  it('hard caps at 30 entries even with many AI users', () => {
    const entries = [
      ...Array.from({ length: 25 }, (_, i) =>
        makeEntry({
          author: `top${i}@x.com`,
          totalCommits: 100 - i,
        }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeEntry({
          author: `ai${i}@x.com`,
          totalCommits: 5,
          aiCommits: 3,
          personalRatio: 60,
        }),
      ),
    ];
    expect(perAuthorAiMix(entries)).toHaveLength(30);
  });

  it('returns empty array on empty input', () => {
    expect(perAuthorAiMix([])).toEqual([]);
  });

  it('preserves the personalRatio-desc sort order from the analyzer', () => {
    const entries = [
      makeEntry({ author: 'low@x.com', totalCommits: 10, personalRatio: 10 }),
      makeEntry({ author: 'high@x.com', totalCommits: 10, personalRatio: 90 }),
      makeEntry({ author: 'mid@x.com', totalCommits: 10, personalRatio: 50 }),
    ];
    const result = perAuthorAiMix(entries);
    expect(result.map((e) => e.author)).toEqual([
      'high@x.com',
      'mid@x.com',
      'low@x.com',
    ]);
  });
});
