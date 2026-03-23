# Phase 2: LOC, Hotspot Score & Coupling Map — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new core analyzers (LOC, hotspot score, coupling map) with CLI and web UI surfaces.

**Architecture:** Three stateless analyzer functions following the existing pattern. LOC reads the filesystem (first async analyzer). Hotspot composes churn + LOC data. Coupling builds co-occurrence matrix from commits. Runner calls them in dependency order. CLI gets two new panels, web gets updated Hotspots tab and new Coupling tab.

**Tech Stack:** TypeScript, Vitest, Ink (CLI), React + Tailwind (web)

---

## File Structure

**New files:**
| File | Responsibility |
|------|----------------|
| `packages/core/src/analyzers/loc.ts` | LOC counting per file, language breakdown |
| `packages/core/src/analyzers/loc.test.ts` | LOC analyzer unit tests |
| `packages/core/src/analyzers/hotspot.ts` | Hotspot score formula (churn × log2(loc)) |
| `packages/core/src/analyzers/hotspot.test.ts` | Hotspot analyzer unit tests |
| `packages/core/src/analyzers/coupling.ts` | Temporal coupling from commit co-occurrence |
| `packages/core/src/analyzers/coupling.test.ts` | Coupling analyzer unit tests |

**Modified files:**
| File | Change |
|------|--------|
| `packages/core/src/types.ts` | Add `LocReport`, `HotspotReport`, `CouplingReport` types + fields on `GitloreReport` |
| `packages/core/src/runner.ts` | Call three new analyzers, add progress steps |
| `packages/core/src/index.ts` | Export new types |
| `apps/cli/src/components/App.tsx` | Add `HotspotPanel` and `CouplingPanel` |
| `apps/web/src/components/Dashboard.tsx` | Update Hotspots tab, add Coupling tab, update Overview card |

---

## Chunk 1: Types and LOC Analyzer

### Task 1: Add new types to `types.ts`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add LOC types to `types.ts`**

Add after the `ParallelDevReport` section:

```typescript
// ─── Lines of code ───────────────────────────────────────────────────────────

export interface FileLocEntry {
  file: string;
  lines: number;
  language: string;
}

export interface LanguageBreakdown {
  language: string;
  files: number;
  lines: number;
  percentage: number;
}

export interface LocReport {
  totalFiles: number;
  totalLines: number;
  files: FileLocEntry[];
  languages: LanguageBreakdown[];
  summary: string;
}
```

- [ ] **Step 2: Add Hotspot types to `types.ts`**

Add after the `LocReport` section:

```typescript
// ─── Hotspot score ───────────────────────────────────────────────────────────

export interface HotspotEntry {
  file: string;
  hotspotScore: number;
  churnScore: number;
  loc: number;
  category: HotspotCategory;
}

export type HotspotCategory = 'critical' | 'warning' | 'moderate' | 'low';

export interface HotspotReport {
  files: HotspotEntry[];
  topHotspots: HotspotEntry[];
  summary: string;
}
```

- [ ] **Step 3: Add Coupling types to `types.ts`**

Add after the `HotspotReport` section:

```typescript
// ─── Coupling map ────────────────────────────────────────────────────────────

export interface CoupledPair {
  fileA: string;
  fileB: string;
  coCommits: number;
  totalCommitsA: number;
  totalCommitsB: number;
  couplingStrength: number;
}

export interface FileCouplingProfile {
  file: string;
  partners: CoupledPair[];
  topPartner: string | null;
  couplingScore: number;
}

export interface CouplingReport {
  pairs: CoupledPair[];
  fileProfiles: FileCouplingProfile[];
  topPairs: CoupledPair[];
  summary: string;
}
```

- [ ] **Step 4: Add new fields to `GitloreReport`**

Add three fields after `parallelDev`:

```typescript
export interface GitloreReport {
  // ... existing fields ...
  parallelDev: ParallelDevReport;
  loc: LocReport;
  hotspots: HotspotReport;
  coupling: CouplingReport;
}
```

- [ ] **Step 5: Export new types from `index.ts`**

Add to the type exports in `packages/core/src/index.ts`:

```typescript
  LocReport,
  FileLocEntry,
  LanguageBreakdown,
  HotspotReport,
  HotspotEntry,
  HotspotCategory,
  CouplingReport,
  CoupledPair,
  FileCouplingProfile,
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(core): add LOC, hotspot, and coupling report types"
```

---

### Task 2: LOC Analyzer — Tests

**Files:**
- Create: `packages/core/src/analyzers/loc.test.ts`

- [ ] **Step 1: Write LOC analyzer tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { analyzeLoc } from './loc.js';
import * as fs from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockReadFile = vi.mocked(fs.readFile);

