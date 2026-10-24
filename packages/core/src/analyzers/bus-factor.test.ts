import { describe, it, expect } from 'vitest';

import { analyzeBusFactor } from './bus-factor.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
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

describe('analyzeBusFactor', () => {
  it('marks single-author files as critical risk', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['solo.ts'] }),
      makeCommit({ hash: '2', files: ['solo.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['solo.ts']);
    const file = result.files.find((f) => f.file === 'solo.ts')!;
    expect(file.risk).toBe('critical');
    expect(file.uniqueAuthors).toBe(1);
  });

  it('marks multi-author (4+) files as low risk', () => {
    const authors = ['alice', 'bob', 'carol', 'dave'];
    const commits = authors.map((name, i) =>
      makeCommit({
        hash: `h${i}`,
        authorEmail: `${name}@example.com`,
        authorName: name,
        files: ['shared.ts'],
      }),
    );
    const result = analyzeBusFactor(commits, ['shared.ts']);
    const file = result.files.find((f) => f.file === 'shared.ts')!;
    expect(file.risk).toBe('low');
  });

  it('detects high risk when one author dominates (>=75%)', () => {
    // Alice: 3 commits (75%), Bob: 1 commit (25%)
    const commits = [
      makeCommit({ hash: '1', files: ['dom.ts'] }),
      makeCommit({ hash: '2', files: ['dom.ts'] }),
      makeCommit({ hash: '3', files: ['dom.ts'] }),
      makeCommit({
        hash: '4',
        authorEmail: 'bob@example.com',
        authorName: 'Bob',
        files: ['dom.ts'],
      }),
    ];
    const result = analyzeBusFactor(commits, ['dom.ts']);
    const file = result.files.find((f) => f.file === 'dom.ts')!;
    expect(file.risk).toBe('high');
    expect(file.dominantAuthorPercent).toBe(75);
  });

  it('populates criticalFiles list correctly', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['critical.ts'] }),
      makeCommit({
        hash: '2',
        files: ['safe.ts'],
        authorEmail: 'bob@example.com',
        authorName: 'Bob',
      }),
      makeCommit({
        hash: '3',
        files: ['safe.ts'],
        authorEmail: 'carol@example.com',
        authorName: 'Carol',
      }),
      makeCommit({
        hash: '4',
        files: ['safe.ts'],
        authorEmail: 'dave@example.com',
        authorName: 'Dave',
      }),
      makeCommit({ hash: '5', files: ['safe.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['critical.ts', 'safe.ts']);
    expect(result.criticalFiles.map((f) => f.file)).toContain('critical.ts');
    expect(result.criticalFiles.map((f) => f.file)).not.toContain('safe.ts');
  });

  it('ignores files not in tracked set', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['tracked.ts', 'deleted.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['tracked.ts']);
    expect(result.files.map((f) => f.file)).toEqual(['tracked.ts']);
  });

  it('produces summary mentioning critical file', () => {
    const commits = [makeCommit({ hash: '1', files: ['risky.ts'] })];
    const result = analyzeBusFactor(commits, ['risky.ts']);
    expect(result.summary).toContain('risky.ts');
  });

  it('returns overallBusFactor 0 for empty commit list', () => {
    const result = analyzeBusFactor([], []);
    expect(result.overallBusFactor).toBe(0);
    expect(result.files).toHaveLength(0);
    expect(result.criticalFiles).toHaveLength(0);
    expect(result.summary).toContain('healthy');
  });

  it('returns overallBusFactor 0 when no tracked files match commits', () => {
    const commits = [makeCommit({ hash: '1', files: ['deleted.ts'] })];
    const result = analyzeBusFactor(commits, ['other.ts']);
    expect(result.overallBusFactor).toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it('produces healthy summary when no critical files', () => {
    const authors = ['alice', 'bob', 'carol', 'dave'];
    const commits = authors.map((name, i) =>
      makeCommit({
        hash: `h${i}`,
        authorEmail: `${name}@example.com`,
        authorName: name,
        files: ['safe.ts'],
      }),
    );
    const result = analyzeBusFactor(commits, ['safe.ts']);
    expect(result.summary).toContain('healthy');
  });

  describe('bots', () => {
    const bot = {
      authorEmail: 'semantic-release-bot@martynus.net',
      authorName: 'semantic-release-bot',
    };

    it('never owns a file a human also changed', () => {
      const commits = [
        makeCommit({ hash: 'h', files: ['package.json'] }),
        ...[1, 2, 3, 4, 5].map((i) =>
          makeCommit({ ...bot, hash: `b${i}`, files: ['package.json'] }),
        ),
      ];
      const file = analyzeBusFactor(commits, ['package.json']).files[0];
      expect(file.dominantAuthor).toBe('alice@example.com');
      expect(file.authors).toEqual(['alice@example.com']);
      expect(file.dominantAuthorPercent).toBe(100);
    });

    it('leaves a file only bots changed without an owner', () => {
      const commits = [
        makeCommit({ ...bot, hash: 'b1', files: ['CHANGELOG.md'] }),
        makeCommit({
          hash: 'b2',
          authorEmail: 'dependabot[bot]@users.noreply.github.com',
          files: ['CHANGELOG.md'],
        }),
      ];
      const result = analyzeBusFactor(commits, ['CHANGELOG.md']);
      expect(result.files).toHaveLength(0);
      expect(result.criticalFiles).toHaveLength(0);
    });

    it("still counts an AI agent's own commits", () => {
      // classifyAuthor checks AI first: claude[bot] is an agent, not a bot.
      const commits = [
        makeCommit({
          hash: 'a1',
          authorEmail: 'claude[bot]@users.noreply.github.com',
          files: ['agent.ts'],
        }),
      ];
      const file = analyzeBusFactor(commits, ['agent.ts']).files[0];
      expect(file.dominantAuthor).toBe('claude[bot]@users.noreply.github.com');
    });
  });
});
