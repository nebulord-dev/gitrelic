# Commit Message Forensics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a shame score per file based on commit message sentiment, surfacing it as a new `ForensicsReport` in `LoreReport` and feeding it into cursed file scoring.

**Architecture:** Extend `RawCommit` with a `message` field (parsed from `git log`), create `analyzeForensics()` that scores files using weighted keyword tiers, wire the result into `findCursedFiles()` as an additional signal, and expose a `--shame` CLI flag for the dedicated leaderboard panel.

**Tech Stack:** TypeScript, Vitest (TDD), Ink (CLI panel), execa (git log)

---

## Task 1: Extend `RawCommit` with commit message

**Files:**
- Modify: `packages/core/src/utils/git.ts`
- Modify: `packages/core/src/utils/git.test.ts`

### Step 1: Write failing tests for the new `message` field

In `git.test.ts`, update the existing `parseGitLog` tests to include `MSG|` lines in the raw input and assert on `message`. Replace the existing raw strings in all `parseGitLog` tests:

```typescript
it('parses a single commit with numstat', () => {
  const raw = [
    'COMMIT|abc123|alice@example.com|Alice|2025-01-15T10:00:00Z',
    'MSG|fix: handle edge case',
    '10\t2\tsrc/index.ts',
    '5\t0\tsrc/utils.ts',
  ].join('\n');

  const commits = parseGitLog(raw);
  expect(commits).toHaveLength(1);
  expect(commits[0].hash).toBe('abc123');
  expect(commits[0].message).toBe('fix: handle edge case');
  expect(commits[0].files).toEqual(['src/index.ts', 'src/utils.ts']);
  expect(commits[0].insertions).toBe(15);
  expect(commits[0].deletions).toBe(2);
});

it('parses multiple commits', () => {
  const raw = [
    'COMMIT|aaa|alice@example.com|Alice|2025-01-15T10:00:00Z',
    'MSG|feat: new thing',
    '1\t0\tfile-a.ts',
    '',
    'COMMIT|bbb|bob@example.com|Bob|2025-01-16T10:00:00Z',
    'MSG|revert: undo bad change',
    '2\t1\tfile-b.ts',
  ].join('\n');

  const commits = parseGitLog(raw);
  expect(commits).toHaveLength(2);
  expect(commits[0].message).toBe('feat: new thing');
  expect(commits[1].message).toBe('revert: undo bad change');
});

it('returns empty array for empty input', () => {
  expect(parseGitLog('')).toEqual([]);
});

it('skips rename noise with curly braces', () => {
  const raw = [
    'COMMIT|abc|a@b.com|A|2025-01-15T10:00:00Z',
    'MSG|chore: rename files',
    '5\t3\tsrc/{old => new}/file.ts',
    '1\t0\tsrc/clean.ts',
  ].join('\n');

  const commits = parseGitLog(raw);
  expect(commits[0].files).toEqual(['src/clean.ts']);
  expect(commits[0].message).toBe('chore: rename files');
});

it('handles pipe characters in commit messages', () => {
  const raw = [
    'COMMIT|abc|a@b.com|A|2025-01-15T10:00:00Z',
    'MSG|fix: handle a|b edge case',
    '1\t0\tsrc/a.ts',
  ].join('\n');

  const commits = parseGitLog(raw);
  expect(commits[0].message).toBe('fix: handle a|b edge case');
});
```

### Step 2: Run tests to verify they fail

```bash
pnpm --filter @lore/core test -- --reporter=verbose utils/git
```

Expected: FAIL — `message` property does not exist on `RawCommit`.

### Step 3: Implement the changes in `git.ts`

**a) Add `message` to `RawCommit` interface:**
```typescript
export interface RawCommit {
  hash: string;
  authorEmail: string;
  authorName: string;
  date: string;
  message: string;    // ← add this line
  files: string[];
  insertions: number;
  deletions: number;
}
```

**b) Update the `git log` format string in `getAllCommits` to emit a `MSG|` line:**
```typescript
const args = [
  'log',
  '--format=COMMIT|%H|%ae|%an|%aI%nMSG|%s',
  '--numstat',
  '--no-merges',
];
```

