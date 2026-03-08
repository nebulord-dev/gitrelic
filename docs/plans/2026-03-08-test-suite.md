# Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up Vitest with V8 coverage and UI for `@lore/core`, with colocated test files for all analyzers and git primitives.

**Architecture:** Vitest workspace at root, package-level config in core. Tests use mock `RawCommit[]` data — no real git repos. Export currently-private functions (`parseGitLog`, `isIgnored`) for direct testing.

**Tech Stack:** Vitest, @vitest/coverage-v8, @vitest/ui

---

### Task 1: Install dependencies and configure Vitest

**Files:**
- Create: `vitest.workspace.ts`
- Create: `packages/core/vitest.config.ts`
- Modify: `packages/core/package.json`
- Modify: `package.json`
- Modify: `turbo.json`

**Step 1: Install dependencies**

Run:
```bash
pnpm --filter @lore/core add -D vitest @vitest/coverage-v8 @vitest/ui
```

**Step 2: Create root workspace config**

Create `vitest.workspace.ts`:
```typescript
export default ['packages/core'];
```

**Step 3: Create core vitest config**

Create `packages/core/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
```

**Step 4: Add scripts to `packages/core/package.json`**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui --coverage",
"test:coverage": "vitest run --coverage"
```

**Step 5: Add test script to root `package.json`**

Add to `"scripts"`:
```json
"test": "turbo run test"
```

**Step 6: Add test task to `turbo.json`**

Add to `"tasks"`:
```json
"test": {
  "dependsOn": [],
  "cache": false
}
```

**Step 7: Verify vitest runs (no tests yet)**

Run: `pnpm --filter @lore/core test`
Expected: "No test files found" or similar — confirms config is wired correctly

**Step 8: Commit**

```bash
git add vitest.workspace.ts packages/core/vitest.config.ts packages/core/package.json package.json turbo.json pnpm-lock.yaml
git commit -m "chore: set up vitest with coverage and UI for @lore/core"
```

---

### Task 2: Export private functions and write git.test.ts

**Files:**
- Modify: `packages/core/src/utils/git.ts` (export `parseGitLog` and `isIgnored`)
- Create: `packages/core/src/utils/git.test.ts`

**Step 1: Export `parseGitLog` and `isIgnored`**

In `packages/core/src/utils/git.ts`, change:
```typescript
function parseGitLog(raw: string): RawCommit[] {
```
to:
```typescript
export function parseGitLog(raw: string): RawCommit[] {
```

And change:
```typescript
function isIgnored(file: string): boolean {
```
to:
```typescript
export function isIgnored(file: string): boolean {
```

**Step 2: Write git.test.ts**

Create `packages/core/src/utils/git.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseGitLog, isIgnored } from './git.js';

describe('parseGitLog', () => {
  it('parses a single commit with numstat', () => {
    const raw = [
      'COMMIT|abc123|alice@example.com|Alice|2025-01-15T10:00:00Z',
      '10\t2\tsrc/index.ts',
      '5\t0\tsrc/utils.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(1);
    expect(commits[0].hash).toBe('abc123');
    expect(commits[0].authorEmail).toBe('alice@example.com');
    expect(commits[0].authorName).toBe('Alice');
    expect(commits[0].files).toEqual(['src/index.ts', 'src/utils.ts']);
    expect(commits[0].insertions).toBe(15);
    expect(commits[0].deletions).toBe(2);
  });

  it('parses multiple commits', () => {
    const raw = [
      'COMMIT|aaa|alice@example.com|Alice|2025-01-15T10:00:00Z',
      '1\t0\tfile-a.ts',
      '',
      'COMMIT|bbb|bob@example.com|Bob|2025-01-16T10:00:00Z',
      '2\t1\tfile-b.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(2);
    expect(commits[0].files).toEqual(['file-a.ts']);
    expect(commits[1].files).toEqual(['file-b.ts']);
  });

  it('returns empty array for empty input', () => {
    expect(parseGitLog('')).toEqual([]);
  });

  it('skips rename noise with curly braces', () => {
    const raw = [
      'COMMIT|abc|a@b.com|A|2025-01-15T10:00:00Z',
      '5\t3\tsrc/{old => new}/file.ts',
      '1\t0\tsrc/clean.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits[0].files).toEqual(['src/clean.ts']);
  });
});

describe('isIgnored', () => {
  it('ignores lock files by exact name', () => {
    expect(isIgnored('package-lock.json')).toBe(true);
    expect(isIgnored('pnpm-lock.yaml')).toBe(true);
    expect(isIgnored('yarn.lock')).toBe(true);
    expect(isIgnored('bun.lockb')).toBe(true);
  });

  it('ignores lock files in subdirectories', () => {
    expect(isIgnored('packages/app/package-lock.json')).toBe(true);
  });

  it('ignores asset files by extension', () => {
    expect(isIgnored('public/favicon.ico')).toBe(true);
    expect(isIgnored('src/logo.png')).toBe(true);
    expect(isIgnored('assets/icon.svg')).toBe(true);
    expect(isIgnored('fonts/inter.woff2')).toBe(true);
  });

  it('ignores generated files by extension', () => {
    expect(isIgnored('dist/bundle.min.js')).toBe(true);
    expect(isIgnored('styles/app.min.css')).toBe(true);
    expect(isIgnored('dist/index.js.map')).toBe(true);
  });

  it('ignores framework generated files', () => {
    expect(isIgnored('next-env.d.ts')).toBe(true);
    expect(isIgnored('vite-env.d.ts')).toBe(true);
  });

  it('ignores directory prefixes', () => {
    expect(isIgnored('.next/cache/webpack.js')).toBe(true);
    expect(isIgnored('dist/index.js')).toBe(true);
    expect(isIgnored('coverage/lcov.info')).toBe(true);
  });

  it('passes through normal source files', () => {
    expect(isIgnored('src/index.ts')).toBe(false);
    expect(isIgnored('src/components/App.tsx')).toBe(false);
    expect(isIgnored('package.json')).toBe(false);
    expect(isIgnored('README.md')).toBe(false);
    expect(isIgnored('tsconfig.json')).toBe(false);
  });
});
```

**Step 3: Run tests**

Run: `pnpm --filter @lore/core test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/core/src/utils/git.ts packages/core/src/utils/git.test.ts
git commit -m "test: add git primitive tests (parseGitLog, isIgnored)"
```

---

### Task 3: Write churn.test.ts

**Files:**
- Create: `packages/core/src/analyzers/churn.test.ts`

**Step 1: Write churn.test.ts**

Create `packages/core/src/analyzers/churn.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { analyzeChurn } from './churn.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    files: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

describe('analyzeChurn', () => {
  it('assigns churnScore 100 to the most-committed file', () => {
    const commits = [
      makeCommit({ files: ['hot.ts', 'cold.ts'] }),
      makeCommit({ files: ['hot.ts'] }),
      makeCommit({ files: ['hot.ts'] }),
    ];
    const result = analyzeChurn(commits, ['hot.ts', 'cold.ts']);

    const hot = result.files.find(f => f.file === 'hot.ts')!;
    const cold = result.files.find(f => f.file === 'cold.ts')!;

    expect(hot.churnScore).toBe(100);
    expect(hot.commitCount).toBe(3);
    expect(cold.churnScore).toBe(33);
    expect(cold.commitCount).toBe(1);
  });

  it('assigns correct churn categories', () => {
    const commits = [
      makeCommit({ files: ['hot.ts', 'warm.ts', 'cold.ts', 'frozen.ts'] }),
      makeCommit({ files: ['hot.ts', 'warm.ts', 'cold.ts'] }),
      makeCommit({ files: ['hot.ts', 'warm.ts'] }),
      makeCommit({ files: ['hot.ts'] }),
    ];
    const tracked = ['hot.ts', 'warm.ts', 'cold.ts', 'frozen.ts'];
    const result = analyzeChurn(commits, tracked);

    expect(result.files.find(f => f.file === 'hot.ts')!.category).toBe('hot');
    expect(result.files.find(f => f.file === 'warm.ts')!.category).toBe('hot');
    expect(result.files.find(f => f.file === 'cold.ts')!.category).toBe('warm');
    expect(result.files.find(f => f.file === 'frozen.ts')!.category).toBe('cold');
  });

  it('limits topFiles to 20', () => {
    const files = Array.from({ length: 30 }, (_, i) => `file-${i}.ts`);
    const commits = [makeCommit({ files })];
    const result = analyzeChurn(commits, files);

    expect(result.topFiles).toHaveLength(20);
  });

  it('ignores files not in tracked set', () => {
    const commits = [makeCommit({ files: ['exists.ts', 'deleted.ts'] })];
    const result = analyzeChurn(commits, ['exists.ts']);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].file).toBe('exists.ts');
  });

  it('counts hotspots (churnScore > 75)', () => {
    const commits = [
      makeCommit({ files: ['a.ts'] }),
      makeCommit({ files: ['a.ts'] }),
      makeCommit({ files: ['a.ts'] }),
      makeCommit({ files: ['a.ts', 'b.ts'] }),
    ];
    const result = analyzeChurn(commits, ['a.ts', 'b.ts']);

    expect(result.hotspotCount).toBe(1);
  });

  it('produces a summary referencing the top file', () => {
    const commits = [makeCommit({ files: ['main.ts'] })];
    const result = analyzeChurn(commits, ['main.ts']);

    expect(result.summary).toContain('main.ts');
  });
});
```

**Step 2: Run tests**

Run: `pnpm --filter @lore/core test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/core/src/analyzers/churn.test.ts
git commit -m "test: add churn analyzer tests"
```

---

### Task 4: Write bus-factor.test.ts

**Files:**
- Create: `packages/core/src/analyzers/bus-factor.test.ts`

**Step 1: Write bus-factor.test.ts**

Create `packages/core/src/analyzers/bus-factor.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { analyzeBusFactor } from './bus-factor.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    files: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

describe('analyzeBusFactor', () => {
  it('marks single-author files as critical risk', () => {
    const commits = [
      makeCommit({ files: ['solo.ts'] }),
      makeCommit({ files: ['solo.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['solo.ts']);
    const file = result.files.find(f => f.file === 'solo.ts')!;

    expect(file.risk).toBe('critical');
    expect(file.uniqueAuthors).toBe(1);
    expect(file.dominantAuthorPercent).toBe(100);
  });

  it('marks multi-author files as low risk', () => {
    const commits = [
      makeCommit({ authorEmail: 'alice@example.com', files: ['shared.ts'] }),
      makeCommit({ authorEmail: 'bob@example.com', files: ['shared.ts'] }),
      makeCommit({ authorEmail: 'carol@example.com', files: ['shared.ts'] }),
      makeCommit({ authorEmail: 'dave@example.com', files: ['shared.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['shared.ts']);
    const file = result.files.find(f => f.file === 'shared.ts')!;

    expect(file.risk).toBe('low');
    expect(file.uniqueAuthors).toBe(4);
    expect(file.dominantAuthorPercent).toBe(25);
  });

  it('detects high risk when one author dominates (>=75%)', () => {
    const commits = [
      makeCommit({ authorEmail: 'alice@example.com', files: ['a.ts'] }),
      makeCommit({ authorEmail: 'alice@example.com', files: ['a.ts'] }),
      makeCommit({ authorEmail: 'alice@example.com', files: ['a.ts'] }),
      makeCommit({ authorEmail: 'bob@example.com', files: ['a.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['a.ts']);
    const file = result.files.find(f => f.file === 'a.ts')!;

    expect(file.risk).toBe('high');
    expect(file.dominantAuthorPercent).toBe(75);
  });

  it('populates criticalFiles list correctly', () => {
    const commits = [
      makeCommit({ authorEmail: 'alice@example.com', files: ['solo.ts', 'shared.ts'] }),
      makeCommit({ authorEmail: 'bob@example.com', files: ['shared.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['solo.ts', 'shared.ts']);

    expect(result.criticalFiles).toHaveLength(1);
    expect(result.criticalFiles[0].file).toBe('solo.ts');
  });

  it('ignores files not in tracked set', () => {
    const commits = [makeCommit({ files: ['exists.ts', 'deleted.ts'] })];
    const result = analyzeBusFactor(commits, ['exists.ts']);

    expect(result.files).toHaveLength(1);
  });

  it('produces a summary for critical files', () => {
    const commits = [makeCommit({ files: ['risky.ts'] })];
    const result = analyzeBusFactor(commits, ['risky.ts']);

    expect(result.summary).toContain('risky.ts');
    expect(result.summary).toContain('single author');
  });

  it('produces a healthy summary when no critical files', () => {
    const commits = [
      makeCommit({ authorEmail: 'alice@example.com', files: ['ok.ts'] }),
      makeCommit({ authorEmail: 'bob@example.com', files: ['ok.ts'] }),
      makeCommit({ authorEmail: 'carol@example.com', files: ['ok.ts'] }),
      makeCommit({ authorEmail: 'dave@example.com', files: ['ok.ts'] }),
    ];
    const result = analyzeBusFactor(commits, ['ok.ts']);

    expect(result.summary).toContain('healthy');
  });
});
```

**Step 2: Run tests**

Run: `pnpm --filter @lore/core test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/core/src/analyzers/bus-factor.test.ts
git commit -m "test: add bus factor analyzer tests"
```

---

### Task 5: Write age-map.test.ts

**Files:**
- Create: `packages/core/src/analyzers/age-map.test.ts`

**Step 1: Write age-map.test.ts**

Create `packages/core/src/analyzers/age-map.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { analyzeAgeMap } from './age-map.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    files: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

// Fix "now" so age calculations are deterministic
const FAKE_NOW = new Date('2026-03-08T12:00:00Z').getTime();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('analyzeAgeMap', () => {
  it('classifies files by percentage-based thresholds for a 1-year repo', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const repoAgeDays = 365;

    // fresh: ≤ 8% = 29 days → committed 20 days ago
    // aging: ≤ 33% = 120 days → committed 60 days ago
    // stale: ≤ 66% = 241 days → committed 200 days ago
    // ancient: > 66% → committed 300 days ago
    const commits = [
      makeCommit({ date: daysAgo(20), files: ['fresh.ts'] }),
      makeCommit({ date: daysAgo(60), files: ['aging.ts'] }),
      makeCommit({ date: daysAgo(200), files: ['stale.ts'] }),
      makeCommit({ date: daysAgo(300), files: ['ancient.ts'] }),
    ];
    const tracked = ['fresh.ts', 'aging.ts', 'stale.ts', 'ancient.ts'];

    const result = analyzeAgeMap(commits, tracked, repoAgeDays);

    expect(result.files.find(f => f.file === 'fresh.ts')!.status).toBe('fresh');
    expect(result.files.find(f => f.file === 'aging.ts')!.status).toBe('aging');
    expect(result.files.find(f => f.file === 'stale.ts')!.status).toBe('stale');
    expect(result.files.find(f => f.file === 'ancient.ts')!.status).toBe('ancient');
  });

  it('scales thresholds for a young repo (90 days)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const repoAgeDays = 90;

    // fresh: ≤ 8% = 7 days → committed 5 days ago
    // aging: ≤ 33% = 30 days → committed 15 days ago
    // stale: ≤ 66% = 59 days → committed 40 days ago
    // ancient: > 66% → committed 70 days ago
    const commits = [
      makeCommit({ date: daysAgo(5), files: ['fresh.ts'] }),
      makeCommit({ date: daysAgo(15), files: ['aging.ts'] }),
      makeCommit({ date: daysAgo(40), files: ['stale.ts'] }),
      makeCommit({ date: daysAgo(70), files: ['ancient.ts'] }),
    ];
    const tracked = ['fresh.ts', 'aging.ts', 'stale.ts', 'ancient.ts'];

    const result = analyzeAgeMap(commits, tracked, repoAgeDays);

    expect(result.files.find(f => f.file === 'fresh.ts')!.status).toBe('fresh');
    expect(result.files.find(f => f.file === 'aging.ts')!.status).toBe('aging');
    expect(result.files.find(f => f.file === 'stale.ts')!.status).toBe('stale');
    expect(result.files.find(f => f.file === 'ancient.ts')!.status).toBe('ancient');
  });

  it('counts stale and ancient files', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const commits = [
      makeCommit({ date: daysAgo(5), files: ['fresh.ts'] }),
      makeCommit({ date: daysAgo(250), files: ['stale.ts'] }),
      makeCommit({ date: daysAgo(300), files: ['ancient.ts'] }),
    ];

    const result = analyzeAgeMap(commits, ['fresh.ts', 'stale.ts', 'ancient.ts'], 365);

    expect(result.staleFiles).toHaveLength(1);
    expect(result.ancientFiles).toHaveLength(1);
  });

  it('sorts files oldest first', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const commits = [
      makeCommit({ date: daysAgo(10), files: ['new.ts'] }),
      makeCommit({ date: daysAgo(100), files: ['old.ts'] }),
    ];

    const result = analyzeAgeMap(commits, ['new.ts', 'old.ts'], 365);

    expect(result.files[0].file).toBe('old.ts');
    expect(result.files[1].file).toBe('new.ts');
  });

  it('uses most recent commit date when file has multiple commits', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const commits = [
      makeCommit({ date: daysAgo(100), files: ['multi.ts'] }),
      makeCommit({ date: daysAgo(5), files: ['multi.ts'] }),
    ];

    const result = analyzeAgeMap(commits, ['multi.ts'], 365);

    expect(result.files[0].ageInDays).toBeLessThanOrEqual(6);
  });

  it('produces summary mentioning ancient files', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const commits = [makeCommit({ date: daysAgo(300), files: ['old.ts'] })];

    const result = analyzeAgeMap(commits, ['old.ts'], 365);

    expect(result.summary).toContain('1 file');
  });
});

function daysAgo(n: number): string {
  return new Date(FAKE_NOW - n * 86_400_000).toISOString();
}
```

**Step 2: Run tests**

Run: `pnpm --filter @lore/core test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/core/src/analyzers/age-map.test.ts
git commit -m "test: add age map analyzer tests (percentage-based thresholds)"
```

---

### Task 6: Write contributors.test.ts

**Files:**
- Create: `packages/core/src/analyzers/contributors.test.ts`

**Step 1: Write contributors.test.ts**

Create `packages/core/src/analyzers/contributors.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { analyzeContributors } from './contributors.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    files: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

const FAKE_NOW = new Date('2026-03-08T12:00:00Z').getTime();

afterEach(() => {
  vi.restoreAllMocks();
});

function daysAgo(n: number): string {
  return new Date(FAKE_NOW - n * 86_400_000).toISOString();
}

describe('analyzeContributors', () => {
  it('marks recent contributors as active (within 25% of repo age)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const repoAgeDays = 365; // active window = 91 days

    const commits = [
      makeCommit({ authorEmail: 'alice@example.com', date: daysAgo(30), files: ['a.ts'] }),
    ];

    const result = analyzeContributors(commits, repoAgeDays);
    expect(result.activeContributors).toHaveLength(1);
    expect(result.activeContributors[0].email).toBe('alice@example.com');
  });

  it('marks old contributors as ghosts (beyond 50% of repo age)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const repoAgeDays = 365; // ghost window = 183 days

    const commits = [
      makeCommit({ authorEmail: 'ghost@example.com', date: daysAgo(200), files: ['a.ts'] }),
    ];

    const result = analyzeContributors(commits, repoAgeDays);
    expect(result.ghostContributors).toHaveLength(1);
    expect(result.ghostContributors[0].email).toBe('ghost@example.com');
  });

  it('scales windows for a young repo (90 days)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const repoAgeDays = 90; // active = 23 days, ghost = 45 days

    const commits = [
      makeCommit({ authorEmail: 'active@example.com', date: daysAgo(10), files: ['a.ts'] }),
      makeCommit({ authorEmail: 'ghost@example.com', date: daysAgo(60), files: ['b.ts'] }),
    ];

    const result = analyzeContributors(commits, repoAgeDays);
    expect(result.activeContributors).toHaveLength(1);
    expect(result.activeContributors[0].email).toBe('active@example.com');
    expect(result.ghostContributors).toHaveLength(1);
    expect(result.ghostContributors[0].email).toBe('ghost@example.com');
  });

  it('extracts focus areas from file paths', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const commits = [
      makeCommit({ date: daysAgo(1), files: ['src/components/App.tsx', 'src/components/Nav.tsx', 'src/utils/helpers.ts'] }),
    ];

    const result = analyzeContributors(commits, 365);
    expect(result.contributors[0].focusAreas).toContain('src/components');
  });

  it('aggregates lines changed across commits', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const commits = [
      makeCommit({ date: daysAgo(1), insertions: 50, deletions: 10, files: ['a.ts'] }),
      makeCommit({ date: daysAgo(2), insertions: 30, deletions: 5, files: ['b.ts'] }),
    ];

    const result = analyzeContributors(commits, 365);
    expect(result.contributors[0].linesChanged).toBe(95);
  });

  it('sorts contributors by commit count descending', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const commits = [
      makeCommit({ authorEmail: 'alice@example.com', date: daysAgo(1), files: ['a.ts'] }),
      makeCommit({ authorEmail: 'alice@example.com', date: daysAgo(2), files: ['a.ts'] }),
      makeCommit({ authorEmail: 'bob@example.com', date: daysAgo(1), files: ['b.ts'] }),
    ];

    const result = analyzeContributors(commits, 365);
    expect(result.contributors[0].email).toBe('alice@example.com');
    expect(result.contributors[1].email).toBe('bob@example.com');
  });

  it('includes dynamic day count in ghost summary', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
    const commits = [
      makeCommit({ authorEmail: 'ghost@example.com', date: daysAgo(200), files: ['a.ts'] }),
    ];

    const result = analyzeContributors(commits, 365);
    expect(result.summary).toContain('183');
  });
});
```

**Step 2: Run tests**

Run: `pnpm --filter @lore/core test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/core/src/analyzers/contributors.test.ts
git commit -m "test: add contributor analyzer tests (relative active/ghost windows)"
```

---

### Task 7: Write cursed-files.test.ts

**Files:**
- Create: `packages/core/src/analyzers/cursed-files.test.ts`

**Step 1: Write cursed-files.test.ts**

Create `packages/core/src/analyzers/cursed-files.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { findCursedFiles } from './cursed-files.js';
import type { ChurnReport, BusFactorReport, AgeMapReport } from '../types.js';

// Helper to build minimal report shapes
function makeChurnReport(files: { file: string; commitCount: number; churnScore: number }[]): ChurnReport {
  return {
    files: files.map(f => ({ ...f, category: f.churnScore > 75 ? 'hot' as const : f.churnScore > 40 ? 'warm' as const : 'cold' as const })),
    topFiles: files.slice(0, 20).map(f => ({ ...f, category: 'hot' as const })),
    hotspotCount: files.filter(f => f.churnScore > 75).length,
    summary: '',
  };
}

function makeBusFactorReport(files: { file: string; risk: 'critical' | 'high' | 'medium' | 'low'; dominantAuthorPercent: number; uniqueAuthors: number }[]): BusFactorReport {
  return {
    files: files.map(f => ({
      ...f,
      authors: ['alice@example.com'],
      dominantAuthor: 'alice@example.com',
    })),
    criticalFiles: files.filter(f => f.risk === 'critical').map(f => ({
      ...f,
      authors: ['alice@example.com'],
      dominantAuthor: 'alice@example.com',
    })),
    overallBusFactor: 1,
    summary: '',
  };
}

function makeAgeMapReport(files: { file: string; ageInDays: number }[]): AgeMapReport {
  return {
    files: files.map(f => ({
      ...f,
      lastCommitDate: new Date(Date.now() - f.ageInDays * 86_400_000).toISOString(),
      status: 'fresh' as const,
    })),
    staleFiles: [],
    ancientFiles: [],
    medianAgeDays: 0,
    summary: '',
  };
}

describe('findCursedFiles', () => {
  it('requires score >= 50 to qualify', () => {
    // High churn (35) + high bus factor (15) = 50 → just qualifies
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 50, churnScore: 80 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'high', dominantAuthorPercent: 80, uniqueAuthors: 2 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 100 }]);

    const result = findCursedFiles(churn, bus, age, 100);
    expect(result).toHaveLength(1);
    expect(result[0].curseScore).toBe(50);
  });

  it('excludes files below threshold 50', () => {
    // Moderate churn (15) + high bus factor (15) = 30 → below threshold
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 20, churnScore: 50 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'high', dominantAuthorPercent: 80, uniqueAuthors: 2 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 100 }]);

    const result = findCursedFiles(churn, bus, age, 100);
    expect(result).toHaveLength(0);
  });

  it('requires multiple strong signals', () => {
    // Only critical bus factor (30) — no churn signal → below 50
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 5, churnScore: 20 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 100 }]);

    const result = findCursedFiles(churn, bus, age, 100);
    expect(result).toHaveLength(0);
  });

  it('combines hot churn + critical bus factor for high score', () => {
    // Hot churn (35) + critical bus factor (30) = 65
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 80, churnScore: 90 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 100 }]);

    const result = findCursedFiles(churn, bus, age, 100);
    expect(result).toHaveLength(1);
    expect(result[0].curseScore).toBe(65);
  });

  it('caps score at 100', () => {
    // Hot churn (35) + critical (30) + age paradox (10) + many authors... would exceed 100
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 90, churnScore: 95 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 10 }]);

    const result = findCursedFiles(churn, bus, age, 100);
    expect(result[0].curseScore).toBeLessThanOrEqual(100);
  });

  it('sorts by curseScore descending', () => {
    const churn = makeChurnReport([
      { file: 'worst.ts', commitCount: 90, churnScore: 95 },
      { file: 'bad.ts', commitCount: 60, churnScore: 80 },
    ]);
    const bus = makeBusFactorReport([
      { file: 'worst.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 },
      { file: 'bad.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 },
    ]);
    const age = makeAgeMapReport([
      { file: 'worst.ts', ageInDays: 10 },
      { file: 'bad.ts', ageInDays: 10 },
    ]);

    const result = findCursedFiles(churn, bus, age, 100);
    expect(result[0].file).toBe('worst.ts');
  });

  it('includes reasons for each signal', () => {
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 80, churnScore: 90 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 100 }]);

    const result = findCursedFiles(churn, bus, age, 100);
    expect(result[0].reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('only considers candidates from topFiles and criticalFiles', () => {
    // File not in topFiles or criticalFiles — should be excluded even with high scores
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 80, churnScore: 90 }]);
    churn.topFiles = []; // remove from candidates
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'low', dominantAuthorPercent: 30, uniqueAuthors: 4 }]);
    bus.criticalFiles = []; // remove from candidates
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 100 }]);

    const result = findCursedFiles(churn, bus, age, 100);
    expect(result).toHaveLength(0);
  });
});
```

**Step 2: Run tests**

Run: `pnpm --filter @lore/core test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/core/src/analyzers/cursed-files.test.ts
git commit -m "test: add cursed files analyzer tests (threshold, multi-signal, scoring)"
```

---

### Task 8: Run coverage and verify UI

**Files:** None (validation only)

**Step 1: Run coverage**

Run: `pnpm --filter @lore/core test:coverage`
Expected: Coverage report prints to terminal. Note the baseline numbers.

**Step 2: Verify UI works**

Run: `pnpm --filter @lore/core test:ui`
Expected: Browser opens Vitest UI at `http://localhost:51204/__vitest__/` showing all tests and coverage tab.

**Step 3: Final commit with any adjustments**

If any fixes were needed, commit them. Otherwise, this task is done.
