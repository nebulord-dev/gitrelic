# Analysis Calibration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Gitlore's analysis meaningful across repos of all sizes and ages by adding an ignore list, tightening cursed file scoring, making time windows relative to repo age, and defaulting `--since` to 12 months.

**Architecture:** All four changes are in `packages/core` except for a small CLI default change. They're ordered by dependency: ignore list first (reduces noise for everything), then scoring, then relative windows, then `--since`. Each task modifies 1-2 files.

**Tech Stack:** TypeScript, pnpm monorepo, tsup build

---

### Task 1: Add ignore list to `getTrackedFiles()`

**Files:**
- Modify: `packages/core/src/utils/git.ts:67-70`

**Step 1: Add the ignore list constant**

Add above `getTrackedFiles`:

```typescript
const IGNORED_PATTERNS = {
  exact: new Set([
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
    'next-env.d.ts',
    'vite-env.d.ts',
  ]),
  extensions: new Set([
    '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg',
    '.woff', '.woff2', '.ttf', '.eot',
    '.min.js', '.min.css', '.map',
  ]),
  prefixes: [
    '.next/',
    'dist/',
    'coverage/',
  ],
};

function isIgnored(file: string): boolean {
  const basename = file.includes('/') ? file.split('/').pop()! : file;
  if (IGNORED_PATTERNS.exact.has(basename)) return true;
  for (const ext of IGNORED_PATTERNS.extensions) {
    if (file.endsWith(ext)) return true;
  }
  for (const prefix of IGNORED_PATTERNS.prefixes) {
    if (file.startsWith(prefix)) return true;
  }
  return false;
}
```

**Step 2: Filter in `getTrackedFiles`**

Change `getTrackedFiles` to:

```typescript
export async function getTrackedFiles(repoPath: string): Promise<string[]> {
  const { stdout } = await execa('git', ['ls-files'], { cwd: repoPath });
  return stdout.split('\n').filter(f => f && !isIgnored(f));
}
```

**Step 3: Build and verify**

Run: `pnpm --filter @lore/core build`
Expected: Clean build, no errors

**Step 4: Commit**

```bash
git add packages/core/src/utils/git.ts
git commit -m "feat: add built-in ignore list for lock files, assets, and generated files"
```

---

### Task 2: Tighten cursed file scoring

**Files:**
- Modify: `packages/core/src/analyzers/cursed-files.ts:30-61`

**Step 1: Update score contributions**

Replace the scoring block (lines 32-61) with:

```typescript
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

    if (curseScore < 50 || reasons.length === 0) continue;
```

**Step 2: Build and verify**

Run: `pnpm --filter @lore/core build`
Expected: Clean build

**Step 3: Commit**

```bash
git add packages/core/src/analyzers/cursed-files.ts
git commit -m "feat: tighten cursed file scoring — raise threshold to 50, reduce score contributions"
```

---

### Task 3: Make age map thresholds relative to repo age

**Files:**
- Modify: `packages/core/src/analyzers/age-map.ts:4,41-46`
- Modify: `packages/core/src/runner.ts:47`

**Step 1: Update `analyzeAgeMap` signature and thresholds**

Replace the full file with:

```typescript
import type { RawCommit } from '../utils/git.js';
import type { AgeMapReport, FileAge, AgeStatus } from '../types.js';

export function analyzeAgeMap(commits: RawCommit[], trackedFiles: string[], repoAgeDays: number): AgeMapReport {
  // Map: file → most recent commit date
  const fileLastCommit: Map<string, string> = new Map();
  const trackedSet = new Set(trackedFiles);

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;
      const existing = fileLastCommit.get(file);
      if (!existing || commit.date > existing) {
        fileLastCommit.set(file, commit.date);
      }
    }
  }

  const now = Date.now();

  const files: FileAge[] = Array.from(fileLastCommit.entries()).map(([file, lastCommitDate]) => {
    const ageInDays = Math.floor((now - new Date(lastCommitDate).getTime()) / 86_400_000);
    return { file, lastCommitDate, ageInDays, status: getAgeStatus(ageInDays, repoAgeDays) };
  }).sort((a, b) => b.ageInDays - a.ageInDays);

  const staleFiles = files.filter(f => f.status === 'stale');
  const ancientFiles = files.filter(f => f.status === 'ancient');

  const ages = files.map(f => f.ageInDays).sort((a, b) => a - b);
  const medianAgeDays = ages[Math.floor(ages.length / 2)] ?? 0;

  const summary = ancientFiles.length > 0
    ? `${ancientFiles.length} files haven't been touched in over ${Math.round(repoAgeDays * 0.66)} days — they may be dead weight or critical infrastructure nobody dares touch`
    : staleFiles.length > 0
    ? `${staleFiles.length} files are going stale (no commits in ${Math.round(repoAgeDays * 0.33)}+ days)`
    : 'The codebase is actively maintained across most files';

  return { files, staleFiles, ancientFiles, medianAgeDays, summary };
}

function getAgeStatus(ageInDays: number, repoAgeDays: number): AgeStatus {
  const freshLimit = Math.round(repoAgeDays * 0.08);
  const agingLimit = Math.round(repoAgeDays * 0.33);
  const staleLimit = Math.round(repoAgeDays * 0.66);

  if (ageInDays <= freshLimit) return 'fresh';
  if (ageInDays <= agingLimit) return 'aging';
  if (ageInDays <= staleLimit) return 'stale';
  return 'ancient';
}
```

**Step 2: Update runner call**

In `packages/core/src/runner.ts`, change line 47 from:

```typescript
  const ageMap = analyzeAgeMap(commits, trackedFiles);
