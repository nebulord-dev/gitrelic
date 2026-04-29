import { describe, it, expect } from 'vitest';

import { analyzeForensics, CONFIDENCE_FLOOR } from './forensics.js';

import type { RawCommit } from '../utils/git.js';

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

describe('analyzeForensics', () => {
  it('returns empty report for commits with no shame keywords', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'feat: add new feature' }),
      makeCommit({ hash: '2', files: ['a.ts'], message: 'chore: update deps' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
    expect(result.totalShameCommits).toBe(0);
    expect(result.shameLeaderboard).toHaveLength(0);
  });

  it('detects critical shame keywords (weight 3)', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'revert: undo broken change' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].rawShamePoints).toBe(3);
    expect(result.files[0].dominantKeywords).toContain('revert');
    expect(result.files[0].shameCommitCount).toBe(1);
  });

  it('detects moderate shame keywords (weight 2)', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'add workaround for upstream issue' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].rawShamePoints).toBe(2);
  });

  it('detects mild shame keywords (weight 1)', () => {
    const commits = [makeCommit({ hash: '1', files: ['a.ts'], message: 'cleanup unused imports' })];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].rawShamePoints).toBe(1);
  });

  it('accumulates points from multiple keywords in one message', () => {
    // 'fix' (1) + 'typo' (1) = 2 points
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'fix typo in error message' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].rawShamePoints).toBe(2);
  });

  it('caps the final shame score at 100 even when raw ratio exceeds 100', () => {
    // 5 commits all with revert (3pts each) = 15 raw pts / 5 commits = 300% raw
    // confidence = 5/5 = 1 → 300 × 1 = 300 → capped at 100
    const commits = Array.from({ length: 5 }, (_, i) =>
      makeCommit({ hash: `h${i}`, files: ['a.ts'], message: 'revert: everything is on fire' }),
    );
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].shameScore).toBe(100);
  });

  it('scores files with more shame commits proportionally higher', () => {
    // a.ts: 5 reverts in 5 commits → raw 300 → cap 100. confidence 5/5 = 1 → 100
    const commitsFew = Array.from({ length: 5 }, (_, i) =>
      makeCommit({ hash: `a${i}`, files: ['a.ts'], message: 'revert: bad change' }),
    );
    // b.ts: 1 revert in 10 commits → raw 30. confidence 10/5 capped at 1 → 30
    const commitsMany: RawCommit[] = [
      makeCommit({ hash: 'r1', files: ['b.ts'], message: 'revert: bad change' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeCommit({ hash: `m${i}`, files: ['b.ts'], message: 'feat: good stuff' }),
      ),
    ];
    const result = analyzeForensics([...commitsFew, ...commitsMany], ['a.ts', 'b.ts']);
    const aScore = result.files.find((f) => f.file === 'a.ts')!.shameScore;
    const bScore = result.files.find((f) => f.file === 'b.ts')!.shameScore;
    expect(aScore).toBeGreaterThan(bScore);
  });

  it('limits shameLeaderboard to top 10 files', () => {
    const files = Array.from({ length: 15 }, (_, i) => `file${i}.ts`);
    // Each file gets 5 commits so it passes the confidence floor and qualifies
    // for the leaderboard; otherwise sub-floor files are filtered out.
    const commits = files.flatMap((file, i) =>
      Array.from({ length: 5 }, (_, j) =>
        makeCommit({ hash: `h${i}-${j}`, files: [file], message: 'revert: oops' }),
      ),
    );
    const result = analyzeForensics(commits, files);
    expect(result.shameLeaderboard.length).toBe(10);
  });

  it('limits topShameCommits to 3 per file', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'revert: first' }),
      makeCommit({ hash: '2', files: ['a.ts'], message: 'hotfix: second' }),
      makeCommit({ hash: '3', files: ['a.ts'], message: 'oops: third' }),
      makeCommit({ hash: '4', files: ['a.ts'], message: 'fix: fourth' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].topShameCommits.length).toBe(3);
  });

  it('sorts topShameCommits by shamePoints descending', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'fix: minor' }), // 1 pt
      makeCommit({ hash: '2', files: ['a.ts'], message: 'revert: everything' }), // 3 pts
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].topShameCommits[0].hash).toBe('2'); // revert first
  });

  it('ignores files not in the tracked set', () => {
    const commits = [makeCommit({ hash: '1', files: ['untracked.ts'], message: 'revert: bad' })];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('is case-insensitive for keyword matching', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'REVERT: Breaking Change' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].rawShamePoints).toBeGreaterThan(0);
  });

  it('uses whole-word matching (does not match partial words)', () => {
    // "fixing" should not match "fix" as a whole word
    const commits = [makeCommit({ hash: '1', files: ['a.ts'], message: 'fixing up the config' })];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('counts totalShameCommits across all files', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'revert: bad' }),
      makeCommit({ hash: '2', files: ['b.ts'], message: 'hotfix: urgent' }),
      makeCommit({ hash: '3', files: ['c.ts'], message: 'feat: normal' }),
    ];
    const result = analyzeForensics(commits, ['a.ts', 'b.ts', 'c.ts']);
    expect(result.totalShameCommits).toBe(2);
  });
});