describe('analyzeLoc', () => {
  it('counts lines for each file', async () => {
    mockReadFile.mockResolvedValueOnce('line1\nline2\nline3\n');
    mockReadFile.mockResolvedValueOnce('single\n');

    const result = await analyzeLoc(['src/a.ts', 'src/b.ts'], '/repo');

    expect(result.files).toEqual([
      { file: 'src/a.ts', lines: 3, language: 'TypeScript' },
      { file: 'src/b.ts', lines: 1, language: 'TypeScript' },
    ]);
    expect(result.totalLines).toBe(4);
    expect(result.totalFiles).toBe(2);
  });

  it('detects language from file extension', async () => {
    mockReadFile.mockResolvedValueOnce('x\n');
    mockReadFile.mockResolvedValueOnce('x\n');
    mockReadFile.mockResolvedValueOnce('x\n');

    const result = await analyzeLoc(['app.py', 'main.go', 'style.css'], '/repo');

    expect(result.files[0].language).toBe('Python');
    expect(result.files[1].language).toBe('Go');
    expect(result.files[2].language).toBe('CSS');
  });

  it('aggregates language breakdown with percentages', async () => {
    mockReadFile.mockResolvedValueOnce('a\nb\nc\n');  // 3 lines TS
    mockReadFile.mockResolvedValueOnce('a\nb\nc\nd\ne\nf\ng\n');  // 7 lines TS
    mockReadFile.mockResolvedValueOnce('a\n');  // 1 line CSS

    const result = await analyzeLoc(['a.ts', 'b.tsx', 'c.css'], '/repo');

    const ts = result.languages.find(l => l.language === 'TypeScript')!;
    expect(ts.files).toBe(2);
    expect(ts.lines).toBe(10);
    expect(ts.percentage).toBeCloseTo(90.9, 0);

    const css = result.languages.find(l => l.language === 'CSS')!;
    expect(css.files).toBe(1);
    expect(css.lines).toBe(1);
  });

  it('handles unreadable files gracefully with lines: 0', async () => {
    mockReadFile.mockResolvedValueOnce('ok\n');
    mockReadFile.mockRejectedValueOnce(new Error('EACCES'));

    const result = await analyzeLoc(['good.ts', 'bad.ts'], '/repo');

    expect(result.files[0].lines).toBe(1);
    expect(result.files[1].lines).toBe(0);
    expect(result.totalLines).toBe(1);
  });

  it('handles empty files as 0 lines', async () => {
    mockReadFile.mockResolvedValueOnce('');

    const result = await analyzeLoc(['empty.ts'], '/repo');

    expect(result.files[0].lines).toBe(0);
  });

  it('sorts languages by lines descending', async () => {
    mockReadFile.mockResolvedValueOnce('a\n');
    mockReadFile.mockResolvedValueOnce('a\nb\nc\n');

    const result = await analyzeLoc(['small.css', 'big.ts'], '/repo');

    expect(result.languages[0].language).toBe('TypeScript');
    expect(result.languages[1].language).toBe('CSS');
  });

  it('produces a summary string', async () => {
    mockReadFile.mockResolvedValueOnce('a\nb\n');

    const result = await analyzeLoc(['file.ts'], '/repo');

    expect(result.summary).toContain('2');
    expect(result.summary).toContain('1');
  });

  it('counts files without trailing newline correctly', async () => {
    mockReadFile.mockResolvedValueOnce('no-newline');

    const result = await analyzeLoc(['file.ts'], '/repo');

    expect(result.files[0].lines).toBe(1);
  });

  it('labels unknown extensions as "Other"', async () => {
    mockReadFile.mockResolvedValueOnce('x\n');

    const result = await analyzeLoc(['data.xyz'], '/repo');

    expect(result.files[0].language).toBe('Other');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @gitlore/core test -- --run src/analyzers/loc.test.ts`
Expected: FAIL — `./loc.js` module not found

---

### Task 3: LOC Analyzer — Implementation

**Files:**
- Create: `packages/core/src/analyzers/loc.ts`

- [ ] **Step 1: Implement LOC analyzer**

```typescript
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocReport, FileLocEntry, LanguageBreakdown } from '../types.js';

const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
  cs: 'C#', cpp: 'C++', c: 'C', php: 'PHP', swift: 'Swift', kt: 'Kotlin',
  css: 'CSS', scss: 'SCSS', less: 'LESS', html: 'HTML', vue: 'Vue',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML',
  md: 'Markdown', sh: 'Shell', bash: 'Shell', zsh: 'Shell',
  sql: 'SQL', graphql: 'GraphQL', gql: 'GraphQL',
  svelte: 'Svelte', astro: 'Astro',
};

function getLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return LANG_MAP[ext] ?? 'Other';
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  // Count newlines. A file ending with \n has N lines for N newlines.
  // A file not ending with \n still has that last line.
  let count = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') count++;
  }
  // If file doesn't end with newline, count the last line
  if (content[content.length - 1] !== '\n') count++;
  return count;
}