**c) Update `parseGitLog` to handle `MSG|` lines:**
```typescript
export function parseGitLog(raw: string): RawCommit[] {
  const commits: RawCommit[] = [];
  let current: RawCommit | null = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT|')) {
      if (current) commits.push(current);
      const [, hash, authorEmail, authorName, date] = line.split('|');
      current = { hash, authorEmail, authorName, date, message: '', files: [], insertions: 0, deletions: 0 };
    } else if (current && line.startsWith('MSG|')) {
      current.message = line.slice(4);   // everything after "MSG|"
    } else if (current && line.trim()) {
      const parts = line.split('\t');
      if (parts.length === 3) {
        const [ins, del, file] = parts;
        if (file && !file.includes('{')) {
          current.files.push(file);
          current.insertions += parseInt(ins, 10) || 0;
          current.deletions += parseInt(del, 10) || 0;
        }
      }
    }
  }

  if (current) commits.push(current);
  return commits;
}
```

### Step 4: Add `message: ''` default to `makeCommit` helpers in all existing test files

Each test file has a local `makeCommit` factory. Add `message: '',` to the base object so TypeScript is satisfied and existing tests continue to pass without changes.

Files to update (same change in each):
- `packages/core/src/analyzers/churn.test.ts`
- `packages/core/src/analyzers/bus-factor.test.ts`
- `packages/core/src/analyzers/age-map.test.ts`
- `packages/core/src/analyzers/contributors.test.ts`
- `packages/core/src/analyzers/cursed-files.test.ts`

In each file, find the `makeCommit` factory and add `message: '',`:
```typescript
function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    message: '',    // ← add this line
    files: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}
```

### Step 5: Run all tests to verify everything passes

```bash
pnpm --filter @lore/core test
```

Expected: All tests pass.

### Step 6: Commit

```bash
git add packages/core/src/utils/git.ts packages/core/src/utils/git.test.ts \
  packages/core/src/analyzers/churn.test.ts \
  packages/core/src/analyzers/bus-factor.test.ts \
  packages/core/src/analyzers/age-map.test.ts \
  packages/core/src/analyzers/contributors.test.ts \
  packages/core/src/analyzers/cursed-files.test.ts
git commit -m "feat: add message field to RawCommit, extend git log format"
```

---

## Task 2: Add forensics types

**Files:**
- Modify: `packages/core/src/types.ts`

No tests needed for this task — types are validated by TypeScript compilation.

### Step 1: Add the three new interfaces to `types.ts`

Append after the `// ─── Cursed files` section, before `// ─── Runner options`:

```typescript
// ─── Forensics (commit message shame scoring) ──────────────────────────────

export interface ShamefulCommit {
  hash: string;
  message: string;
  date: string;
  shamePoints: number;   // weighted score from this commit's keywords
  keywords: string[];    // which keywords fired
}

export interface FileForensics {
  file: string;
  shameScore: number;          // 0–100 normalized ratio
  rawShamePoints: number;      // absolute weighted sum across all commits
  shameCommitCount: number;    // how many commits had shame keywords
  topShameCommits: ShamefulCommit[];   // top 3 by shamePoints
  dominantKeywords: string[];          // most frequent shame keywords for this file
}

export interface ForensicsReport {
  files: FileForensics[];
  shameLeaderboard: FileForensics[];  // top 10 most shameful files
  totalShameCommits: number;
  summary: string;
}
```

### Step 2: Add `forensics` field to `LoreReport`

```typescript
export interface LoreReport {
  timestamp: string;
  repoPath: string;
  repoName: string;
  meta: RepoMeta;
  churn: ChurnReport;
  busFactors: BusFactorReport;
  ageMap: AgeMapReport;
  contributors: ContributorReport;
  cursedFiles: CursedFile[];
  forensics: ForensicsReport;   // ← add this line
}
```

### Step 3: Verify TypeScript compiles

```bash
pnpm --filter @lore/core build
```