describe('confidence multiplier', () => {
  it('dampens scores for files below the confidence floor', () => {
    const commits = [makeCommit({ message: 'fix it', files: ['a.ts'] })];
    const result = analyzeForensics(commits, ['a.ts']);
    // 1 commit, 1 mild keyword (1pt) → raw 100, confidence 1/5, dampened to 20
    expect(result.files[0].shameScore).toBe(20);
  });

  it('reaches full confidence at and beyond the floor', () => {
    const commits = Array.from({ length: 5 }, (_, i) =>
      makeCommit({ message: 'fix bug', files: ['a.ts'], hash: `h${i}` }),
    );
    const result = analyzeForensics(commits, ['a.ts']);
    // 5 commits × 2pts ("fix" 1 + "bug" 1) = 10 raw points / 5 commits = 200% raw → capped at 100, confidence 1
    expect(result.files[0].shameScore).toBe(100);
  });

  it('exposes the CONFIDENCE_FLOOR constant for downstream consumers', () => {
    // Use ESM import; see top of forensics.test.ts for the import line.
    expect(CONFIDENCE_FLOOR).toBe(5);
  });
});

describe('shameLeaderboard redefinition (floor-passing only)', () => {
  it('excludes sub-floor files from the leaderboard but keeps them in files[]', () => {
    const commits = [
      makeCommit({ message: 'revert broken thing', files: ['lone.yml'] }), // 1 commit, sub-floor
      ...Array.from({ length: 6 }, (_, i) =>
        makeCommit({ message: 'fix', files: ['solid.ts'], hash: `s${i}` }),
      ),
    ];
    const result = analyzeForensics(commits, ['lone.yml', 'solid.ts']);

    expect(result.files.map((f) => f.file)).toContain('lone.yml');
    expect(result.shameLeaderboard.map((f) => f.file)).not.toContain('lone.yml');
    expect(result.shameLeaderboard.map((f) => f.file)).toContain('solid.ts');
  });
});

describe('summary text', () => {
  it('reports the leaderboard top file when one passes the floor', () => {
    const commits = Array.from({ length: 6 }, (_, i) =>
      makeCommit({ message: 'revert', files: ['solid.ts'], hash: `r${i}` }),
    );
    const result = analyzeForensics(commits, ['solid.ts']);
    expect(result.summary).toMatch(/^solid\.ts has the highest shame score/);
  });

  it('acknowledges sub-floor shame signals when files exist but none pass the floor', () => {
    const commits = [
      makeCommit({ message: 'revert', files: ['a.yml'], hash: 'a1' }),
      makeCommit({ message: 'fix', files: ['b.yml'], hash: 'b1' }),
    ];
    const result = analyzeForensics(commits, ['a.yml', 'b.yml']);
    expect(result.shameLeaderboard).toHaveLength(0);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.summary).toMatch(
      /2 files with shame signals detected, but none have 5\+ commits/,
    );
  });

  it('reports no red flags when no shame signals exist at all', () => {
    const commits = [makeCommit({ message: 'add feature', files: ['a.ts'] })];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.summary).toBe('No commit message red flags detected.');
  });
});

describe('keywordTiers aggregate', () => {
  it('counts unique commits at the highest matched tier', () => {
    const commits = [
      makeCommit({ message: 'revert broken refactor', files: ['a.ts'], hash: 'c1' }), // critical
      makeCommit({ message: 'temporary hack to ship', files: ['a.ts'], hash: 'c2' }), // moderate
      makeCommit({ message: 'fix typo', files: ['a.ts'], hash: 'c3' }), // mild
      makeCommit({ message: 'revert and fix', files: ['a.ts'], hash: 'c4' }), // critical (top-tier wins)
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.keywordTiers).toEqual({ critical: 2, moderate: 1, mild: 1 });
  });

  it('returns all-zeros when no shame commits', () => {
    const commits = [makeCommit({ message: 'add feature', files: ['a.ts'] })];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.keywordTiers).toEqual({ critical: 0, moderate: 0, mild: 0 });
  });
});

describe('byMonth aggregate', () => {
  it('buckets shame commits by YYYY-MM with contiguous empty months', () => {
    const commits = [
      makeCommit({ hash: 'c1', message: 'revert', files: ['a.ts'], date: '2026-01-15T10:00:00Z' }),
      makeCommit({ hash: 'c2', message: 'fix', files: ['a.ts'], date: '2026-03-04T10:00:00Z' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.byMonth).toEqual([
      { month: '2026-01', critical: 1, moderate: 0, mild: 0 },
      { month: '2026-02', critical: 0, moderate: 0, mild: 0 },
      { month: '2026-03', critical: 0, moderate: 0, mild: 1 },
    ]);
  });

  it('returns empty array when no shame commits', () => {
    const commits = [makeCommit({ message: 'add feature', files: ['a.ts'] })];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.byMonth).toEqual([]);
  });

  it('handles December → January year rollover', () => {
    const commits = [
      makeCommit({ hash: 'c1', message: 'revert', files: ['a.ts'], date: '2025-12-15T10:00:00Z' }),
      makeCommit({ hash: 'c2', message: 'fix', files: ['a.ts'], date: '2026-02-04T10:00:00Z' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.byMonth).toEqual([
      { month: '2025-12', critical: 1, moderate: 0, mild: 0 },
      { month: '2026-01', critical: 0, moderate: 0, mild: 0 },
      { month: '2026-02', critical: 0, moderate: 0, mild: 1 },
    ]);
  });
});