export async function analyzeLoc(trackedFiles: string[], repoPath: string): Promise<LocReport> {
  const files: FileLocEntry[] = await Promise.all(
    trackedFiles.map(async (file) => {
      let lines = 0;
      try {
        const content = await readFile(path.join(repoPath, file), 'utf-8');
        lines = countLines(content);
      } catch {
        // Unreadable file (permissions, symlink, binary) — skip
      }
      return { file, lines, language: getLanguage(file) };
    })
  );

  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

  // Build language breakdown
  const langAgg: Record<string, { files: number; lines: number }> = {};
  for (const f of files) {
    const entry = langAgg[f.language] ??= { files: 0, lines: 0 };
    entry.files++;
    entry.lines += f.lines;
  }

  const languages: LanguageBreakdown[] = Object.entries(langAgg)
    .map(([language, { files: fileCount, lines }]) => ({
      language,
      files: fileCount,
      lines,
      percentage: totalLines > 0 ? Math.round((lines / totalLines) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.lines - a.lines);

  const topLangs = languages.slice(0, 2).map(l => `${Math.round(l.percentage)}% ${l.language}`).join(', ');
  const summary = `${totalLines.toLocaleString()} lines across ${files.length} files (${topLangs})`;

  return {
    totalFiles: files.length,
    totalLines,
    files,
    languages,
    summary,
  };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @gitlore/core test -- --run src/analyzers/loc.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/analyzers/loc.ts packages/core/src/analyzers/loc.test.ts
git commit -m "feat(core): add LOC analyzer with language breakdown"
```

---

## Chunk 2: Hotspot Analyzer

### Task 4: Hotspot Analyzer — Tests

**Files:**
- Create: `packages/core/src/analyzers/hotspot.test.ts`

- [ ] **Step 1: Write hotspot analyzer tests**

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeHotspots } from './hotspot.js';
import type { ChurnReport, LocReport } from '../types.js';

function makeChurnReport(files: { file: string; churnScore: number }[]): ChurnReport {
  return {
    files: files.map(f => ({ ...f, commitCount: f.churnScore, category: 'hot' as const })),
    topFiles: [],
    hotspotCount: 0,
    summary: '',
  };
}

function makeLocReport(files: { file: string; lines: number }[]): LocReport {
  return {
    totalFiles: files.length,
    totalLines: files.reduce((s, f) => s + f.lines, 0),
    files: files.map(f => ({ ...f, language: 'TypeScript' })),
    languages: [],
    summary: '',
  };
}

describe('analyzeHotspots', () => {
  it('computes hotspot score as churnScore × log2(loc), normalized to 0-100', () => {
    const churn = makeChurnReport([
      { file: 'big.ts', churnScore: 100 },
      { file: 'small.ts', churnScore: 100 },
    ]);
    const loc = makeLocReport([
      { file: 'big.ts', lines: 1024 },   // log2(1024) = 10
      { file: 'small.ts', lines: 32 },   // log2(32) = 5
    ]);

    const result = analyzeHotspots(churn, loc);

    // big.ts raw = 100 * 10 = 1000 → normalized = 100
    // small.ts raw = 100 * 5 = 500 → normalized = 50
    expect(result.files[0].file).toBe('big.ts');
    expect(result.files[0].hotspotScore).toBe(100);
    expect(result.files[1].file).toBe('small.ts');
    expect(result.files[1].hotspotScore).toBe(50);
  });

  it('assigns correct categories based on score thresholds', () => {
    const churn = makeChurnReport([
      { file: 'a.ts', churnScore: 100 },
      { file: 'b.ts', churnScore: 70 },
      { file: 'c.ts', churnScore: 40 },
      { file: 'd.ts', churnScore: 10 },
    ]);
    const loc = makeLocReport([
      { file: 'a.ts', lines: 256 },
      { file: 'b.ts', lines: 256 },
      { file: 'c.ts', lines: 256 },
      { file: 'd.ts', lines: 256 },
    ]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files.find(f => f.file === 'a.ts')!.category).toBe('critical');
    expect(result.files.find(f => f.file === 'd.ts')!.category).toBe('low');
  });

  it('excludes files in churn but not in LOC (deleted files)', () => {
    const churn = makeChurnReport([{ file: 'deleted.ts', churnScore: 80 }]);
    const loc = makeLocReport([]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files).toHaveLength(0);
  });

  it('excludes files in LOC but not in churn (zero-churn files)', () => {
    const churn = makeChurnReport([]);
    const loc = makeLocReport([{ file: 'stable.ts', lines: 500 }]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files).toHaveLength(0);
  });

  it('clamps LOC to 1 for empty files (avoids log2(0) = -Infinity)', () => {
    const churn = makeChurnReport([{ file: 'empty.ts', churnScore: 50 }]);
    const loc = makeLocReport([{ file: 'empty.ts', lines: 0 }]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files[0].hotspotScore).toBe(0);
    expect(Number.isFinite(result.files[0].hotspotScore)).toBe(true);
  });

  it('limits topHotspots to 20', () => {
    const files = Array.from({ length: 25 }, (_, i) => ({ file: `f${i}.ts`, churnScore: 50 }));
    const churn = makeChurnReport(files);
    const loc = makeLocReport(files.map(f => ({ file: f.file, lines: 100 })));

    const result = analyzeHotspots(churn, loc);

    expect(result.topHotspots.length).toBe(20);
  });

  it('sorts files by hotspot score descending', () => {
    const churn = makeChurnReport([
      { file: 'low.ts', churnScore: 20 },
      { file: 'high.ts', churnScore: 100 },
    ]);
    const loc = makeLocReport([
      { file: 'low.ts', lines: 100 },
      { file: 'high.ts', lines: 100 },
    ]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files[0].file).toBe('high.ts');
    expect(result.files[1].file).toBe('low.ts');
  });

  it('produces a summary string', () => {
    const churn = makeChurnReport([{ file: 'a.ts', churnScore: 100 }]);
    const loc = makeLocReport([{ file: 'a.ts', lines: 256 }]);

    const result = analyzeHotspots(churn, loc);

    expect(result.summary).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @gitlore/core test -- --run src/analyzers/hotspot.test.ts`
Expected: FAIL — `./hotspot.js` module not found

---

### Task 5: Hotspot Analyzer — Implementation

**Files:**
- Create: `packages/core/src/analyzers/hotspot.ts`

- [ ] **Step 1: Implement hotspot analyzer**

```typescript
import type { ChurnReport, LocReport, HotspotReport, HotspotEntry, HotspotCategory } from '../types.js';

function getCategory(score: number): HotspotCategory {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'warning';
  if (score >= 25) return 'moderate';
  return 'low';
}

export function analyzeHotspots(churnReport: ChurnReport, locReport: LocReport): HotspotReport {
  // Build LOC lookup from loc report
  const locMap = new Map<string, number>();
  for (const f of locReport.files) {
    locMap.set(f.file, f.lines);
  }

  // Compute raw scores for files that exist in both churn and LOC
  const rawEntries: { file: string; churnScore: number; loc: number; rawScore: number }[] = [];

  for (const churnFile of churnReport.files) {
    const loc = locMap.get(churnFile.file);
    if (loc === undefined) continue; // deleted file — not in LOC
    const clampedLoc = Math.max(1, loc);
    const rawScore = churnFile.churnScore * Math.log2(clampedLoc);
    rawEntries.push({ file: churnFile.file, churnScore: churnFile.churnScore, loc, rawScore });
  }

  // Normalize to 0-100
  const maxRaw = Math.max(...rawEntries.map(e => e.rawScore), 1);

  const files: HotspotEntry[] = rawEntries
    .map(e => {
      const hotspotScore = Math.round((e.rawScore / maxRaw) * 100);
      return {
        file: e.file,
        hotspotScore,
        churnScore: e.churnScore,
        loc: e.loc,
        category: getCategory(hotspotScore),
      };
    })
    .sort((a, b) => b.hotspotScore - a.hotspotScore);

  const topHotspots = files.slice(0, 20);

  const criticalCount = files.filter(f => f.category === 'critical').length;
  const warningCount = files.filter(f => f.category === 'warning').length;
  const summary = `${criticalCount} critical hotspot${criticalCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''} across ${files.length} files`;

  return { files, topHotspots, summary };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @gitlore/core test -- --run src/analyzers/hotspot.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/analyzers/hotspot.ts packages/core/src/analyzers/hotspot.test.ts
git commit -m "feat(core): add hotspot analyzer (churn × complexity)"
```

---

## Chunk 3: Coupling Analyzer

### Task 6: Coupling Analyzer — Tests

**Files:**
- Create: `packages/core/src/analyzers/coupling.test.ts`

- [ ] **Step 1: Write coupling analyzer tests**

```typescript
import { describe, it, expect } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import { analyzeCoupling } from './coupling.js';

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

describe('analyzeCoupling', () => {
  it('detects co-occurring file pairs', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '2', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '3', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '4', files: ['auth.ts'] }),
    ];
    const tracked = ['auth.ts', 'session.ts'];

    const result = analyzeCoupling(commits, tracked);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].coCommits).toBe(3);
    expect(result.pairs[0].couplingStrength).toBe(100); // 3/min(4,3)=3/3=100%
  });

  it('filters out commits touching 30+ files', () => {
    const bigFiles = Array.from({ length: 30 }, (_, i) => `file${i}.ts`);
    const commits = [
      makeCommit({ hash: '1', files: bigFiles }), // excluded
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '4', files: ['a.ts', 'b.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts', ...bigFiles]);

    // Only the a.ts ↔ b.ts pair should show, not pairs from the big commit
    const bigFilePair = result.pairs.find(p =>
      p.fileA === 'file0.ts' || p.fileB === 'file0.ts'
    );
    expect(bigFilePair).toBeUndefined();
  });

  it('requires minimum 3 co-occurrences', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts'] }),
      // Only 2 co-occurrences — below threshold
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts']);

    expect(result.pairs).toHaveLength(0);
  });

  it('requires minimum 30% coupling strength', () => {
    // a.ts: 10 solo commits. b.ts: 10 solo commits. 3 shared commits.
    // a.ts total = 13, b.ts total = 13, co-commits = 3
    // strength = 3 / min(13, 13) = 23% — below 30%, excluded
    const commits: RawCommit[] = [];
    for (let i = 0; i < 10; i++) commits.push(makeCommit({ hash: `a${i}`, files: ['a.ts'] }));
    for (let i = 0; i < 10; i++) commits.push(makeCommit({ hash: `b${i}`, files: ['b.ts'] }));
    for (let i = 0; i < 3; i++) commits.push(makeCommit({ hash: `ab${i}`, files: ['a.ts', 'b.ts'] }));

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts']);

    expect(result.pairs).toHaveLength(0); // 23% < 30% threshold
  });

  it('includes pairs at exactly 30% coupling strength', () => {
    // a.ts: 10 commits total, b.ts: 10 commits total, 3 shared
    // strength = 3 / min(10, 10) = 30% — exactly at threshold
    const commits: RawCommit[] = [];
    for (let i = 0; i < 7; i++) commits.push(makeCommit({ hash: `a${i}`, files: ['a.ts'] }));
    for (let i = 0; i < 7; i++) commits.push(makeCommit({ hash: `b${i}`, files: ['b.ts'] }));
    for (let i = 0; i < 3; i++) commits.push(makeCommit({ hash: `ab${i}`, files: ['a.ts', 'b.ts'] }));

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts']);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].couplingStrength).toBe(30);
  });

  it('uses min(totalA, totalB) as denominator for strength', () => {
    // auth.ts: 8 commits, session.ts: 4 commits, co-appear: 4
    // strength = 4 / min(8,4) = 4/4 = 100%
    const commits: RawCommit[] = [
      makeCommit({ hash: '1', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '2', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '3', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '4', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '5', files: ['auth.ts'] }),
      makeCommit({ hash: '6', files: ['auth.ts'] }),
      makeCommit({ hash: '7', files: ['auth.ts'] }),
      makeCommit({ hash: '8', files: ['auth.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['auth.ts', 'session.ts']);

    expect(result.pairs[0].couplingStrength).toBe(100);
    expect(result.pairs[0].totalCommitsA).toBe(8);
    expect(result.pairs[0].totalCommitsB).toBe(4);
  });

  it('builds per-file coupling profiles', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts', 'b.ts', 'c.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts', 'c.ts']);

    const profileA = result.fileProfiles.find(p => p.file === 'a.ts')!;
    expect(profileA.partners).toHaveLength(2); // b.ts and c.ts
    expect(profileA.topPartner).toBeTruthy();
    expect(profileA.couplingScore).toBeGreaterThan(0);
  });

  it('ignores files not in tracked set', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['tracked.ts', 'deleted.ts'] }),
      makeCommit({ hash: '2', files: ['tracked.ts', 'deleted.ts'] }),
      makeCommit({ hash: '3', files: ['tracked.ts', 'deleted.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['tracked.ts']);

    expect(result.pairs).toHaveLength(0); // deleted.ts not in tracked set
  });

  it('returns empty report when no qualifying pairs exist', () => {
    const commits = [makeCommit({ hash: '1', files: ['lonely.ts'] })];

    const result = analyzeCoupling(commits, ['lonely.ts']);

    expect(result.pairs).toHaveLength(0);
    expect(result.fileProfiles).toHaveLength(0);
    expect(result.topPairs).toHaveLength(0);
  });

  it('limits topPairs to 20', () => {
    // Create 25 pairs that all qualify
    const files = Array.from({ length: 6 }, (_, i) => `f${i}.ts`); // 6 choose 2 = 15 pairs
    const commits = [
      makeCommit({ hash: '1', files }),
      makeCommit({ hash: '2', files }),
      makeCommit({ hash: '3', files }),
    ];

    const result = analyzeCoupling(commits, files);

    expect(result.topPairs.length).toBeLessThanOrEqual(20);
  });

  it('sorts pairs by coupling strength descending', () => {
    // a↔b: 5 co-commits (strong), a↔c: 3 co-commits (weaker)
    const commits: RawCommit[] = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '4', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '5', files: ['a.ts', 'b.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts', 'c.ts']);

    expect(result.pairs[0].couplingStrength).toBeGreaterThanOrEqual(
      result.pairs[result.pairs.length - 1].couplingStrength
    );
  });

  it('produces a summary string', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts', 'b.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts']);

    expect(result.summary).toContain('1'); // 1 pair
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @gitlore/core test -- --run src/analyzers/coupling.test.ts`
Expected: FAIL — `./coupling.js` module not found

---

### Task 7: Coupling Analyzer — Implementation

**Files:**
- Create: `packages/core/src/analyzers/coupling.ts`

- [ ] **Step 1: Implement coupling analyzer**

```typescript
import type { RawCommit } from '../utils/git.js';
import type { CouplingReport, CoupledPair, FileCouplingProfile } from '../types.js';

const MAX_FILES_PER_COMMIT = 30;
const MIN_CO_OCCURRENCES = 3;
const MIN_COUPLING_STRENGTH = 30;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

export function analyzeCoupling(commits: RawCommit[], trackedFiles: string[]): CouplingReport {
  const trackedSet = new Set(trackedFiles);
  const coOccurrences = new Map<string, number>();
  const fileTotalCommits = new Map<string, number>();

  for (const commit of commits) {
    // Filter to tracked files only
    const files = commit.files.filter(f => trackedSet.has(f));

    // Skip bulk commits
    if (files.length >= MAX_FILES_PER_COMMIT) continue;

    // Count per-file total commits
    for (const file of files) {
      fileTotalCommits.set(file, (fileTotalCommits.get(file) ?? 0) + 1);
    }

    // Record co-occurrences for every pair
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = pairKey(files[i], files[j]);
        coOccurrences.set(key, (coOccurrences.get(key) ?? 0) + 1);
      }
    }
  }

  // Build qualifying pairs
  const pairs: CoupledPair[] = [];

  for (const [key, coCommits] of coOccurrences) {
    if (coCommits < MIN_CO_OCCURRENCES) continue;

    const [fileA, fileB] = key.split('\0');
    const totalCommitsA = fileTotalCommits.get(fileA) ?? 0;
    const totalCommitsB = fileTotalCommits.get(fileB) ?? 0;
    const minCommits = Math.min(totalCommitsA, totalCommitsB);
    const couplingStrength = minCommits > 0 ? Math.round((coCommits / minCommits) * 100) : 0;

    if (couplingStrength < MIN_COUPLING_STRENGTH) continue;

    pairs.push({ fileA, fileB, coCommits, totalCommitsA, totalCommitsB, couplingStrength });
  }

  pairs.sort((a, b) => b.couplingStrength - a.couplingStrength);
  const topPairs = pairs.slice(0, 20);

  // Build per-file profiles
  const profileMap = new Map<string, CoupledPair[]>();
  for (const pair of pairs) {
    if (!profileMap.has(pair.fileA)) profileMap.set(pair.fileA, []);
    if (!profileMap.has(pair.fileB)) profileMap.set(pair.fileB, []);
    profileMap.get(pair.fileA)!.push(pair);
    profileMap.get(pair.fileB)!.push(pair);
  }

  const fileProfiles: FileCouplingProfile[] = [...profileMap.entries()]
    .map(([file, partners]) => {
      const sorted = [...partners].sort((a, b) => b.couplingStrength - a.couplingStrength);
      const topPartner = sorted[0]
        ? (sorted[0].fileA === file ? sorted[0].fileB : sorted[0].fileA)
        : null;
      const couplingScore = sorted.length > 0
        ? Math.round(sorted.reduce((s, p) => s + p.couplingStrength, 0) / sorted.length)
        : 0;
      return { file, partners: sorted, topPartner, couplingScore };
    })
    .sort((a, b) => b.couplingScore - a.couplingScore);

  const strongest = topPairs[0];
  const summary = pairs.length > 0 && strongest
    ? `${pairs.length} coupled pair${pairs.length !== 1 ? 's' : ''} found, strongest: ${strongest.fileA} ↔ ${strongest.fileB} (${strongest.couplingStrength}%)`
    : 'No temporal coupling detected';

  return { pairs, fileProfiles, topPairs, summary };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @gitlore/core test -- --run src/analyzers/coupling.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/analyzers/coupling.ts packages/core/src/analyzers/coupling.test.ts
git commit -m "feat(core): add temporal coupling analyzer"
```

---

## Chunk 4: Runner Integration

### Task 8: Wire analyzers into runner

**Files:**
- Modify: `packages/core/src/runner.ts`

- [ ] **Step 1: Add imports to `runner.ts`**

Add after the existing analyzer imports:

```typescript
import { analyzeLoc } from './analyzers/loc.js';
import { analyzeHotspots } from './analyzers/hotspot.js';
import { analyzeCoupling } from './analyzers/coupling.js';
```

- [ ] **Step 2: Add analyzer calls before `cursedFiles`**

Insert after the `parallelDev` call and before `cursedFiles`:

```typescript
  onProgress?.('Counting lines of code...');
  const loc = await analyzeLoc(trackedFiles, repoPath);

  onProgress?.('Computing hotspot scores...');
  const hotspots = analyzeHotspots(churn, loc);

  onProgress?.('Mapping file coupling...');
  const coupling = analyzeCoupling(commits, trackedFiles);
```

- [ ] **Step 3: Add new fields to return object**

Add `loc`, `hotspots`, and `coupling` to the return object:

```typescript
  return {
    // ... existing fields ...
    parallelDev,
    loc,
    hotspots,
    coupling,
  };
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @gitlore/core build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Run all core tests**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @gitlore/core test -- --run`
Expected: All tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/runner.ts
git commit -m "feat(core): wire LOC, hotspot, and coupling analyzers into runner"
```

---

## Chunk 5: CLI Panels

### Task 9: Add Hotspot and Coupling panels to CLI

**Files:**
- Modify: `apps/cli/src/components/App.tsx`

- [ ] **Step 1: Add `HotspotPanel` component**

Add after the `BusFactorPanel` function in `App.tsx`:

```typescript
function HotspotPanel({ report }: { report: GitloreReport }) {
  const { hotspots } = report;
  if (hotspots.files.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="red" bold>
        {'── Hotspots (churn × complexity) ───────────────────────────'}
      </Text>
      <Text color="gray" dimColor>{hotspots.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {hotspots.topHotspots.slice(0, 10).map(f => (
          <Box key={f.file} gap={2}>
            <Text color={getHotspotColor(f.category)}>{churnBar(f.hotspotScore)}</Text>
            <Text color="gray">{truncatePath(f.file, 45)}</Text>
            <Text color="gray" dimColor>{f.loc} LOC</Text>
            <Text color={getHotspotColor(f.category)}>{f.category}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Add `CouplingPanel` component**

Add after the `HotspotPanel` function:

```typescript
function CouplingPanel({ report }: { report: GitloreReport }) {
  const { coupling } = report;
  if (coupling.pairs.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="blue" bold>
        {`── File Coupling (${coupling.pairs.length} pairs) ────────────────────────────`}
      </Text>
      <Text color="gray" dimColor>{coupling.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {coupling.topPairs.slice(0, 10).map(p => (
          <Box key={`${p.fileA}-${p.fileB}`} gap={2}>
            <Text color="blue">{String(p.couplingStrength).padStart(3)}%</Text>
            <Text color="white">{truncatePath(p.fileA, 25)}</Text>
            <Text color="gray">↔</Text>
            <Text color="white">{truncatePath(p.fileB, 25)}</Text>
            <Text color="gray" dimColor>{p.coCommits} commits</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Add `getHotspotColor` helper**

Add to the helpers section at the bottom of `App.tsx`:

```typescript
function getHotspotColor(category: string): string {
  switch (category) {
    case 'critical': return 'red';
    case 'warning': return 'yellow';
    case 'moderate': return 'cyan';
    default: return 'gray';
  }
}
```

- [ ] **Step 4: Rename existing ChurnPanel header to avoid duplicate "Hotspots" labels**

In the `ChurnPanel` function, change the header from `"── Hotspots"` to `"── Churn"`:

```tsx
      <Text color="yellow" bold>── Churn ({churn.hotspotCount} hot files) ────────────────────────────</Text>
```

- [ ] **Step 5: Wire panels into the render output**

In the `App` component's return statement, add the new panels between `ChurnPanel` and `CursedFilesPanel`:

```tsx
      <ChurnPanel report={report} />
      <Newline />
      <HotspotPanel report={report} />
      <Newline />
      <CouplingPanel report={report} />
      <Newline />
      <CursedFilesPanel report={report} />
```

- [ ] **Step 6: Build CLI and verify**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm build`
Expected: Full monorepo build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/cli/src/components/App.tsx
git commit -m "feat(cli): add hotspot and coupling panels"
```

---

## Chunk 6: Web Dashboard

### Task 10: Update web dashboard with Hotspot and Coupling tabs

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx`

- [ ] **Step 1: Update the `Tab` type and tab list**

Change the Tab type and add coupling:

```typescript
type Tab = 'overview' | 'churn' | 'contributors' | 'cursed' | 'age' | 'coupling';
```

Add the coupling tab to the `tabs` array:

```typescript
    { id: 'coupling', label: 'Coupling', emoji: '🔗' },
```

- [ ] **Step 2: Add hotspot and coupling helper functions**

Add to the helpers section at the bottom of the file (before any components that use them):

```typescript
function hotspotDot(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-500';
    case 'warning': return 'bg-yellow-500';
    case 'moderate': return 'bg-cyan-500';
    default: return 'bg-gray-600';
  }
}

function hotspotBar(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-600';
    case 'warning': return 'bg-yellow-600';
    case 'moderate': return 'bg-cyan-700';
    default: return 'bg-gray-700';
  }
}

function hotspotBadge(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-950 text-red-400';
    case 'warning': return 'bg-yellow-950 text-yellow-400';
    case 'moderate': return 'bg-cyan-950 text-cyan-400';
    default: return 'bg-gray-800 text-gray-400';
  }
}
```

- [ ] **Step 3: Update the `ChurnTab` to show hotspot data**

Replace the `ChurnTab` function to show composite hotspot scores alongside churn:

```typescript
function ChurnTab({ report }: { report: GitloreReport }) {
  return (
    <div>
      <p className="text-gray-400 mb-4 text-sm">{report.hotspots.summary}</p>
      <div className="space-y-1">
        {report.hotspots.files.slice(0, 50).map(f => (
          <div key={f.file} className="flex items-center gap-3 py-1 hover:bg-gray-900 rounded px-2">
            <div className={`h-3 rounded ${hotspotBar(f.category)}`} style={{ width: `${f.hotspotScore * 2}px`, minWidth: '4px' }} />
            <span className="text-gray-300 text-sm font-mono flex-1">{f.file}</span>
            <span className="text-gray-500 text-xs">{f.loc} LOC</span>
            <span className="text-gray-500 text-xs">{f.churnScore} churn</span>
            <span className={`text-xs px-2 py-0.5 rounded ${hotspotBadge(f.category)}`}>{f.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `CouplingTab` component with per-file search**

```typescript
function CouplingTab({ report }: { report: GitloreReport }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (report.coupling.pairs.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔗</div>
        <p className="text-green-400 text-lg">No temporal coupling detected</p>
        <p className="text-gray-500 text-sm mt-2">Files change independently — clean architecture</p>
      </div>
    );
  }

  const selectedProfile = selectedFile
    ? report.coupling.fileProfiles.find(p => p.file === selectedFile)
    : null;

  return (
    <div>
      <p className="text-gray-400 mb-4 text-sm">{report.coupling.summary}</p>

      {/* Top coupled pairs */}
      <h3 className="text-white font-semibold mb-2">Strongest Pairs</h3>
      <div className="space-y-2 mb-6">
        {report.coupling.topPairs.map(p => (
          <div key={`${p.fileA}-${p.fileB}`} className="bg-gray-900 border border-gray-800 rounded p-3">
            <div className="flex items-center gap-3">
              <div className="h-3 rounded bg-blue-600" style={{ width: `${p.couplingStrength * 1.5}px`, minWidth: '4px' }} />
              <span className="text-blue-400 font-bold text-sm">{p.couplingStrength}%</span>
              <button onClick={() => setSelectedFile(p.fileA)} className="text-gray-300 text-sm font-mono truncate hover:text-blue-300">{p.fileA}</button>
              <span className="text-gray-500">↔</span>
              <button onClick={() => setSelectedFile(p.fileB)} className="text-gray-300 text-sm font-mono truncate hover:text-blue-300">{p.fileB}</button>
            </div>
            <div className="mt-1 flex gap-4 text-xs text-gray-500">
              <span>{p.coCommits} shared commits</span>
              <span>{p.fileA.split('/').pop()}: {p.totalCommitsA} total</span>
              <span>{p.fileB.split('/').pop()}: {p.totalCommitsB} total</span>
            </div>
          </div>
        ))}
      </div>

      {/* Per-file coupling profile */}
      <h3 className="text-white font-semibold mb-2">Per-File View</h3>
      <div className="flex gap-4">
        <div className="w-1/3 space-y-1 max-h-96 overflow-auto">
          {report.coupling.fileProfiles.map(p => (
            <button
              key={p.file}
              onClick={() => setSelectedFile(p.file)}
              className={`w-full text-left px-2 py-1 rounded text-sm font-mono truncate ${
                selectedFile === p.file ? 'bg-blue-900 text-blue-300' : 'text-gray-400 hover:bg-gray-900'
              }`}
            >
              {p.file}
              <span className="text-gray-500 ml-2">{p.partners.length}</span>
            </button>
          ))}
        </div>
        <div className="flex-1">
          {selectedProfile ? (
            <div className="bg-gray-900 border border-gray-800 rounded p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-white font-mono text-sm">{selectedProfile.file}</span>
                <span className="text-blue-400 text-sm">{selectedProfile.partners.length} partner{selectedProfile.partners.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {selectedProfile.partners.map(p => {
                  const partner = p.fileA === selectedProfile.file ? p.fileB : p.fileA;
                  return (
                    <div key={partner} className="flex items-center gap-3">
                      <span className="text-blue-400 text-sm w-12 text-right">{p.couplingStrength}%</span>
                      <div className="h-2 rounded bg-blue-600" style={{ width: `${p.couplingStrength}px` }} />
                      <button onClick={() => setSelectedFile(partner)} className="text-gray-300 text-sm font-mono truncate hover:text-blue-300">{partner}</button>
                      <span className="text-gray-500 text-xs">{p.coCommits} commits</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm p-4">Click a file to see its coupling partners</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add tab rendering in main content area**

Add to the content section:

```tsx
        {tab === 'coupling' && <CouplingTab report={report} />}
```

- [ ] **Step 6: Update the Overview tab's Top Hotspots card**

Replace the hotspots card in `OverviewTab` to use hotspot data instead of raw churn:

```typescript
      <Card title="🔥 Top Hotspots" subtitle={report.hotspots.summary}>
        {report.hotspots.topHotspots.slice(0, 8).map(f => (
          <div key={f.file} className="flex items-center gap-3 py-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hotspotDot(f.category)}`} />
            <span className="text-gray-300 text-sm font-mono truncate flex-1">{f.file}</span>
            <span className="text-gray-500 text-xs flex-shrink-0">{f.hotspotScore}</span>
          </div>
        ))}
      </Card>
```

- [ ] **Step 7: Build and verify**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm build`
Expected: Full monorepo build succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/Dashboard.tsx
git commit -m "feat(web): update hotspots tab and add coupling tab to dashboard"
```

---

## Chunk 7: Smoke Test

### Task 11: End-to-end smoke test

- [ ] **Step 1: Run all tests across the monorepo**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run GitLore against its own repo**

Run: `cd /Users/tracericochet/Desktop/dev/lore && node apps/cli/dist/index.js --path . --since all`

Expected: Output includes:
- The existing panels (churn, cursed files, contributors, bus factor)
- New **Hotspots** panel with score bars, LOC counts, and category badges
- New **File Coupling** panel with paired files, strength %, and commit counts

- [ ] **Step 3: Run with `--json` and verify new fields**

Run: `cd /Users/tracericochet/Desktop/dev/lore && node apps/cli/dist/index.js --path . --since all --json | head -c 2000`

Expected: JSON output includes `loc`, `hotspots`, and `coupling` top-level fields.

- [ ] **Step 4: Fix any issues found during smoke testing**

If anything fails, fix and re-run. Common issues:
- Import path `.js` extensions missing
- Type mismatches between runner return and `GitloreReport`

- [ ] **Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve issues found during smoke testing"
```