Expected: Build succeeds (there will be errors in `runner.ts` about missing `forensics` in the return — that's expected and will be fixed in Task 5).

### Step 4: Commit

```bash
git add packages/core/src/types.ts
git commit -m "feat: add ForensicsReport types to LoreReport"
```

---

## Task 3: Create the forensics analyzer (TDD)

**Files:**
- Create: `packages/core/src/analyzers/forensics.ts`
- Create: `packages/core/src/analyzers/forensics.test.ts`

### Step 1: Write the test file first

Create `packages/core/src/analyzers/forensics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import { analyzeForensics } from './forensics.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    message: '',
    files: [],
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
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'cleanup unused imports' }),
    ];
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

  it('normalizes shame score as (rawShamePoints / totalCommits) * 100, capped at 100', () => {
    // 1 revert (3 pts) out of 1 commit → (3/1)*100 = 300, capped to 100
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'revert: everything is on fire' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].shameScore).toBe(100);
  });

  it('scores files with more shame commits proportionally higher', () => {
    // a.ts: 1 revert in 2 commits → 3/2 * 100 = 150 → capped 100
    const commitsFew = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'revert: bad change' }),
      makeCommit({ hash: '2', files: ['a.ts'], message: 'feat: something good' }),
    ];
    // b.ts: 1 revert in 10 commits → 3/10 * 100 = 30
    const commitsMany: RawCommit[] = [
      makeCommit({ hash: 'r1', files: ['b.ts'], message: 'revert: bad change' }),
      ...Array.from({ length: 9 }, (_, i) =>
        makeCommit({ hash: `m${i}`, files: ['b.ts'], message: 'feat: good stuff' })
      ),
    ];
    const result = analyzeForensics([...commitsFew, ...commitsMany], ['a.ts', 'b.ts']);
    const aScore = result.files.find(f => f.file === 'a.ts')!.shameScore;
    const bScore = result.files.find(f => f.file === 'b.ts')!.shameScore;
    expect(aScore).toBeGreaterThan(bScore);
  });

  it('limits shameLeaderboard to top 10 files', () => {
    const files = Array.from({ length: 15 }, (_, i) => `file${i}.ts`);
    const commits = files.map((file, i) =>
      makeCommit({ hash: `h${i}`, files: [file], message: 'revert: oops' })
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
      makeCommit({ hash: '1', files: ['a.ts'], message: 'fix: minor' }),         // 1 pt
      makeCommit({ hash: '2', files: ['a.ts'], message: 'revert: everything' }), // 3 pts
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.files[0].topShameCommits[0].hash).toBe('2'); // revert first
  });

  it('ignores files not in the tracked set', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['untracked.ts'], message: 'revert: bad' }),
    ];
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
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], message: 'fixing up the config' }),
    ];
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
```

### Step 2: Run tests to verify they fail

```bash
pnpm --filter @lore/core test -- --reporter=verbose analyzers/forensics
```

Expected: FAIL — `Cannot find module './forensics.js'`

### Step 3: Implement `forensics.ts`

Create `packages/core/src/analyzers/forensics.ts`:

```typescript
/**
 * Commit message forensics — shame scoring per file.
 *
 * ## How shame scoring works
 *
 * Each commit message is scanned for keywords in three tiers:
 *
 * | Weight | Keywords                                                    |
 * |--------|-------------------------------------------------------------|
 * | 3 — Critical | revert, hotfix, oops, fixup, broke, breaking        |
 * | 2 — Moderate | hack, workaround, temporary, temp, kludge, band-aid |
 * | 1 — Mild     | fix, bug, wrong, mistake, typo, cleanup             |
 *
 * Matching is case-insensitive and whole-word only ("fixing" ≠ "fix").
 *
 * ## Shame score formula
 *
 *   shameScore = min((rawShamePoints / totalCommitsForFile) * 100, 100)
 *
 * Ratio-based: a file with 1 revert in 2 commits scores higher than
 * 1 revert in 100 commits, because the percentage of "bad" commits is higher.
 */

import type { RawCommit } from '../utils/git.js';
import type { FileForensics, ForensicsReport, ShamefulCommit } from '../types.js';

const SHAME_KEYWORDS: Array<{ weight: number; words: string[] }> = [
  { weight: 3, words: ['revert', 'hotfix', 'oops', 'fixup', 'broke', 'breaking'] },
  { weight: 2, words: ['hack', 'workaround', 'temporary', 'temp', 'kludge', 'band-aid'] },
  { weight: 1, words: ['fix', 'bug', 'wrong', 'mistake', 'typo', 'cleanup'] },
];

function scoreMessage(message: string): { points: number; keywords: string[] } {
  const lower = message.toLowerCase();
  let points = 0;
  const keywords: string[] = [];

  for (const { weight, words } of SHAME_KEYWORDS) {
    for (const word of words) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) {
        points += weight;
        keywords.push(word);
      }
    }
  }

  return { points, keywords };
}

export function analyzeForensics(
  commits: RawCommit[],
  trackedFiles: string[]
): ForensicsReport {
  const trackedSet = new Set(trackedFiles);

  // Map file → all commits that touched it
  const fileCommits = new Map<string, RawCommit[]>(
    trackedFiles.map(f => [f, []])
  );

  for (const commit of commits) {
    for (const file of commit.files) {
      if (trackedSet.has(file)) {
        fileCommits.get(file)!.push(commit);
      }
    }
  }

  const files: FileForensics[] = [];
  let totalShameCommits = 0;

  for (const [file, fileCommitList] of fileCommits) {
    if (fileCommitList.length === 0) continue;

    let rawShamePoints = 0;
    let shameCommitCount = 0;
    const shamefulCommits: ShamefulCommit[] = [];
    const keywordFreq = new Map<string, number>();

    for (const commit of fileCommitList) {
      const { points, keywords } = scoreMessage(commit.message);
      if (points === 0) continue;

      shameCommitCount++;
      rawShamePoints += points;
      shamefulCommits.push({
        hash: commit.hash,
        message: commit.message,
        date: commit.date,
        shamePoints: points,
        keywords,
      });

      for (const kw of keywords) {
        keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
      }
    }

    if (rawShamePoints === 0) continue;

    const shameScore = Math.min(
      Math.round((rawShamePoints / fileCommitList.length) * 100),
      100
    );

    const topShameCommits = shamefulCommits
      .sort((a, b) => b.shamePoints - a.shamePoints)
      .slice(0, 3);

    const dominantKeywords = [...keywordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kw]) => kw);

    totalShameCommits += shameCommitCount;

    files.push({
      file,
      shameScore,
      rawShamePoints,
      shameCommitCount,
      topShameCommits,
      dominantKeywords,
    });
  }

  files.sort((a, b) => b.shameScore - a.shameScore);
  const shameLeaderboard = files.slice(0, 10);

  const summary = shameLeaderboard.length === 0
    ? 'No commit message red flags detected.'
    : `${shameLeaderboard[0].file} has the highest shame score (${shameLeaderboard[0].shameScore}/100) with ${shameLeaderboard[0].shameCommitCount} flagged commits.`;

  return { files, shameLeaderboard, totalShameCommits, summary };
}
```

### Step 4: Run tests to verify they pass

```bash
pnpm --filter @lore/core test -- --reporter=verbose analyzers/forensics
```

Expected: All tests pass.

### Step 5: Commit

```bash
git add packages/core/src/analyzers/forensics.ts packages/core/src/analyzers/forensics.test.ts
git commit -m "feat: add forensics analyzer with weighted shame scoring"
```

---

## Task 4: Wire forensics into cursed file scoring

**Files:**
- Modify: `packages/core/src/analyzers/cursed-files.ts`
- Modify: `packages/core/src/analyzers/cursed-files.test.ts`

### Step 1: Add a failing test for shame bonus in cursed-files

Open `cursed-files.test.ts` and add a test (don't change the existing ones). You'll need to look at how the existing `makeCursed*` helpers are structured — add this test that asserts shame pushes a borderline file over the curse threshold:

```typescript
import { analyzeForensics } from './forensics.js';
import type { ForensicsReport } from '../types.js';

// Add a helper at the top of the file:
function makeEmptyForensics(): ForensicsReport {
  return { files: [], shameLeaderboard: [], totalShameCommits: 0, summary: '' };
}
```

Then update ALL existing `findCursedFiles(...)` calls in the test file to pass a forensics argument:
```typescript
findCursedFiles(churn, busFactor, ageMap, makeEmptyForensics(), totalCommits)
```

Add this new test:
```typescript
it('adds shame bonus to curse score for highly shameful files', () => {
  // Build a file that's borderline cursed (churn score ~40, no bus factor risk)
  // but has a shame score of 75+ — should get +20 and potentially cross threshold
  const forensics: ForensicsReport = {
    files: [{
      file: 'src/auth.ts',
      shameScore: 80,
      rawShamePoints: 24,
      shameCommitCount: 5,
      topShameCommits: [],
      dominantKeywords: ['revert'],
    }],
    shameLeaderboard: [],
    totalShameCommits: 5,
    summary: '',
  };

  // Provide a file in the churn top files but with borderline score
  // by constructing minimal churn/bus/age reports
  // ... (see existing test patterns for how to build these)
  // Then assert that the cursed file has a reason mentioning "revert"
});
```

> **Note:** Look at the existing `cursed-files.test.ts` to understand the exact shape of the mock reports before writing this test. The pattern matches how other analyzers mock their inputs.

### Step 2: Run tests to verify existing tests now fail (due to missing forensics param)

```bash
pnpm --filter @lore/core test -- --reporter=verbose analyzers/cursed-files
```

Expected: FAIL — `findCursedFiles` signature mismatch.

### Step 3: Update `cursed-files.ts` to accept and use forensics

```typescript
import type { ChurnReport, BusFactorReport, AgeMapReport, ForensicsReport } from '../types.js';
import type { CursedFile } from '../types.js';

export function findCursedFiles(
  churn: ChurnReport,
  busFactor: BusFactorReport,
  ageMap: AgeMapReport,
  forensics: ForensicsReport,
  totalCommits: number
): CursedFile[] {
  const churnByFile = new Map(churn.files.map(f => [f.file, f]));
  const busFactorByFile = new Map(busFactor.files.map(f => [f.file, f]));
  const ageByFile = new Map(ageMap.files.map(f => [f.file, f]));
  const forensicsByFile = new Map(forensics.files.map(f => [f.file, f]));

  const candidates = new Set([
    ...churn.topFiles.map(f => f.file),
    ...busFactor.criticalFiles.map(f => f.file),
    ...forensics.shameLeaderboard.map(f => f.file),
  ]);

  const cursed: CursedFile[] = [];

  for (const file of candidates) {
    const c = churnByFile.get(file);
    const b = busFactorByFile.get(file);
    const a = ageByFile.get(file);
    const f = forensicsByFile.get(file);

    if (!c) continue;

    const reasons: string[] = [];
    let curseScore = 0;

    // High churn
    if (c.churnScore > 75) {
      reasons.push(`Modified in ${Math.round((c.commitCount / totalCommits) * 100)}% of all commits`);
      curseScore += 35;
    } else if (c.churnScore > 40) {
      reasons.push(`Frequently modified (${c.commitCount} commits)`);
      curseScore += 15;
    }

    // Bus factor risk
    if (b) {
      if (b.risk === 'critical') {
        reasons.push(`Single author owns ${b.dominantAuthorPercent}% of changes`);
        curseScore += 30;
      } else if (b.risk === 'high') {
        reasons.push(`Heavily concentrated ownership (${b.dominantAuthorPercent}% one author)`);
        curseScore += 15;
      } else if (b.uniqueAuthors > 5) {
        reasons.push(`${b.uniqueAuthors} different authors — high coordination overhead`);
        curseScore += 10;
      }
    }

    // Age paradox: old but still churning
    if (a && a.ageInDays < 30 && c.churnScore > 60) {
      reasons.push('Still actively changing despite being a core file');
      curseScore += 10;
    }

    // Shame bonus
    if (f) {
      const topKw = f.dominantKeywords[0];
      if (f.shameScore >= 75) {
        reasons.push(
          `${f.shameCommitCount} shame commits detected${topKw ? ` ("${topKw}" appears repeatedly)` : ''} — this file keeps breaking`
        );
        curseScore += 20;
      } else if (f.shameScore >= 50) {
        reasons.push(`High rate of fix/revert commits (shame score: ${f.shameScore}/100)`);
        curseScore += 12;
      } else if (f.shameScore >= 25) {
        reasons.push('Notable pattern of shame commits');
        curseScore += 6;
      }
    }

    if (curseScore < 50 || reasons.length === 0) continue;

    const narrative = buildNarrative(file, c.commitCount, b?.uniqueAuthors ?? 1, c.churnScore, totalCommits);

    cursed.push({
      file,
      curseScore: Math.min(curseScore, 100),
      reasons,
      churn: c.commitCount,
      authors: b?.uniqueAuthors ?? 1,
      ageDays: a?.ageInDays ?? 0,
      narrative,
    });
  }

  return cursed.sort((a, b) => b.curseScore - a.curseScore);
}

// buildNarrative stays exactly the same — no changes needed
```

### Step 4: Run all tests to verify they pass

```bash
pnpm --filter @lore/core test
```

Expected: All tests pass.

### Step 5: Commit

```bash
git add packages/core/src/analyzers/cursed-files.ts packages/core/src/analyzers/cursed-files.test.ts
git commit -m "feat: wire forensics shame score into cursed file scoring (+20 max bonus)"
```

---

## Task 5: Wire forensics into the runner

**Files:**
- Modify: `packages/core/src/runner.ts`
- Modify: `packages/core/src/index.ts` (if `analyzeForensics` needs to be re-exported)

### Step 1: Update `runner.ts`

Add the import and call:

```typescript
import { analyzeForensics } from './analyzers/forensics.js';
```

After the `analyzeContributors` call, add:
```typescript
onProgress?.('Analyzing commit message forensics...');
const forensics = analyzeForensics(commits, trackedFiles);
```

Update the `findCursedFiles` call:
```typescript
const cursedFiles = findCursedFiles(churn, busFactors, ageMap, forensics, commits.length);
```

Add `forensics` to the return object:
```typescript
return {
  timestamp: new Date().toISOString(),
  repoPath,
  repoName,
  meta: { ... },
  churn,
  busFactors,
  ageMap,
  contributors,
  cursedFiles,
  forensics,   // ← add this line
};
```

### Step 2: Build to verify no TypeScript errors

```bash
pnpm --filter @lore/core build
```

Expected: Builds successfully.

### Step 3: Run the CLI against a real repo to verify end-to-end

```bash
node apps/cli/dist/index.js --path ~/Desktop/lore --json | jq '.forensics.summary'
```

Expected: A string like `"packages/core/src/analyzers/cursed-files.ts has the highest shame score..."` (or similar, depending on the repo's commit history).

### Step 4: Commit

```bash
git add packages/core/src/runner.ts
git commit -m "feat: call analyzeForensics in runner, include forensics in LoreReport"
```

---

## Task 6: Add `--shame` CLI flag and panel

**Files:**
- Modify: `apps/cli/src/index.tsx`
- Modify: `apps/cli/src/components/App.tsx`

### Step 1: Add `--shame` option to Commander in `index.tsx`

```typescript
.option('--shame', 'Show commit message forensics / shame leaderboard panel')
```

Update the opts type:
```typescript
const opts = program.opts<{
  path: string;
  branch?: string;
  since?: string;
  web?: boolean;
  json?: boolean;
  shame?: boolean;   // ← add this
}>();
```

Pass `showShame` to `<App>`:
```typescript
return <App report={report} progress={progress} error={error} showShame={opts.shame ?? false} />;
```

### Step 2: Update `App.tsx` to accept and use `showShame`

Update the `Props` interface:
```typescript
interface Props {
  report: LoreReport | null;
  progress: string;
  error: string | null;
  showShame: boolean;   // ← add this
}
```

Update the `App` function signature:
```typescript
export function App({ report, progress, error, showShame }: Props) {
```

Add the conditional shame panel after `<BusFactorPanel>`:
```typescript
{showShame && (
  <>
    <Newline />
    <ShamePanel report={report} />
  </>
)}
```

### Step 3: Add the `ShamePanel` component

Add this after `BusFactorPanel` in `App.tsx`:

```typescript
function ShamePanel({ report }: { report: LoreReport }) {
  const { forensics } = report;
  if (forensics.shameLeaderboard.length === 0) {
    return (
      <Box>
        <Text color="green">✓ No commit message red flags detected</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Text color="magenta" bold>
        {`── Shame Leaderboard (${forensics.totalShameCommits} flagged commits) ───────────────────`}
      </Text>
      <Text color="gray" dimColor>{forensics.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {forensics.shameLeaderboard.slice(0, 8).map(f => (
          <Box key={f.file} flexDirection="column" marginBottom={1}>
            <Box gap={2}>
              <Text color="magenta">☠</Text>
              <Text color="white">{truncatePath(f.file, 50)}</Text>
              <Text color="magenta">[{f.shameScore}/100]</Text>
              <Text color="gray" dimColor>{f.shameCommitCount} shame commits</Text>
            </Box>
            {f.topShameCommits.slice(0, 1).map(c => (
              <Text key={c.hash} color="gray" dimColor>  "{c.message}"</Text>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

### Step 4: Build and test the flag manually

```bash
pnpm build
node apps/cli/dist/index.js --path ~/Desktop/lore --shame
```

Expected: The shame leaderboard panel appears at the bottom of the output.

Also verify without the flag that the panel is hidden:
```bash
node apps/cli/dist/index.js --path ~/Desktop/lore
```

Expected: No shame panel.

### Step 5: Commit

```bash
git add apps/cli/src/index.tsx apps/cli/src/components/App.tsx
git commit -m "feat: add --shame flag and ShamePanel to CLI"
```

---

## Task 7: Documentation

**Files:**
- Modify: `README.md`

### Step 1: Read the current README to find the right insertion point

```bash
# Read README.md to understand its current structure before editing
```

### Step 2: Add a "How Lore scores files" section

Add this section to `README.md` in a logical location (after usage examples, before contributing):

```markdown
## How Lore scores files

Lore uses three scoring systems, each 0–100:

### Churn score
How often a file has been modified relative to the most-committed file in the repo.
A score of 100 means this file has been touched in the highest proportion of all commits.

### Shame score (`--shame`)
Based on commit message sentiment. Each commit touching a file is scanned for keywords:

| Weight | Keywords |
|--------|----------|
| 3 — Critical | `revert`, `hotfix`, `oops`, `fixup`, `broke`, `breaking` |
| 2 — Moderate | `hack`, `workaround`, `temporary`, `temp`, `kludge`, `band-aid` |
| 1 — Mild | `fix`, `bug`, `wrong`, `mistake`, `typo`, `cleanup` |

**Shame score** = `min((total weighted points / total commits for file) × 100, 100)`

Ratio-based: a file with 1 revert in 2 commits scores higher than 1 revert in 100 commits.

### Curse score
A composite of churn, bus factor risk, age anomalies, and shame. Files scoring ≥ 50 appear
in the Cursed Files panel. Shame contributes up to +20 points to the curse score.
```

### Step 3: Commit

```bash
git add README.md
git commit -m "docs: add scoring explanation to README (churn, shame, curse)"
```

---

## Completion Checklist

- [ ] `RawCommit.message` populated from git log
- [ ] All existing analyzer tests still pass
- [ ] `ForensicsReport` types in `types.ts`
- [ ] `analyzeForensics()` passes all unit tests
- [ ] Shame feeds into cursed file scoring
- [ ] `runner.ts` calls forensics and includes it in `LoreReport`
- [ ] `--shame` flag shows leaderboard panel
- [ ] README documents scoring
- [ ] `node apps/cli/dist/index.js --path <repo> --shame` works end-to-end