```

to:

```typescript
  const ageMap = analyzeAgeMap(commits, trackedFiles, ageInDays);
```

**Step 3: Build and verify**

Run: `pnpm --filter @lore/core build`
Expected: Clean build

**Step 4: Commit**

```bash
git add packages/core/src/analyzers/age-map.ts packages/core/src/runner.ts
git commit -m "feat: make age map thresholds relative to repo age (percentage-based)"
```

---

### Task 4: Make contributor active/ghost thresholds relative to repo age

**Files:**
- Modify: `packages/core/src/analyzers/contributors.ts:4,26-28,56-57`
- Modify: `packages/core/src/runner.ts:50`

**Step 1: Update `analyzeContributors` signature and thresholds**

Change the function signature from:

```typescript
export function analyzeContributors(commits: RawCommit[]): ContributorReport {
```

to:

```typescript
export function analyzeContributors(commits: RawCommit[], repoAgeDays: number): ContributorReport {
```

Replace the hardcoded threshold lines (26-28):

```typescript
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 86_400_000;
  const sixMonthsAgo = now - 180 * 86_400_000;
```

with:

```typescript
  const now = Date.now();
  const activeWindow = Math.round(repoAgeDays * 0.25) * 86_400_000;
  const ghostWindow = Math.round(repoAgeDays * 0.50) * 86_400_000;
  const activeCutoff = now - activeWindow;
  const ghostCutoff = now - ghostWindow;
```

Update the active check (line 51) from:

```typescript
      isActive: new Date(lastCommit).getTime() > ninetyDaysAgo,
```

to:

```typescript
      isActive: new Date(lastCommit).getTime() > activeCutoff,
```

Update the ghost filter (lines 56-58) from:

```typescript
  const ghostContributors = contributors.filter(
    c => !c.isActive && new Date(c.lastCommit).getTime() < sixMonthsAgo
  );
```

to:

```typescript
  const ghostContributors = contributors.filter(
    c => !c.isActive && new Date(c.lastCommit).getTime() < ghostCutoff
  );
```

**Step 2: Update runner call**

In `packages/core/src/runner.ts`, change line 50 from:

```typescript
  const contributors = analyzeContributors(commits);
```

to:

```typescript
  const contributors = analyzeContributors(commits, ageInDays);
```

**Step 3: Build and verify**

Run: `pnpm --filter @lore/core build`
Expected: Clean build

**Step 4: Commit**

```bash
git add packages/core/src/analyzers/contributors.ts packages/core/src/runner.ts
git commit -m "feat: make contributor active/ghost windows relative to repo age (percentage-based)"
```

---

### Task 5: Default `--since` to 12 months with `all` opt-out

**Files:**
- Modify: `apps/cli/src/index.tsx:18,39,59`

**Step 1: Update the `--since` option default**

Change line 18 from:

```typescript
  .option('-s, --since <date>', 'Only analyze commits since this date (e.g. "6 months ago")')
```

to:

```typescript
  .option('-s, --since <date>', 'Only analyze commits since this date (default: "12 months ago", use "all" for full history)', '12 months ago')
```

**Step 2: Handle the `all` keyword**

After `const repoPath = path.resolve(opts.path);` (line 31), add:

```typescript
const since = opts.since === 'all' ? undefined : opts.since;
```

**Step 3: Use `since` instead of `opts.since` in both call sites**

Change line 39 from:

```typescript
      since: opts.since,
```

to:

```typescript
      since,
```

Change line 59 from:

```typescript
      since: opts.since,
```

to:

```typescript
      since,
```

**Step 4: Build and verify**

Run: `pnpm --filter @lore/cli build`
Expected: Clean build

**Step 5: Smoke test**

Run: `node apps/cli/dist/index.js --path /Users/danteel/Desktop/lore --json | head -20`
Expected: Valid JSON output with report data

Run: `node apps/cli/dist/index.js --path /Users/danteel/Desktop/lore --since all --json | head -20`
Expected: Valid JSON output (may have more commits if repo is older than 12 months)

**Step 6: Commit**

```bash
git add apps/cli/src/index.tsx
git commit -m "feat: default --since to 12 months ago, support --since all for full history"
```

---

### Task 6: Full build and integration smoke test

**Files:** None (validation only)

**Step 1: Full build**

Run: `pnpm build`
Expected: All packages build clean

**Step 2: Test against a real repo**

Run: `node apps/cli/dist/index.js --path /Users/danteel/Desktop/lore --json > /tmp/lore-test.json && cat /tmp/lore-test.json | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('Files:', r.meta.totalFiles, 'Cursed:', r.cursedFiles.length, 'Ghosts:', r.contributors.ghostContributors.length)"`

Expected: Significantly fewer cursed files than before, appropriate ghost count for repo age

**Step 3: Test with --web if desired**

Run: `node apps/cli/dist/index.js --path /Users/danteel/Desktop/lore --web`
Expected: Dashboard opens, all tabs display data correctly

---

## Validation Commands

```bash
# Level 1: Package builds
pnpm --filter @lore/core build
pnpm --filter @lore/cli build

# Level 2: Full build
pnpm build

# Level 3: Smoke tests
node apps/cli/dist/index.js --path . --json | head -5
node apps/cli/dist/index.js --path . --since all --json | head -5

# Level 4: Manual verification
node apps/cli/dist/index.js --path .
```
