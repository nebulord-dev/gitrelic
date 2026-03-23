import { describe, it, expect } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import { analyzeBusFactor } from './bus-factor.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    message: '',
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
    const file = result.files.find(f => f.file === 'solo.ts')!;
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
      })
    );
    const result = analyzeBusFactor(commits, ['shared.ts']);
    const file = result.files.find(f => f.file === 'shared.ts')!;
    expect(file.risk).toBe('low');
  });

  it('detects high risk when one author dominates (>=75%)', () => {
    // Alice: 3 commits (75%), Bob: 1 commit (25%)
    const commits = [
      makeCommit({ hash: '1', files: ['dom.ts'] }),
      makeCommit({ hash: '2', files: ['dom.ts'] }),
      makeCommit({ hash: '3', files: ['dom.ts'] }),
      makeCommit({ hash: '4', authorEmail: 'bob@example.com', authorName: 'Bob', files: ['dom.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['dom.ts']);
    const file = result.files.find(f => f.file === 'dom.ts')!;
    expect(file.risk).toBe('high');
    expect(file.dominantAuthorPercent).toBe(75);
  });

  it('populates criticalFiles list correctly', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['critical.ts'] }),
      makeCommit({ hash: '2', files: ['safe.ts'], authorEmail: 'bob@example.com', authorName: 'Bob' }),
      makeCommit({ hash: '3', files: ['safe.ts'], authorEmail: 'carol@example.com', authorName: 'Carol' }),
      makeCommit({ hash: '4', files: ['safe.ts'], authorEmail: 'dave@example.com', authorName: 'Dave' }),
      makeCommit({ hash: '5', files: ['safe.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['critical.ts', 'safe.ts']);
    expect(result.criticalFiles.map(f => f.file)).toContain('critical.ts');
    expect(result.criticalFiles.map(f => f.file)).not.toContain('safe.ts');
  });

  it('ignores files not in tracked set', () => {
    const commits = [makeCommit({ hash: '1', files: ['tracked.ts', 'deleted.ts'] })];
    const result = analyzeBusFactor(commits, ['tracked.ts']);
    expect(result.files.map(f => f.file)).toEqual(['tracked.ts']);
  });

  it('produces summary mentioning critical file', () => {
    const commits = [makeCommit({ hash: '1', files: ['risky.ts'] })];
    const result = analyzeBusFactor(commits, ['risky.ts']);
    expect(result.summary).toContain('risky.ts');
  });

  it('produces healthy summary when no critical files', () => {
    const authors = ['alice', 'bob', 'carol', 'dave'];
    const commits = authors.map((name, i) =>
      makeCommit({
        hash: `h${i}`,
        authorEmail: `${name}@example.com`,
        authorName: name,
        files: ['safe.ts'],
      })
    );
    const result = analyzeBusFactor(commits, ['safe.ts']);
    expect(result.summary).toContain('healthy');
  });
});
