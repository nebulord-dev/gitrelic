import { describe, it, expect } from 'vitest';

import { analyzeCoAuthors } from './co-author.js';
import type { CoAuthor, RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@co.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    message: '',
    coAuthors: [],
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

function ca(name: string, email: string): CoAuthor {
  return { name, email };
}

describe('analyzeCoAuthors', () => {
  describe('basic detection', () => {
    it('detects AI co-author trailer (Claude)', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          authorEmail: 'alice@co.com',
          coAuthors: [ca('Claude', 'noreply@anthropic.com')],
          files: ['a.ts'],
        }),
      ]);
      expect(result.aiAssistedCommits).toBe(1);
      expect(result.humanAuthoredCommits).toBe(1);
      expect(result.aiAdoptionPercent).toBe(100);
      expect(result.aiAdoptionTier).toBe('high');
    });

    it('detects human-only pair', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          authorEmail: 'alice@co.com',
          coAuthors: [ca('Bob', 'bob@co.com')],
          files: ['a.ts'],
        }),
      ]);
      expect(result.aiAssistedCommits).toBe(0);
      expect(result.humanAuthoredCommits).toBe(1);
      expect(result.aiAdoptionPercent).toBe(0);
      expect(result.aiAdoptionTier).toBe('none');
      expect(result.humanPairs).toHaveLength(1);
      expect(result.humanPairs[0].classification).toBe('human-pair');
    });
  });

  describe('bot filtering', () => {
    it('excludes bot-authored commits from human denominator', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          hash: '1',
          authorEmail: 'semantic-release-bot@martynus.net',
          coAuthors: [ca('Claude', 'noreply@anthropic.com')],
          files: ['a.ts'],
        }),
        makeCommit({
          hash: '2',
          authorEmail: 'alice@co.com',
          files: ['b.ts'],
        }),
      ]);
      expect(result.filteredBotCommits).toBe(1);
      expect(result.humanAuthoredCommits).toBe(1);
      expect(result.aiAssistedCommits).toBe(0);
    });

    it('does not include bot-involved pairs in pairs[] or humanPairs[]', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          authorEmail: 'alice@co.com',
          coAuthors: [
            ca('Bot', 'dependabot[bot]@users.noreply.github.com'),
            ca('Claude', 'noreply@anthropic.com'),
          ],
          files: ['a.ts'],
        }),
      ]);
      const allEmails = result.pairs.flatMap((p) => [p.authorA, p.authorB]);
      expect(allEmails).not.toContain(
        'dependabot[bot]@users.noreply.github.com',
      );
      expect(allEmails).toContain('noreply@anthropic.com');
    });
  });

  describe('AI as primary author edge case (Devin)', () => {
    it('excludes AI-authored-as-primary from human denominator', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          authorEmail: 'devin-ai-integration[bot]@users.noreply.github.com',
          coAuthors: [ca('Alice', 'alice@co.com')],
          files: ['a.ts'],
        }),
        makeCommit({
          authorEmail: 'alice@co.com',
          files: ['b.ts'],
        }),
      ]);
      expect(result.humanAuthoredCommits).toBe(1);
      expect(result.aiAssistedCommits).toBe(0);
    });
  });

  describe('aiAdoptionTier thresholds', () => {
    function commitsWith(aiCount: number, totalCount: number) {
      const commits: RawCommit[] = [];
      for (let i = 0; i < aiCount; i++) {
        commits.push(
          makeCommit({
            hash: `ai-${i}`,
            authorEmail: 'alice@co.com',
            coAuthors: [ca('Claude', 'noreply@anthropic.com')],
            files: ['a.ts'],
          }),
        );
      }
      for (let i = aiCount; i < totalCount; i++) {
        commits.push(
          makeCommit({
            hash: `solo-${i}`,
            authorEmail: 'alice@co.com',
            files: ['a.ts'],
          }),
        );
      }
      return commits;
    }

    it('0% → none', () => {
      const r = analyzeCoAuthors(commitsWith(0, 10));
      expect(r.aiAdoptionTier).toBe('none');
    });

    it('19% → low (boundary just below 20)', () => {
      const r = analyzeCoAuthors(commitsWith(19, 100));
      expect(r.aiAdoptionPercent).toBe(19);
      expect(r.aiAdoptionTier).toBe('low');
    });

    it('20% → moderate (boundary just at 20)', () => {
      const r = analyzeCoAuthors(commitsWith(20, 100));
      expect(r.aiAdoptionPercent).toBe(20);
      expect(r.aiAdoptionTier).toBe('moderate');
    });

    it('49% → moderate (boundary just below 50)', () => {
      const r = analyzeCoAuthors(commitsWith(49, 100));
      expect(r.aiAdoptionTier).toBe('moderate');
    });

    it('50% → high (boundary just at 50)', () => {
      const r = analyzeCoAuthors(commitsWith(50, 100));
      expect(r.aiAdoptionTier).toBe('high');
    });

    it('100% → high', () => {
      const r = analyzeCoAuthors(commitsWith(10, 10));
      expect(r.aiAdoptionTier).toBe('high');
    });
  });

  describe('byMonth aggregation', () => {
    it('buckets commits by ISO month', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          hash: '1',
          authorEmail: 'alice@co.com',
          date: '2026-01-15T00:00:00Z',
          coAuthors: [ca('Claude', 'noreply@anthropic.com')],
          files: ['a.ts'],
        }),
        makeCommit({
          hash: '2',
          authorEmail: 'alice@co.com',
          date: '2026-02-15T00:00:00Z',
          files: ['a.ts'],
        }),
      ]);
      expect(result.byMonth).toEqual([
        { month: '2026-01', aiAssisted: 1, pureHuman: 0, total: 1 },
        { month: '2026-02', aiAssisted: 0, pureHuman: 1, total: 1 },
      ]);
    });
  });

  describe('perAuthorMix shape', () => {
    it('reports each human author with AI/solo split', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          hash: '1',
          authorEmail: 'alice@co.com',
          authorName: 'Alice',
          coAuthors: [ca('Claude', 'noreply@anthropic.com')],
          files: ['a.ts'],
        }),
        makeCommit({
          hash: '2',
          authorEmail: 'alice@co.com',
          authorName: 'Alice',
          files: ['a.ts'],
        }),
      ]);
      const alice = result.perAuthorMix.find(
        (m) => m.author === 'alice@co.com',
      );
      expect(alice).toBeDefined();
      expect(alice!.aiCommits).toBe(1);
      expect(alice!.soloCommits).toBe(1);
      expect(alice!.totalCommits).toBe(2);
      expect(alice!.personalRatio).toBe(50);
    });
  });

  describe('aiAuthors filtering', () => {
    it('only includes humans with personalRatio > 0', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          hash: '1',
          authorEmail: 'alice@co.com',
          authorName: 'Alice',
          coAuthors: [ca('Claude', 'noreply@anthropic.com')],
          files: ['a.ts'],
        }),
        makeCommit({
          hash: '2',
          authorEmail: 'bob@co.com',
          authorName: 'Bob',
          files: ['a.ts'],
        }),
      ]);
      const emails = result.aiAuthors.map((a) => a.author);
      expect(emails).toContain('alice@co.com');
      expect(emails).not.toContain('bob@co.com');
    });

    it('sorts desc by aiCommits', () => {
      const result = analyzeCoAuthors([
        ...Array.from({ length: 3 }, (_, i) =>
          makeCommit({
            hash: `b-${i}`,
            authorEmail: 'bob@co.com',
            authorName: 'Bob',
            coAuthors: [ca('Claude', 'noreply@anthropic.com')],
            files: ['a.ts'],
          }),
        ),
        makeCommit({
          authorEmail: 'alice@co.com',
          authorName: 'Alice',
          coAuthors: [ca('Claude', 'noreply@anthropic.com')],
          files: ['a.ts'],
        }),
      ]);
      expect(result.aiAuthors[0].author).toBe('bob@co.com');
      expect(result.aiAuthors[0].aiCommits).toBe(3);
    });
  });

  describe('empty / scenario invariants', () => {
    it('Scenario 1: zero co-authors at all → defaults', () => {
      const result = analyzeCoAuthors([
        makeCommit({ authorEmail: 'alice@co.com', files: ['a.ts'] }),
      ]);
      expect(result.totalCoAuthoredCommits).toBe(0);
      expect(result.aiAdoptionPercent).toBe(0);
      expect(result.aiAdoptionTier).toBe('none');
      expect(result.aiAuthors).toEqual([]);
      expect(result.humanPairs).toEqual([]);
    });

    it('Scenario 2: trailers but no AI', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          authorEmail: 'alice@co.com',
          coAuthors: [ca('Bob', 'bob@co.com')],
          files: ['a.ts'],
        }),
      ]);
      expect(result.totalCoAuthoredCommits).toBe(1);
      expect(result.aiAssistedCommits).toBe(0);
      expect(result.aiAdoptionPercent).toBe(0);
      expect(result.aiAdoptionTier).toBe('none');
      expect(result.humanPairs).toHaveLength(1);
    });

    it('produces a summary string', () => {
      expect(analyzeCoAuthors([]).summary).toBeTruthy();
    });
  });

  describe('case-insensitive email matching', () => {
    it('treats Alice@co.com === alice@co.com when accumulating', () => {
      const result = analyzeCoAuthors([
        makeCommit({
          hash: '1',
          authorEmail: 'Alice@co.com',
          coAuthors: [ca('Claude', 'NOREPLY@anthropic.com')],
          files: ['a.ts'],
        }),
        makeCommit({
          hash: '2',
          authorEmail: 'alice@co.com',
          coAuthors: [ca('Claude', 'noreply@anthropic.com')],
          files: ['a.ts'],
        }),
      ]);
      const alice = result.perAuthorMix.find(
        (m) => m.author === 'alice@co.com',
      );
      expect(alice!.aiCommits).toBe(2);
    });
  });
});
