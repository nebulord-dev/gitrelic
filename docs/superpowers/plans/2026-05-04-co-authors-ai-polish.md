# Co-Authors / AI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the Co-Author analyzer from "who pairs with whom?" to "how is AI assistance and human collaboration showing up in this codebase?" Replace single hero with 3-tab hero structure (`AI Adoption` trend / `Per-Author AI Mix` / polished `Co-Author Graph`), replace pair-table bottom panel with 2-tab structure (narrative-KPI / classified table), introduce shared `authorClassification` utility, retune metrics strip with informational (not risk) coloring, and ship the docs page.

**Architecture:** Backend-first. New `packages/core/src/utils/authorClassification.ts` provides AI/bot/human classification used by the rewritten `co-author.ts` analyzer. Analyzer emits new aggregates (`aiAssistedCommits`, `humanAuthoredCommits`, `aiAdoptionPercent`, `aiAdoptionTier`, `byMonth`, `perAuthorMix`, `aiAuthors`, `humanPairs`, `filteredBotCommits`) consumed by three new web heroes, two new bottom-panel tabs, and a retuned metrics composer. Force graph stays, polished. Pure-git constitution preserved.

**Tech Stack:** TypeScript 6, Vitest, React 19, D3 (existing for force graph), Tailwind v4, tsdown (core/cli), Vite (web). Test fixtures already updated for `RawCommit.coAuthors` field (working tree).

**Spec:** [`docs/superpowers/specs/2026-05-04-co-authors-ai-polish-design.md`](../specs/2026-05-04-co-authors-ai-polish-design.md) — read this first if you haven't. The spec is the source of truth; this plan is the actionable bite-sized version.

**Linear:** [RELIC-320](https://linear.app/nebulord/issue/RELIC-320)

---

## Task 1: Commit the data-layer fix as the PR's foundation

**Files:**
- Modify (already in working tree): `packages/core/src/utils/git.ts`
- Modify (already in working tree): `packages/core/src/utils/git.test.ts`
- Modify (already in working tree): `packages/core/src/analyzers/co-author.ts`
- Modify (already in working tree): `packages/core/src/analyzers/co-author.test.ts`
- Modify (already in working tree): 14 other analyzer test files (only the `coAuthors: []` factory addition)

**Context:** The data layer fix is already implemented in the working tree from the brainstorming session. It captures `Co-authored-by:` trailers via git's native trailer parser (commit bodies were dropped because `--format=...%s` only includes the subject, not body). Without this, the polish work has nothing to display. This task lands it as a separate commit so git history reads cleanly.

- [ ] **Step 1: Verify the working tree contents**

Run: `git status`
Expected: changes to the files listed above; tree is otherwise clean.

- [ ] **Step 2: Run all tests to confirm they pass**

Run: `pnpm test`
Expected: 312 core tests pass, 716 web tests pass.

- [ ] **Step 3: Stage the data-layer fix files**

```bash
git add packages/core/src/utils/git.ts \
        packages/core/src/utils/git.test.ts \
        packages/core/src/analyzers/co-author.ts \
        packages/core/src/analyzers/co-author.test.ts \
        packages/core/src/analyzers/age-map.test.ts \
        packages/core/src/analyzers/blast-radius.test.ts \
        packages/core/src/analyzers/bus-factor.test.ts \
        packages/core/src/analyzers/churn.test.ts \
        packages/core/src/analyzers/churn-velocity.test.ts \
        packages/core/src/analyzers/commit-timing.test.ts \
        packages/core/src/analyzers/complexity-trend.test.ts \
        packages/core/src/analyzers/contributors.test.ts \
        packages/core/src/analyzers/coupling.test.ts \
        packages/core/src/analyzers/dead-code.test.ts \
        packages/core/src/analyzers/forensics.test.ts \
        packages/core/src/analyzers/hotspot-clustering.test.ts \
        packages/core/src/analyzers/parallel-dev.test.ts \
        packages/core/src/analyzers/rewrite-ratio.test.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(core): capture Co-authored-by trailers from commit bodies

The co-author analyzer was empty on every repo because getAllCommits
was using --format=%s (subject only). Co-Authored-By trailers live in
commit bodies. Switch to git's native trailer parser via
%(trailers:key=Co-authored-by,valueonly,separator=%x1F) on a new
TRAILERS|... line; parse it into RawCommit.coAuthors. Analyzer now
consumes the typed field directly instead of regexing the message.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Author classification utility (AI / bot / human)

**Files:**
- Create: `packages/core/src/utils/authorClassification.ts`
- Test: `packages/core/src/utils/authorClassification.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/utils/authorClassification.test.ts
import { describe, it, expect } from 'vitest';

import {
  classifyAuthor,
  isAiEmail,
  isBotEmail,
  aiProductName,
} from './authorClassification.js';

describe('authorClassification', () => {
  describe('AI emails', () => {
    it.each([
      ['noreply@anthropic.com', 'Claude'],
      ['copilot[bot]@users.noreply.github.com', 'GitHub Copilot'],
      ['copilot@users.noreply.github.com', 'GitHub Copilot'],
      ['aider@aider.chat', 'Aider'],
      ['devin-ai-integration[bot]@users.noreply.github.com', 'Devin'],
      ['agent@cursor.sh', 'Cursor'],
    ])('classifies %s as AI with productName=%s', (email, productName) => {
      expect(classifyAuthor(email)).toBe('ai');
      expect(isAiEmail(email)).toBe(true);
      expect(aiProductName(email)).toBe(productName);
    });

    it('classifies generic *ai*[bot]@... as AI without product name', () => {
      const email = 'futureai[bot]@users.noreply.github.com';
      expect(classifyAuthor(email)).toBe('ai');
      expect(aiProductName(email)).toBeNull();
    });

    it('AI patterns evaluate before bot patterns (specificity wins)', () => {
      const email = 'dependabot-ai[bot]@users.noreply.github.com';
      expect(classifyAuthor(email)).toBe('ai');
    });
  });

  describe('bot emails', () => {
    it.each([
      'dependabot[bot]@users.noreply.github.com',
      'renovate[bot]@users.noreply.github.com',
      'semantic-release-bot@martynus.net',
      'github-actions[bot]@users.noreply.github.com',
    ])('classifies %s as bot', (email) => {
      expect(classifyAuthor(email)).toBe('bot');
      expect(isBotEmail(email)).toBe(true);
      expect(aiProductName(email)).toBeNull();
    });
  });

  describe('human emails', () => {
    it.each([
      'alice@example.com',
      'bob@protonmail.com',
      'sebastian.silbermann@vercel.com',
    ])('classifies %s as human', (email) => {
      expect(classifyAuthor(email)).toBe('human');
      expect(isAiEmail(email)).toBe(false);
      expect(isBotEmail(email)).toBe(false);
      expect(aiProductName(email)).toBeNull();
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase emails for AI patterns', () => {
      expect(classifyAuthor('NOREPLY@ANTHROPIC.COM')).toBe('ai');
      expect(aiProductName('NOREPLY@ANTHROPIC.COM')).toBe('Claude');
    });
  });
});
```

- [ ] **Step 2: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/core test --run authorClassification`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility**

```ts
// packages/core/src/utils/authorClassification.ts
export type AuthorClass = 'human' | 'ai' | 'bot';

interface Pattern {
  match: RegExp;
  productName?: string;
}

const AI_PATTERNS: Pattern[] = [
  { match: /^noreply@anthropic\.com$/i, productName: 'Claude' },
  {
    match: /^copilot(\[bot\])?@.*\.noreply\.github\.com$/i,
    productName: 'GitHub Copilot',
  },
  { match: /^aider@aider\.chat$/i, productName: 'Aider' },
  {
    match: /^devin-ai-integration\[bot\]@.*\.noreply\.github\.com$/i,
    productName: 'Devin',
  },
  { match: /@cursor\.sh$/i, productName: 'Cursor' },
  // Generic fallback: any *ai*[bot] account on GitHub's noreply domain
  { match: /^[^@]*ai[^@]*\[bot\]@.*\.noreply\.github\.com$/i },
];

const BOT_PATTERNS: Pattern[] = [
  { match: /^dependabot/i },
  { match: /^renovate/i },
  { match: /^semantic-release/i },
  // Catch-all: any [bot] account on GitHub's noreply domain that survived AI patterns
  { match: /\[bot\]@.*\.noreply\.github\.com$/i },
  // Catch-all: standalone bot accounts (github-actions, etc.)
  { match: /^github-actions\[bot\]@/i },
];

export function classifyAuthor(email: string): AuthorClass {
  if (isAiEmail(email)) return 'ai';
  if (isBotEmail(email)) return 'bot';
  return 'human';
}

export function isAiEmail(email: string): boolean {
  return AI_PATTERNS.some((p) => p.match.test(email));
}

export function isBotEmail(email: string): boolean {
  return BOT_PATTERNS.some((p) => p.match.test(email));
}

export function aiProductName(email: string): string | null {
  for (const pattern of AI_PATTERNS) {
    if (pattern.match.test(email)) return pattern.productName ?? null;
  }
  return null;
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/core test --run authorClassification`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/authorClassification.ts \
        packages/core/src/utils/authorClassification.test.ts
git commit -m "$(cat <<'EOF'
feat(core): add author classification utility for AI/bot/human emails

Pure functions that classify a git author email as AI, bot, or human
based on email patterns. Recognized AI tools: Claude, GitHub Copilot,
Aider, Devin, Cursor, plus a generic *ai*[bot]@... fallback. Recognized
bots: dependabot, renovate, semantic-release, github-actions, plus a
catch-all for [bot]@users.noreply.github.com.

Lives in packages/core/src/utils/ so any analyzer (co-author next, plus
contributors later) can adopt it without depending on a specific
analyzer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Type additions to `CoAuthorReport`

**Files:**
- Modify: `packages/core/src/types.ts`

**Context:** Types-only change. No tests for type definitions; the analyzer test in Task 4 covers shape conformance.

- [ ] **Step 1: Add new types to `packages/core/src/types.ts`**

Find the existing `// ─── Co-author analysis ──...` section. Replace the whole block with:

```ts
// ─── Co-author analysis ─────────────────────────────────────────────────────

export type AdoptionTier = 'none' | 'low' | 'moderate' | 'high';

export interface CoAuthorPair {
  authorA: string;
  authorB: string;
  coAuthoredCommits: number;
  files: string[];
  classification: 'human-pair' | 'human-ai';
}

export interface CoAuthorStats {
  author: string;
  coAuthoredCommits: number; // commits where this author was a co-author
  primaryPartner: string | null;
}

export interface AiAuthorStat {
  author: string; // email (lowercased)
  displayName: string;
  aiCommits: number; // commits authored by this human with AI co-author
  totalCommits: number; // all commits authored by this human in window
  personalRatio: number; // 0–100, aiCommits / totalCommits
}

export interface PerAuthorMixEntry {
  author: string;
  displayName: string;
  aiCommits: number;
  soloCommits: number;
  totalCommits: number;
  personalRatio: number; // 0–100
}

export interface CoAuthorMonthEntry {
  month: string; // ISO `YYYY-MM`
  aiAssisted: number;
  pureHuman: number;
  total: number;
}

export interface CoAuthorReport {
  pairs: CoAuthorPair[]; // human-pair + human-ai (no bot-involved)
  authorStats: CoAuthorStats[];
  totalCoAuthoredCommits: number;
  summary: string;

  aiAssistedCommits: number;
  humanAuthoredCommits: number; // denominator for B%
  aiAdoptionPercent: number; // 0–100 (B-formula)
  aiAdoptionTier: AdoptionTier;
  aiAuthors: AiAuthorStat[]; // sorted desc by aiCommits, includes humans with personalRatio > 0 only
  humanPairs: CoAuthorPair[]; // strict subset of pairs filtered to human-pair only
  filteredBotCommits: number; // for the panel footnote
  byMonth: CoAuthorMonthEntry[];
  perAuthorMix: PerAuthorMixEntry[];
}
```

- [ ] **Step 2: Run a type-check**

Run: `pnpm --filter @gitrelic/core build`
Expected: Compiles successfully. (The analyzer code in `co-author.ts` may not yet emit the new fields — TypeScript may flag missing returns from `analyzeCoAuthors`. That's expected; Task 4 fixes it.)

If the build fails ONLY because `analyzeCoAuthors` is missing the new fields in its return value: that's the expected state. Continue to Task 4. Do not commit yet — Task 4 will cover this commit alongside the analyzer rewrite.

If the build fails for any OTHER reason: investigate before continuing.

- [ ] **Step 3: Do NOT commit yet**

Types and analyzer changes commit together in Task 4.

---

## Task 4: Co-author analyzer rewrite

**Files:**
- Modify: `packages/core/src/analyzers/co-author.ts`
- Modify: `packages/core/src/analyzers/co-author.test.ts`
- Regenerate: `packages/core/src/__snapshots__/fixture-regression.test.ts.snap`

- [ ] **Step 1: Rewrite the test file with new cases**

Replace `packages/core/src/analyzers/co-author.test.ts` entirely:

```ts
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
      expect(allEmails).not.toContain('dependabot[bot]@users.noreply.github.com');
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
      const alice = result.perAuthorMix.find((m) => m.author === 'alice@co.com');
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
      const alice = result.perAuthorMix.find((m) => m.author === 'alice@co.com');
      expect(alice!.aiCommits).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run the new tests (expect failures)**

Run: `pnpm --filter @gitrelic/core test --run co-author`
Expected: FAIL — many cases (analyzer doesn't return new fields yet).

- [ ] **Step 3: Rewrite the analyzer**

Replace `packages/core/src/analyzers/co-author.ts` entirely:

```ts
import type {
  AdoptionTier,
  AiAuthorStat,
  CoAuthorMonthEntry,
  CoAuthorPair,
  CoAuthorReport,
  CoAuthorStats,
  PerAuthorMixEntry,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';
import {
  classifyAuthor,
  isAiEmail,
  isBotEmail,
} from '../utils/authorClassification.js';

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

function adoptionTier(percent: number): AdoptionTier {
  if (percent === 0) return 'none';
  if (percent < 20) return 'low';
  if (percent < 50) return 'moderate';
  return 'high';
}

interface PairAccum {
  authorA: string;
  authorB: string;
  commits: number;
  files: Set<string>;
  classification: 'human-pair' | 'human-ai';
}

interface AuthorAccum {
  author: string;
  displayName: string;
  aiCommits: number;
  soloCommits: number;
  totalCommits: number;
}

export function analyzeCoAuthors(commits: RawCommit[]): CoAuthorReport {
  const pairMap = new Map<string, PairAccum>();
  const authorCoAuthorCount = new Map<string, number>();
  const authorAccum = new Map<string, AuthorAccum>();
  const monthMap = new Map<string, CoAuthorMonthEntry>();

  let totalCoAuthoredCommits = 0;
  let aiAssistedCommits = 0;
  let humanAuthoredCommits = 0;
  let filteredBotCommits = 0;

  for (const commit of commits) {
    const primaryEmailLower = commit.authorEmail.toLowerCase();

    // Bot-authored commits are stripped from analysis entirely; only the count is reported.
    if (isBotEmail(primaryEmailLower)) {
      filteredBotCommits++;
      continue;
    }

    // AI-as-primary-author (rare — Devin etc.) is excluded from the human denominator.
    // It still counts toward totalCoAuthoredCommits if it has co-authors, but doesn't anchor
    // a "human used AI" relationship.
    const primaryIsAi = isAiEmail(primaryEmailLower);

    if (!primaryIsAi) {
      humanAuthoredCommits++;
    }

    const coAuthorEmails = commit.coAuthors.map((c) => c.email.toLowerCase());
    const hasAiCoAuthor = coAuthorEmails.some(isAiEmail);

    // Author-mix accumulation (humans only).
    if (!primaryIsAi) {
      const accum = authorAccum.get(primaryEmailLower) ?? {
        author: primaryEmailLower,
        displayName: commit.authorName || primaryEmailLower,
        aiCommits: 0,
        soloCommits: 0,
        totalCommits: 0,
      };
      accum.totalCommits++;
      if (hasAiCoAuthor) accum.aiCommits++;
      else accum.soloCommits++;
      // Prefer the first non-empty name we see; never overwrite with empty.
      if (!accum.displayName && commit.authorName) {
        accum.displayName = commit.authorName;
      }
      authorAccum.set(primaryEmailLower, accum);
    }

    if (!primaryIsAi && hasAiCoAuthor) {
      aiAssistedCommits++;
    }

    // Trailer-bearing commits — the rest of the analysis only fires when there are co-authors.
    if (commit.coAuthors.length === 0) continue;

    // Drop bot co-authors from the participant set (they're noise).
    const filteredCoAuthors = coAuthorEmails.filter((e) => !isBotEmail(e));
    if (filteredCoAuthors.length === 0) continue;

    totalCoAuthoredCommits++;

    // Monthly bucket — `aiAssisted` counts ONLY commits that are actually AI-assisted.
    // (Pure-human pair commits land in `pureHuman`.)
    const month = commit.date.slice(0, 7); // ISO `YYYY-MM`
    const monthEntry = monthMap.get(month) ?? {
      month,
      aiAssisted: 0,
      pureHuman: 0,
      total: 0,
    };
    if (!primaryIsAi && hasAiCoAuthor) {
      monthEntry.aiAssisted++;
    } else if (!primaryIsAi) {
      monthEntry.pureHuman++;
    }
    monthEntry.total = monthEntry.aiAssisted + monthEntry.pureHuman;
    monthMap.set(month, monthEntry);

    // Pair-graph accumulation.
    const allParticipants = primaryIsAi
      ? filteredCoAuthors
      : [primaryEmailLower, ...filteredCoAuthors];
    const uniqueParticipants = [...new Set(allParticipants)];

    for (let i = 0; i < uniqueParticipants.length; i++) {
      for (let j = i + 1; j < uniqueParticipants.length; j++) {
        const a = uniqueParticipants[i];
        const b = uniqueParticipants[j];
        const key = pairKey(a, b);

        // Pair classification: human-ai if either endpoint is AI; else human-pair.
        // Bot-involved is impossible here — bots already filtered.
        const classification: 'human-pair' | 'human-ai' =
          isAiEmail(a) || isAiEmail(b) ? 'human-ai' : 'human-pair';

        if (!pairMap.has(key)) {
          pairMap.set(key, {
            authorA: a < b ? a : b,
            authorB: a < b ? b : a,
            commits: 0,
            files: new Set(),
            classification,
          });
        }
        const pair = pairMap.get(key)!;
        pair.commits++;
        for (const file of commit.files) pair.files.add(file);
      }
    }

    // Co-author-appearance count (legacy `authorStats` field).
    for (const coAuthor of filteredCoAuthors) {
      authorCoAuthorCount.set(
        coAuthor,
        (authorCoAuthorCount.get(coAuthor) ?? 0) + 1,
      );
    }
  }

  const pairs: CoAuthorPair[] = [...pairMap.values()]
    .map((p) => ({
      authorA: p.authorA,
      authorB: p.authorB,
      coAuthoredCommits: p.commits,
      files: [...p.files],
      classification: p.classification,
    }))
    .sort((a, b) => b.coAuthoredCommits - a.coAuthoredCommits);

  const humanPairs = pairs.filter((p) => p.classification === 'human-pair');

  // Per-author primary-partner stats (legacy authorStats).
  const authorPairCounts = new Map<
    string,
    { total: number; partners: Map<string, number> }
  >();
  for (const pair of pairs) {
    for (const author of [pair.authorA, pair.authorB]) {
      const entry =
        authorPairCounts.get(author) ?? { total: 0, partners: new Map() };
      entry.total += pair.coAuthoredCommits;
      const partner = author === pair.authorA ? pair.authorB : pair.authorA;
      entry.partners.set(
        partner,
        (entry.partners.get(partner) ?? 0) + pair.coAuthoredCommits,
      );
      authorPairCounts.set(author, entry);
    }
  }

  const authorStats: CoAuthorStats[] = [...authorCoAuthorCount.entries()]
    .map(([author, coAuthoredCommits]) => {
      const pairData = authorPairCounts.get(author);
      let primaryPartner: string | null = null;
      if (pairData) {
        let maxCount = 0;
        for (const [partner, count] of pairData.partners) {
          if (count > maxCount) {
            maxCount = count;
            primaryPartner = partner;
          }
        }
      }
      return { author, coAuthoredCommits, primaryPartner };
    })
    .sort((a, b) => b.coAuthoredCommits - a.coAuthoredCommits);

  // Per-author mix (all human authors, sorted desc by personalRatio).
  const perAuthorMix: PerAuthorMixEntry[] = [...authorAccum.values()]
    .map((a) => ({
      author: a.author,
      displayName: a.displayName,
      aiCommits: a.aiCommits,
      soloCommits: a.soloCommits,
      totalCommits: a.totalCommits,
      personalRatio:
        a.totalCommits > 0 ? Math.round((a.aiCommits / a.totalCommits) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.personalRatio !== a.personalRatio)
        return b.personalRatio - a.personalRatio;
      if (b.totalCommits !== a.totalCommits) return b.totalCommits - a.totalCommits;
      return a.author.localeCompare(b.author);
    });

  // aiAuthors: humans with personalRatio > 0, sorted desc by aiCommits.
  const aiAuthors: AiAuthorStat[] = perAuthorMix
    .filter((m) => m.personalRatio > 0)
    .map((m) => ({
      author: m.author,
      displayName: m.displayName,
      aiCommits: m.aiCommits,
      totalCommits: m.totalCommits,
      personalRatio: m.personalRatio,
    }))
    .sort((a, b) => {
      if (b.aiCommits !== a.aiCommits) return b.aiCommits - a.aiCommits;
      if (b.personalRatio !== a.personalRatio)
        return b.personalRatio - a.personalRatio;
      return a.author.localeCompare(b.author);
    });

  const aiAdoptionPercent =
    humanAuthoredCommits > 0
      ? Math.round((aiAssistedCommits / humanAuthoredCommits) * 100)
      : 0;
  const aiAdoptionTierValue = adoptionTier(aiAdoptionPercent);

  const byMonth: CoAuthorMonthEntry[] = [...monthMap.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  const summary =
    aiAssistedCommits > 0
      ? `${aiAdoptionPercent}% of human work used AI assistance (${aiAssistedCommits} of ${humanAuthoredCommits} commits)`
      : totalCoAuthoredCommits > 0
        ? `${totalCoAuthoredCommits} co-authored commit${totalCoAuthoredCommits !== 1 ? 's' : ''} across ${humanPairs.length} human pair${humanPairs.length !== 1 ? 's' : ''} — no AI assistance`
        : 'No co-authored commits found';

  return {
    pairs,
    authorStats,
    totalCoAuthoredCommits,
    summary,
    aiAssistedCommits,
    humanAuthoredCommits,
    aiAdoptionPercent,
    aiAdoptionTier: aiAdoptionTierValue,
    aiAuthors,
    humanPairs,
    filteredBotCommits,
    byMonth,
    perAuthorMix,
  };
}
```

- [ ] **Step 4: Run the analyzer tests (expect pass)**

Run: `pnpm --filter @gitrelic/core test --run co-author`
Expected: PASS — all cases.

- [ ] **Step 4.5: Re-export new types and util from `packages/core/src/index.ts`**

Add the following exports so the web app can import them:

```ts
// Add to existing `export type {...} from './types.js'` block:
//   AdoptionTier,
//   AiAuthorStat,
//   PerAuthorMixEntry,
//   CoAuthorMonthEntry,
//
// Add to existing `export type { FileStats, RawCommit } from './utils/git.js'`:
//   CoAuthor (extend the line)
//
// Add NEW export line for the classification util:
export {
  classifyAuthor,
  isAiEmail,
  isBotEmail,
  aiProductName,
} from './utils/authorClassification.js';
export type { AuthorClass } from './utils/authorClassification.js';
```

Concretely, the relevant lines in `index.ts` should now read:

```ts
export type { CoAuthor, FileStats, RawCommit } from './utils/git.js';
export {
  classifyAuthor,
  isAiEmail,
  isBotEmail,
  aiProductName,
} from './utils/authorClassification.js';
export type { AuthorClass } from './utils/authorClassification.js';
```

And inside the existing `export type { ... } from './types.js'` block, add `AdoptionTier`, `AiAuthorStat`, `PerAuthorMixEntry`, `CoAuthorMonthEntry` to the listed type names.

- [ ] **Step 5: Run all core tests + regenerate fixture-regression snapshot**

Run: `pnpm --filter @gitrelic/core test --run -u`
Expected: All tests pass; `fixture-regression.test.ts.snap` regenerates with the new `CoAuthorReport` fields populated as defaults (sample fixture has no trailers).

Verify the snapshot diff is **pure-addition** in the co-author slice — no other analyzer changes.

```bash
git diff packages/core/src/__snapshots__/fixture-regression.test.ts.snap
```

Look for: `CoAuthorReport` slice gains `aiAssistedCommits: 0`, `humanAuthoredCommits: <N>`, `aiAdoptionPercent: 0`, `aiAdoptionTier: 'none'`, `aiAuthors: []`, `humanPairs: []`, `filteredBotCommits: 0`, `byMonth: []`, `perAuthorMix: <populated>`. The `pairs[]` field becomes empty (no trailers in the fixture). No changes outside the co-author slice.

If you see changes outside the co-author slice: investigate before committing — that's a regression.

- [ ] **Step 6: Run `pnpm build` to confirm everything compiles**

Run: `pnpm build`
Expected: Core, web, and CLI all build successfully.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts \
        packages/core/src/index.ts \
        packages/core/src/analyzers/co-author.ts \
        packages/core/src/analyzers/co-author.test.ts \
        packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "$(cat <<'EOF'
feat(core): co-author analyzer reframed around AI adoption + human pairs

Adds aiAssistedCommits, humanAuthoredCommits, aiAdoptionPercent,
aiAdoptionTier, byMonth, perAuthorMix, aiAuthors, humanPairs, and
filteredBotCommits aggregates to CoAuthorReport. Bot-authored commits
(dependabot, renovate, semantic-release, github-actions) are stripped
from analysis; their count is reported separately for transparency.
AI co-authors (Claude, Copilot, Aider, Devin, Cursor) are classified
via the authorClassification utility; pair classification distinguishes
human-pair from human-ai. AI-as-primary-author commits (Devin) are
excluded from the human denominator.

Adoption tier thresholds: 0% none / <20% low / <50% moderate / 50%+
high. Informational, not risk-shaped.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: NormalizeReport defaults for new fields

**Files:**
- Modify: `apps/web/src/utils/normalizeReport.ts`
- Modify: `apps/web/src/utils/normalizeReport.test.ts`

**Context:** Old report JSONs (cached on disk by users) won't have the new `CoAuthorReport` fields. The web app crashes if accessed `undefined`. `normalizeReport` provides per-field defaults so old reports load cleanly.

- [ ] **Step 1: Read the existing co-authors slice in `normalizeReport.ts`**

Run: `grep -n "coAuthors" apps/web/src/utils/normalizeReport.ts`

Find the existing `coAuthors:` block. Note its current shape so you can extend it.

- [ ] **Step 2: Write the failing test**

Add to `apps/web/src/utils/normalizeReport.test.ts`:

```ts
it('fills new co-author analyzer defaults when missing', () => {
  const partial = {
    coAuthors: {
      pairs: [],
      authorStats: [],
      totalCoAuthoredCommits: 0,
      summary: '',
      // intentionally missing all NEW fields
    },
  } as unknown as GitrelicReport;

  const normalized = normalizeReport(partial);
  expect(normalized.coAuthors.aiAssistedCommits).toBe(0);
  expect(normalized.coAuthors.humanAuthoredCommits).toBe(0);
  expect(normalized.coAuthors.aiAdoptionPercent).toBe(0);
  expect(normalized.coAuthors.aiAdoptionTier).toBe('none');
  expect(normalized.coAuthors.aiAuthors).toEqual([]);
  expect(normalized.coAuthors.humanPairs).toEqual([]);
  expect(normalized.coAuthors.filteredBotCommits).toBe(0);
  expect(normalized.coAuthors.byMonth).toEqual([]);
  expect(normalized.coAuthors.perAuthorMix).toEqual([]);
});
```

- [ ] **Step 3: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run normalizeReport`
Expected: FAIL — fields missing.

- [ ] **Step 4: Update `normalizeReport.ts`**

Find the `coAuthors:` slice, replace with per-field merge that adds the new defaults:

```ts
coAuthors: {
  pairs: report.coAuthors?.pairs ?? [],
  authorStats: report.coAuthors?.authorStats ?? [],
  totalCoAuthoredCommits: report.coAuthors?.totalCoAuthoredCommits ?? 0,
  summary: report.coAuthors?.summary ?? '',
  aiAssistedCommits: report.coAuthors?.aiAssistedCommits ?? 0,
  humanAuthoredCommits: report.coAuthors?.humanAuthoredCommits ?? 0,
  aiAdoptionPercent: report.coAuthors?.aiAdoptionPercent ?? 0,
  aiAdoptionTier: report.coAuthors?.aiAdoptionTier ?? 'none',
  aiAuthors: report.coAuthors?.aiAuthors ?? [],
  humanPairs: report.coAuthors?.humanPairs ?? [],
  filteredBotCommits: report.coAuthors?.filteredBotCommits ?? 0,
  byMonth: report.coAuthors?.byMonth ?? [],
  perAuthorMix: report.coAuthors?.perAuthorMix ?? [],
},
```

- [ ] **Step 5: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run normalizeReport`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/utils/normalizeReport.ts \
        apps/web/src/utils/normalizeReport.test.ts
git commit -m "$(cat <<'EOF'
chore(web): normalize old reports with new co-author fields

Adds per-field defaults for the new CoAuthorReport fields so older
report JSONs load cleanly without runtime errors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `topAiUsers` frontend util

**Files:**
- Create: `apps/web/src/utils/topAiUsers.ts`
- Test: `apps/web/src/utils/topAiUsers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/utils/topAiUsers.test.ts
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
      makeAi({ author: 'alice@co.com', displayName: 'alice@co.com', aiCommits: 5 }),
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
```

- [ ] **Step 2: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run topAiUsers`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the util**

```ts
// apps/web/src/utils/topAiUsers.ts
import type { AiAuthorStat, Contributor } from '@gitrelic/core';

function resolveDisplayName(email: string, contributors: Contributor[]): string {
  const match = contributors.find(
    (c) => c.email.toLowerCase() === email.toLowerCase(),
  );
  if (match && match.name) return match.name;
  return email;
}

export function topAiUsers(
  aiAuthors: AiAuthorStat[],
  contributors: Contributor[],
  n: number,
): AiAuthorStat[] {
  return aiAuthors.slice(0, n).map((a) => ({
    ...a,
    displayName: resolveDisplayName(a.author, contributors),
  }));
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run topAiUsers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/topAiUsers.ts \
        apps/web/src/utils/topAiUsers.test.ts
git commit -m "$(cat <<'EOF'
feat(web): topAiUsers util for narrative-KPI top-3 finding

Slices top-N from the analyzer's pre-sorted aiAuthors list and resolves
display names via the contributors map (email fallback when name empty).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `aiAdoptionByMonth` frontend util

**Files:**
- Create: `apps/web/src/utils/aiAdoptionByMonth.ts`
- Test: `apps/web/src/utils/aiAdoptionByMonth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/utils/aiAdoptionByMonth.test.ts
import { describe, it, expect } from 'vitest';

import { aiAdoptionByMonth } from './aiAdoptionByMonth';
import type { CoAuthorMonthEntry } from '@gitrelic/core';

describe('aiAdoptionByMonth', () => {
  it('passes through a populated byMonth array', () => {
    const input: CoAuthorMonthEntry[] = [
      { month: '2026-01', aiAssisted: 5, pureHuman: 3, total: 8 },
      { month: '2026-02', aiAssisted: 7, pureHuman: 2, total: 9 },
    ];
    expect(aiAdoptionByMonth(input)).toEqual(input);
  });

  it('returns empty array for empty input', () => {
    expect(aiAdoptionByMonth([])).toEqual([]);
  });

  it('preserves chronological ordering', () => {
    const input: CoAuthorMonthEntry[] = [
      { month: '2026-01', aiAssisted: 0, pureHuman: 1, total: 1 },
      { month: '2026-03', aiAssisted: 1, pureHuman: 0, total: 1 },
    ];
    expect(aiAdoptionByMonth(input).map((m) => m.month)).toEqual([
      '2026-01',
      '2026-03',
    ]);
  });
});
```

- [ ] **Step 2: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run aiAdoptionByMonth`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the util**

```ts
// apps/web/src/utils/aiAdoptionByMonth.ts
import type { CoAuthorMonthEntry } from '@gitrelic/core';

/**
 * Passthrough/normalizer for the trend hero. Currently a no-op shape adapter,
 * but lives in apps/web/src/utils/ so future presentation tweaks (e.g.,
 * gap-filling missing months) land here without touching the analyzer.
 */
export function aiAdoptionByMonth(
  byMonth: CoAuthorMonthEntry[],
): CoAuthorMonthEntry[] {
  return [...byMonth];
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run aiAdoptionByMonth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/aiAdoptionByMonth.ts \
        apps/web/src/utils/aiAdoptionByMonth.test.ts
git commit -m "$(cat <<'EOF'
feat(web): aiAdoptionByMonth util for the trend hero

Thin passthrough today; gives the hero a stable seam if presentation
tweaks (e.g. gap-filling) need adding later without touching core.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `perAuthorAiMix` frontend util (with cap rule)

**Files:**
- Create: `apps/web/src/utils/perAuthorAiMix.ts`
- Test: `apps/web/src/utils/perAuthorAiMix.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/utils/perAuthorAiMix.test.ts
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
```

- [ ] **Step 2: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run perAuthorAiMix`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the util**

```ts
// apps/web/src/utils/perAuthorAiMix.ts
import type { PerAuthorMixEntry } from '@gitrelic/core';

const TOP_BY_TOTAL = 20;
const HARD_CAP = 30;

/**
 * Selection rule: top-20 humans by totalCommits ∪ all humans with personalRatio > 0,
 * hard-capped at 30. Preserves the input's personalRatio-desc sort order.
 *
 * The union ensures AI users always appear in the chart even when they're not in
 * the most-active 20 — without a low-volume AI experimenter being silently dropped
 * on a large repo.
 */
export function perAuthorAiMix(
  entries: PerAuthorMixEntry[],
): PerAuthorMixEntry[] {
  if (entries.length === 0) return [];

  // Top-N by totalCommits.
  const byTotalDesc = [...entries].sort(
    (a, b) => b.totalCommits - a.totalCommits,
  );
  const topByTotal = byTotalDesc.slice(0, TOP_BY_TOTAL);

  // All AI users.
  const aiUsers = entries.filter((e) => e.personalRatio > 0);

  // Union (dedup by author email).
  const seen = new Set<string>();
  const merged: PerAuthorMixEntry[] = [];
  for (const e of [...topByTotal, ...aiUsers]) {
    if (seen.has(e.author)) continue;
    seen.add(e.author);
    merged.push(e);
  }

  // Re-sort by personalRatio desc (matches analyzer ordering); enforce cap.
  return merged
    .sort((a, b) => {
      if (b.personalRatio !== a.personalRatio)
        return b.personalRatio - a.personalRatio;
      if (b.totalCommits !== a.totalCommits)
        return b.totalCommits - a.totalCommits;
      return a.author.localeCompare(b.author);
    })
    .slice(0, HARD_CAP);
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run perAuthorAiMix`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/perAuthorAiMix.ts \
        apps/web/src/utils/perAuthorAiMix.test.ts
git commit -m "$(cat <<'EOF'
feat(web): perAuthorAiMix util with top-20 + AI-user union cap

Selects rows for the per-author hero: top-20 humans by totalCommits
unioned with all AI users (personalRatio > 0), hard-capped at 30.
Ensures low-volume AI experimenters don't get silently dropped.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `AiAdoptionTrend` hero component

**Files:**
- Create: `apps/web/src/components/hero/AiAdoptionTrend.tsx`
- Test: `apps/web/src/components/hero/AiAdoptionTrend.test.tsx`

**Context:** 2-stack horizontal bar by ISO month. Mirror the visual structure of `ShameTrend.tsx` / `ParallelTimeline.tsx` / `StressTrend.tsx`. Read one of them first if you're unfamiliar with the pattern.

- [ ] **Step 1: Read the reference component**

Run: `cat apps/web/src/components/hero/ShameTrend.tsx`

Note the SVG layout, scales, axis labels, tooltip, HeroCaption integration.

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/components/hero/AiAdoptionTrend.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AiAdoptionTrend } from './AiAdoptionTrend';
import type { CoAuthorMonthEntry } from '@gitrelic/core';

describe('AiAdoptionTrend', () => {
  it('renders one bar per month with two stacked layers', () => {
    const byMonth: CoAuthorMonthEntry[] = [
      { month: '2026-01', aiAssisted: 5, pureHuman: 3, total: 8 },
      { month: '2026-02', aiAssisted: 7, pureHuman: 2, total: 9 },
    ];
    render(<AiAdoptionTrend byMonth={byMonth} />);
    // Two bars (one per month), each bar split into ai + pureHuman segments
    expect(screen.getAllByTestId('ai-trend-bar-ai').length).toBe(2);
    expect(screen.getAllByTestId('ai-trend-bar-human').length).toBe(2);
  });

  it('renders empty-state placeholder when byMonth is empty', () => {
    render(<AiAdoptionTrend byMonth={[]} />);
    expect(screen.getByText(/no co-authored commits in this analysis window/i)).toBeInTheDocument();
  });

  it('renders the hero caption', () => {
    render(<AiAdoptionTrend byMonth={[{ month: '2026-01', aiAssisted: 0, pureHuman: 5, total: 5 }]} />);
    expect(screen.getByText(/top layer = AI-assisted/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run AiAdoptionTrend`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the component**

```tsx
// apps/web/src/components/hero/AiAdoptionTrend.tsx
import { useMemo } from 'react';

import { HeroCaption } from '../shared/HeroCaption';

import type { CoAuthorMonthEntry } from '@gitrelic/core';

const PADDING = { top: 24, right: 24, bottom: 48, left: 48 };
const BAR_GAP_RATIO = 0.2;

interface AiAdoptionTrendProps {
  byMonth: CoAuthorMonthEntry[];
}

export function AiAdoptionTrend({ byMonth }: AiAdoptionTrendProps) {
  if (byMonth.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="max-w-md text-text-secondary">
          No co-authored commits in this analysis window.
        </p>
        <p className="mt-2 max-w-md text-sm text-text-tertiary">
          The AI Adoption hero shows monthly stacked bars (AI-assisted
          vs pure-human) when this codebase emits Co-Authored-By trailers.
        </p>
      </div>
    );
  }

  const maxTotal = useMemo(
    () => Math.max(1, ...byMonth.map((m) => m.total)),
    [byMonth],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <svg
        className="h-full w-full"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid meet"
      >
        {byMonth.map((m, i) => {
          const innerWidth = 800 - PADDING.left - PADDING.right;
          const innerHeight = 400 - PADDING.top - PADDING.bottom;
          const slotWidth = innerWidth / byMonth.length;
          const barWidth = slotWidth * (1 - BAR_GAP_RATIO);
          const x = PADDING.left + i * slotWidth + (slotWidth - barWidth) / 2;
          const aiHeight = (m.aiAssisted / maxTotal) * innerHeight;
          const humanHeight = (m.pureHuman / maxTotal) * innerHeight;
          const totalHeight = aiHeight + humanHeight;
          const baselineY = PADDING.top + innerHeight;

          return (
            <g key={m.month}>
              {/* Bottom layer: pure-human */}
              <rect
                data-testid="ai-trend-bar-human"
                x={x}
                y={baselineY - humanHeight}
                width={barWidth}
                height={humanHeight}
                className="fill-surface-tertiary"
              />
              {/* Top layer: AI-assisted */}
              <rect
                data-testid="ai-trend-bar-ai"
                x={x}
                y={baselineY - totalHeight}
                width={barWidth}
                height={aiHeight}
                className="fill-accent-coupling"
              />
              {/* X-axis label: short month */}
              <text
                x={x + barWidth / 2}
                y={baselineY + 16}
                textAnchor="middle"
                className="fill-text-tertiary text-[10px]"
              >
                {m.month.slice(2)}
              </text>
            </g>
          );
        })}
        {/* Y-axis: top, mid, baseline labels */}
        <text
          x={PADDING.left - 8}
          y={PADDING.top + 4}
          textAnchor="end"
          className="fill-text-tertiary text-[10px]"
        >
          {maxTotal}
        </text>
        <text
          x={PADDING.left - 8}
          y={PADDING.top + (400 - PADDING.top - PADDING.bottom) / 2 + 4}
          textAnchor="end"
          className="fill-text-tertiary text-[10px]"
        >
          {Math.round(maxTotal / 2)}
        </text>
        <text
          x={PADDING.left - 8}
          y={400 - PADDING.bottom + 4}
          textAnchor="end"
          className="fill-text-tertiary text-[10px]"
        >
          0
        </text>
      </svg>
      <HeroCaption primary="Monthly stacked bars · top layer = AI-assisted commits · bottom = pure-human · linear scale" />
    </div>
  );
}
```

- [ ] **Step 5: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run AiAdoptionTrend`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/hero/AiAdoptionTrend.tsx \
        apps/web/src/components/hero/AiAdoptionTrend.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): AiAdoptionTrend hero — 2-stack monthly bars

Default hero for the Co-Authors / AI tab. Stacked bar per ISO month,
ai-assisted on top (accent-coupling) and pure-human on bottom (neutral).
Empty-state placeholder when no co-authored commits in window. Mirrors
ShameTrend / ParallelTimeline / StressTrend visual structure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `PerAuthorAiMix` hero component

**Files:**
- Create: `apps/web/src/components/hero/PerAuthorAiMix.tsx`
- Test: `apps/web/src/components/hero/PerAuthorAiMix.test.tsx`

**Context:** Horizontal bar chart. One row per human author, segment-stacked AI vs solo. Read `OwnershipBar.tsx` first for the horizontal-bar pattern reference.

- [ ] **Step 1: Read the reference component**

Run: `cat apps/web/src/components/hero/OwnershipBar.tsx`

Note: row height, label area, bar segment rendering, value display.

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/components/hero/PerAuthorAiMix.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PerAuthorAiMix } from './PerAuthorAiMix';
import type { PerAuthorMixEntry } from '@gitrelic/core';

function row(overrides: Partial<PerAuthorMixEntry>): PerAuthorMixEntry {
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

describe('PerAuthorAiMix', () => {
  it('renders one row per author with display name (not email)', () => {
    render(
      <PerAuthorAiMix
        rows={[
          row({ author: 'alice@co.com', displayName: 'Alice', totalCommits: 10, aiCommits: 5, soloCommits: 5, personalRatio: 50 }),
          row({ author: 'bob@co.com', displayName: 'Bob', totalCommits: 8, aiCommits: 0, soloCommits: 8, personalRatio: 0 }),
        ]}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('alice@co.com')).toBeNull();
  });

  it('shows the personalRatio percentage on each row', () => {
    render(
      <PerAuthorAiMix
        rows={[row({ totalCommits: 10, aiCommits: 7, personalRatio: 70 })]}
      />,
    );
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('renders empty-state placeholder when rows is empty', () => {
    render(<PerAuthorAiMix rows={[]} />);
    expect(screen.getByText(/no human authors/i)).toBeInTheDocument();
  });

  it('renders the hero caption', () => {
    render(
      <PerAuthorAiMix
        rows={[row({ totalCommits: 5, soloCommits: 5 })]}
      />,
    );
    expect(screen.getByText(/horizontal bars · one row per human/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run PerAuthorAiMix`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the component**

```tsx
// apps/web/src/components/hero/PerAuthorAiMix.tsx
import { useMemo } from 'react';

import { HeroCaption } from '../shared/HeroCaption';

import type { PerAuthorMixEntry } from '@gitrelic/core';

const ROW_HEIGHT = 32;
const LABEL_WIDTH_PCT = 28; // % of horizontal space reserved for the author label
const RATIO_WIDTH_PCT = 8;  // % reserved for the trailing N% text

interface PerAuthorAiMixProps {
  rows: PerAuthorMixEntry[];
}

export function PerAuthorAiMix({ rows }: PerAuthorAiMixProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="max-w-md text-text-secondary">
          No human authors to show in this analysis window.
        </p>
      </div>
    );
  }

  const maxTotal = useMemo(
    () => Math.max(1, ...rows.map((r) => r.totalCommits)),
    [rows],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {rows.map((r) => {
          const aiPct = (r.aiCommits / maxTotal) * 100;
          const soloPct = (r.soloCommits / maxTotal) * 100;
          return (
            <div
              key={r.author}
              className="flex items-center"
              style={{ height: ROW_HEIGHT }}
            >
              <div
                className="truncate pr-3 text-right text-sm text-text-primary"
                style={{ width: `${LABEL_WIDTH_PCT}%` }}
              >
                {r.displayName}
              </div>
              <div className="relative h-3 flex-1 bg-surface-tertiary/30">
                {/* AI segment first (left side) */}
                <div
                  className="absolute left-0 top-0 h-full bg-accent-coupling"
                  style={{ width: `${aiPct}%` }}
                />
                {/* Solo segment continues to the right of AI */}
                <div
                  className="absolute top-0 h-full bg-surface-tertiary"
                  style={{ left: `${aiPct}%`, width: `${soloPct}%` }}
                />
              </div>
              <div
                className="pl-3 text-right font-mono text-sm text-text-secondary"
                style={{ width: `${RATIO_WIDTH_PCT}%` }}
              >
                {r.personalRatio}%
              </div>
            </div>
          );
        })}
      </div>
      <HeroCaption primary="Horizontal bars · one row per human · segment width = commit count · split by AI-assisted vs solo" />
    </div>
  );
}
```

- [ ] **Step 5: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run PerAuthorAiMix`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/hero/PerAuthorAiMix.tsx \
        apps/web/src/components/hero/PerAuthorAiMix.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): PerAuthorAiMix hero — horizontal AI/solo bars per human

Alt hero for the Co-Authors / AI tab. One bar per human author,
segment-stacked into AI-assisted (accent-coupling) and solo commits
(neutral). Sorted desc by personal AI ratio. Empty state when no rows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Polish `AuthorForceGraph` (classification, filter, names, tooltips, caption)

**Files:**
- Modify: `apps/web/src/components/hero/AuthorForceGraph.tsx`
- Modify: `apps/web/src/components/hero/authorGraph.ts`
- Modify: `apps/web/src/components/hero/authorGraph.test.ts`

**Context:** The existing force graph stays — polished, not replaced. Six improvements: classification colors, single-commit edge filter, display names, improved tooltips, HeroCaption, header rename.

- [ ] **Step 1: Read the existing component and helper**

Run:
```bash
cat apps/web/src/components/hero/AuthorForceGraph.tsx
cat apps/web/src/components/hero/authorGraph.ts
```

Note the existing data-derivation shape and rendering approach.

- [ ] **Step 2: Update `authorGraph.ts` to filter single-commit edges and classify nodes**

Add at the top of the file:

```ts
import { classifyAuthor, aiProductName } from '@gitrelic/core';
import type { AuthorClass } from '@gitrelic/core';
```

Find the function that derives the graph data (likely `buildAuthorGraph` or similar). Update its return-shape interface to include node classification:

```ts
export interface AuthorGraphNode {
  id: string;          // email (lowercased)
  displayName: string;
  commitCount: number;
  classification: AuthorClass;
}

export interface AuthorGraphLink {
  source: string;
  target: string;
  coCommits: number;
  sharedFiles: number;
  classification: 'human-pair' | 'human-ai';
}
```

Inside the derivation function, after the existing pair iteration: filter pairs with `coCommits === 1` (count and report `filteredEdgeCount`). Classify each node email via `classifyAuthor`. Resolve display name: try `aiProductName(email)` first (returns "Claude" / "Copilot" / etc.), then contributor map, then email fallback.

- [ ] **Step 3: Update `authorGraph.test.ts` for the new data shape**

Add tests covering:
- Single-commit edges filtered out (count of filtered edges reported)
- AI nodes classified as 'ai', humans as 'human'
- AI display names use `aiProductName` when available

- [ ] **Step 4: Update the component to consume classification + use display names**

In `AuthorForceGraph.tsx`:

1. Pass `coAuthors` from `report.coAuthors.pairs` filtered for `coAuthoredCommits > 1`
2. Color nodes by classification: AI = `var(--accent-coupling)`, human = existing per-author hash
3. Edge color: human-ai pairs get `var(--accent-coupling)` tint, human-pair stays neutral
4. Replace email labels in node rendering with `displayName`
5. Hover tooltips:
   - Edge: `<displayA> ↔ <displayB> · N co-commits · K shared files · <classification>`
   - Node: `<displayName> · <classification> · N co-authored commits · K partners`
6. Add `<HeroCaption primary="Force-directed network · circles = co-authors (size = commit volume) · edges = shared commits · single-commit pairs hidden">` beneath the SVG. Wrap the existing SVG in `<div className="flex flex-col h-full">` if not already.

- [ ] **Step 5: Update the registry preset's viz label**

Edit `apps/web/src/presets/registry.ts` — find the `co-authors` preset's hero viz definition, rename the label string from `'Repository Map'` to `'Co-Author Graph'`. (If the registry doesn't currently expose hero-tab labels separately from IDs, this rename is part of the registry update in Task 17.)

- [ ] **Step 6: Run all hero tests**

Run: `pnpm --filter @gitrelic/web test --run "hero/Author"`
Expected: PASS — updated tests for classification, filter, display names.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/hero/AuthorForceGraph.tsx \
        apps/web/src/components/hero/authorGraph.ts \
        apps/web/src/components/hero/authorGraph.test.ts
git commit -m "$(cat <<'EOF'
feat(web): polish co-author force graph for AI awareness

Classification colors (AI nodes accent-coupling, humans by per-author
hash), single-commit edges hidden by default (release-attribution
noise), display names instead of emails (Claude / GitHub Copilot /
human full names), improved tooltips replace the cryptic '1 partner'
label, HeroCaption strip wired through to docs link. Bot nodes are
already filtered upstream (analyzer strips them).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `CoAuthorsAiAdoptionTab` (narrative-KPI default tab)

**Files:**
- Create: `apps/web/src/components/tabs/CoAuthorsAiAdoptionTab.tsx`
- Test: `apps/web/src/components/tabs/CoAuthorsAiAdoptionTab.test.tsx`

**Context:** Mirror `BlastRadiusTab.tsx` / `KnowledgeSilosTab.tsx` shape. Use `<NarrativeKPI>` with extras slot for the bot-filter footnote when applicable.

- [ ] **Step 1: Read reference tabs**

Run:
```bash
cat apps/web/src/components/tabs/BlastRadiusTab.tsx
cat apps/web/src/components/tabs/KnowledgeSilosTab.tsx
```

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/components/tabs/CoAuthorsAiAdoptionTab.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoAuthorsAiAdoptionTab } from './CoAuthorsAiAdoptionTab';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(overrides: Partial<GitrelicReport['coAuthors']> = {}): GitrelicReport {
  return {
    coAuthors: {
      pairs: [],
      authorStats: [],
      totalCoAuthoredCommits: 0,
      summary: '',
      aiAssistedCommits: 0,
      humanAuthoredCommits: 0,
      aiAdoptionPercent: 0,
      aiAdoptionTier: 'none',
      aiAuthors: [],
      humanPairs: [],
      filteredBotCommits: 0,
      byMonth: [],
      perAuthorMix: [],
      ...overrides,
    },
    contributors: { contributors: [] },
  } as unknown as GitrelicReport;
}

describe('CoAuthorsAiAdoptionTab', () => {
  it('Scenario 1: zero co-authors → renders em-dash and "No Co-Author Data"', () => {
    const report = makeReport({ totalCoAuthoredCommits: 0 });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByTestId('narrative-kpi-big-number')).toHaveTextContent('—');
    expect(screen.getByText(/no co-author data/i)).toBeInTheDocument();
  });

  it('Scenario 2: trailers but no AI → renders 0% with "No Adoption Yet"', () => {
    const report = makeReport({
      totalCoAuthoredCommits: 5,
      humanAuthoredCommits: 100,
      aiAssistedCommits: 0,
      aiAdoptionPercent: 0,
      aiAdoptionTier: 'none',
      humanPairs: [
        {
          authorA: 'a@b.com',
          authorB: 'c@d.com',
          coAuthoredCommits: 5,
          files: [],
          classification: 'human-pair',
        },
      ],
    });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByTestId('narrative-kpi-big-number')).toHaveTextContent('0%');
    expect(screen.getByText(/no adoption yet/i)).toBeInTheDocument();
  });

  it('Scenario 3: AI-assisted → renders adoption % and top-3 finding', () => {
    const report = makeReport({
      totalCoAuthoredCommits: 100,
      humanAuthoredCommits: 200,
      aiAssistedCommits: 100,
      aiAdoptionPercent: 50,
      aiAdoptionTier: 'high',
      aiAuthors: [
        { author: 'dan@x.com', displayName: 'Dan', aiCommits: 60, totalCommits: 70, personalRatio: 86 },
        { author: 'lc@x.com', displayName: 'Lasercobra', aiCommits: 40, totalCommits: 50, personalRatio: 80 },
      ],
    });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByTestId('narrative-kpi-big-number')).toHaveTextContent('50%');
    expect(screen.getByText(/high adoption/i)).toBeInTheDocument();
    expect(screen.getByText('Dan')).toBeInTheDocument();
    expect(screen.getByText('Lasercobra')).toBeInTheDocument();
  });

  it('renders bot-filter footnote when filteredBotCommits > 0', () => {
    const report = makeReport({
      totalCoAuthoredCommits: 5,
      filteredBotCommits: 3,
    });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/3 bot-authored commits filtered/i)).toBeInTheDocument();
  });

  it('does not render bot footnote when filteredBotCommits === 0', () => {
    const report = makeReport({ totalCoAuthoredCommits: 5, filteredBotCommits: 0 });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.queryByText(/bot-authored commits filtered/i)).toBeNull();
  });

  it('see-also footer fires onApplyPreset for contributors and parallel-dev', async () => {
    const onApplyPreset = vi.fn();
    const user = userEvent.setup();
    const report = makeReport({ totalCoAuthoredCommits: 5 });
    render(<CoAuthorsAiAdoptionTab report={report} onApplyPreset={onApplyPreset} />);
    await user.click(screen.getByRole('button', { name: /contributors/i }));
    expect(onApplyPreset).toHaveBeenCalledWith('contributors');
    await user.click(screen.getByRole('button', { name: /parallel dev/i }));
    expect(onApplyPreset).toHaveBeenCalledWith('parallel-dev');
  });
});
```

- [ ] **Step 3: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run CoAuthorsAiAdoptionTab`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the tab**

```tsx
// apps/web/src/components/tabs/CoAuthorsAiAdoptionTab.tsx
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { topAiUsers } from '../../utils/topAiUsers';
import { fmt } from '../theme';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { AdoptionTier, GitrelicReport } from '@gitrelic/core';

interface CoAuthorsAiAdoptionTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

type Scenario = 'no-trailers' | 'no-ai' | 'standard';

function detectScenario(report: GitrelicReport): Scenario {
  const ca = report.coAuthors;
  if (ca.totalCoAuthoredCommits === 0) return 'no-trailers';
  if (ca.aiAssistedCommits === 0) return 'no-ai';
  return 'standard';
}

function tierBadge(
  tier: AdoptionTier,
  scenario: Scenario,
): { variant: BadgeVariant; label: string } {
  if (scenario === 'no-trailers')
    return { variant: 'stale', label: 'No Co-Author Data' };
  switch (tier) {
    case 'none':
      return { variant: 'stale', label: 'No Adoption Yet' };
    case 'low':
      return { variant: 'coupling', label: 'Low Adoption' };
    case 'moderate':
      return { variant: 'coupling', label: 'Moderate Adoption' };
    case 'high':
      return { variant: 'coupling', label: 'High Adoption' };
  }
}

function NoTrailersFinding() {
  return (
    <p className="max-w-md text-sm text-text-secondary">
      This codebase doesn&apos;t use Co-Authored-By trailers. The analyzer
      surfaces explicit pair-programming and AI-assistance attribution — when
      present. Common in projects using GitHub-style PR workflows or AI tools
      like Claude Code.
    </p>
  );
}

function NoAiFinding({ report }: { report: GitrelicReport }) {
  const ca = report.coAuthors;
  return (
    <p className="max-w-md text-sm text-text-secondary">
      <span className="font-mono text-text-primary">
        {ca.totalCoAuthoredCommits}
      </span>{' '}
      co-authored commits across{' '}
      <span className="font-mono text-text-primary">{ca.humanPairs.length}</span>{' '}
      pairs, none AI-assisted. This codebase uses co-author trailers for human
      collaboration only.
    </p>
  );
}

function TopAiUsersList({
  users,
}: {
  users: ReturnType<typeof topAiUsers>;
}) {
  if (users.length === 0)
    return <p className="text-sm text-text-tertiary">No AI users yet.</p>;
  return (
    <ul className="space-y-1">
      {users.map((u) => (
        <li key={u.author} className="text-sm">
          <span className="font-medium text-text-primary">{u.displayName}</span>
          <span className="ml-2 font-mono text-text-secondary">
            {fmt(u.aiCommits)} AI commits
          </span>
          <span className="ml-2 text-xs text-text-tertiary">
            ({u.personalRatio}%)
          </span>
        </li>
      ))}
    </ul>
  );
}

function StandardSubline({ report }: { report: GitrelicReport }) {
  const ca = report.coAuthors;
  const totalReportCommits =
    ca.humanAuthoredCommits + ca.filteredBotCommits;
  const broaderRatio =
    totalReportCommits > 0
      ? Math.round((ca.aiAssistedCommits / totalReportCommits) * 100)
      : 0;
  return (
    <span>
      <span className="font-mono text-text-primary">
        {fmt(ca.aiAssistedCommits)}
      </span>{' '}
      AI-assisted commits ·{' '}
      <span className="font-mono">{ca.aiAdoptionPercent}%</span> of human work ·{' '}
      <span className="font-mono">{broaderRatio}%</span> of all repo activity
      {ca.filteredBotCommits > 0 ? ' (incl. bots)' : ''}
    </span>
  );
}

function NoAiSubline({ report }: { report: GitrelicReport }) {
  const ca = report.coAuthors;
  const collaborators = new Set<string>();
  for (const p of ca.humanPairs) {
    collaborators.add(p.authorA);
    collaborators.add(p.authorB);
  }
  return (
    <span>
      <span className="font-mono">0</span> AI-assisted commits ·{' '}
      <span className="font-mono">{fmt(ca.totalCoAuthoredCommits)}</span> human
      pair-commits ·{' '}
      <span className="font-mono">{collaborators.size}</span> collaborators
    </span>
  );
}

function NoTrailersSubline({ report }: { report: GitrelicReport }) {
  return (
    <span className="text-text-tertiary">
      0 co-authored commits across{' '}
      <span className="font-mono">{fmt(report.coAuthors.humanAuthoredCommits)}</span>{' '}
      total commits in window
    </span>
  );
}

function BotFilterFootnote({ count }: { count: number }) {
  return (
    <p className="mt-2 text-xs text-text-tertiary">
      <span className="font-mono">{count}</span> bot-authored commits filtered
      (semantic-release, dependabot, etc.)
    </p>
  );
}

export function CoAuthorsAiAdoptionTab({
  report,
  onApplyPreset,
}: CoAuthorsAiAdoptionTabProps) {
  const ca = report.coAuthors;
  const scenario = detectScenario(report);
  const badge = tierBadge(ca.aiAdoptionTier, scenario);
  const top = topAiUsers(ca.aiAuthors, report.contributors.contributors, 3);

  const finding =
    scenario === 'no-trailers' ? (
      <NoTrailersFinding />
    ) : scenario === 'no-ai' ? (
      <NoAiFinding report={report} />
    ) : (
      <TopAiUsersList users={top} />
    );

  const subline =
    scenario === 'no-trailers' ? (
      <NoTrailersSubline report={report} />
    ) : scenario === 'no-ai' ? (
      <NoAiSubline report={report} />
    ) : (
      <StandardSubline report={report} />
    );

  return (
    <NarrativeKPI
      bigNumber={scenario === 'no-trailers' ? '—' : `${ca.aiAdoptionPercent}%`}
      tier={badge}
      metric="AI ADOPTION"
      finding={finding}
      subline={subline}
      extras={
        ca.filteredBotCommits > 0 ? (
          <BotFilterFootnote count={ca.filteredBotCommits} />
        ) : undefined
      }
      seeAlso={[
        { label: 'Contributors', presetId: 'contributors' },
        { label: 'Parallel Dev', presetId: 'parallel-dev' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

- [ ] **Step 5: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run CoAuthorsAiAdoptionTab`
Expected: PASS — all six cases.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tabs/CoAuthorsAiAdoptionTab.tsx \
        apps/web/src/components/tabs/CoAuthorsAiAdoptionTab.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): CoAuthorsAiAdoptionTab — narrative-KPI for AI adoption

Default bottom-panel tab for Co-Authors / AI. Three scenario states
(no trailers / no AI / standard) each with distinct copy + tier badge.
Top-3 AI users via topAiUsers util; subline shows B + A ratios; bot
filter footnote renders when filteredBotCommits > 0; sticky see-also
footer routes to Contributors and Parallel Dev.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: `CoAuthorsPairsTab` (classified pair table)

**Files:**
- Create: `apps/web/src/components/tabs/CoAuthorsPairsTab.tsx`
- Test: `apps/web/src/components/tabs/CoAuthorsPairsTab.test.tsx`

- [ ] **Step 1: Read the SortableTable reference**

Run:
```bash
cat apps/web/src/components/shared/SortableTable.tsx
cat apps/web/src/components/tabs/ContributorsTab.tsx
```

Note the `Column<T>` shape and how cells are rendered.

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/components/tabs/CoAuthorsPairsTab.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CoAuthorsPairsTab } from './CoAuthorsPairsTab';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(pairs: GitrelicReport['coAuthors']['pairs']): GitrelicReport {
  return {
    coAuthors: {
      pairs,
      authorStats: [],
      totalCoAuthoredCommits: pairs.reduce((s, p) => s + p.coAuthoredCommits, 0),
      summary: '',
      aiAssistedCommits: 0,
      humanAuthoredCommits: 0,
      aiAdoptionPercent: 0,
      aiAdoptionTier: 'none',
      aiAuthors: [],
      humanPairs: pairs.filter((p) => p.classification === 'human-pair'),
      filteredBotCommits: 0,
      byMonth: [],
      perAuthorMix: [],
    },
    contributors: { contributors: [] },
  } as unknown as GitrelicReport;
}

describe('CoAuthorsPairsTab', () => {
  it('renders rows with classification badges', () => {
    const report = makeReport([
      {
        authorA: 'alice@co.com',
        authorB: 'noreply@anthropic.com',
        coAuthoredCommits: 10,
        files: ['a.ts'],
        classification: 'human-ai',
      },
      {
        authorA: 'bob@co.com',
        authorB: 'carol@co.com',
        coAuthoredCommits: 3,
        files: ['b.ts'],
        classification: 'human-pair',
      },
    ]);
    render(<CoAuthorsPairsTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/AI/)).toBeInTheDocument();
    expect(screen.getByText(/Human/i)).toBeInTheDocument();
  });

  it('renders empty placeholder when pairs is empty', () => {
    const report = makeReport([]);
    render(<CoAuthorsPairsTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/no co-authored commits/i)).toBeInTheDocument();
  });

  it('renders bot-filter footnote when filteredBotCommits > 0', () => {
    const report = makeReport([]);
    report.coAuthors.filteredBotCommits = 5;
    render(<CoAuthorsPairsTab report={report} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/5 bot-authored commits filtered/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run CoAuthorsPairsTab`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the tab**

```tsx
// apps/web/src/components/tabs/CoAuthorsPairsTab.tsx
import { useMemo } from 'react';

import { Badge } from '../shared/Badge';
import { SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';

import type { Column } from '../shared/SortableTable';
import type { PresetId } from '../../presets/types';
import type { CoAuthorPair, GitrelicReport } from '@gitrelic/core';

interface CoAuthorsPairsTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

interface PairRow {
  pair: CoAuthorPair;
  displayA: string;
  displayB: string;
}

function resolveDisplayName(
  email: string,
  contributors: GitrelicReport['contributors']['contributors'],
): string {
  const match = contributors.find(
    (c) => c.email.toLowerCase() === email.toLowerCase(),
  );
  return match && match.name ? match.name : email;
}

export function CoAuthorsPairsTab({
  report,
  onApplyPreset: _onApplyPreset,
}: CoAuthorsPairsTabProps) {
  const ca = report.coAuthors;
  const rows = useMemo<PairRow[]>(
    () =>
      ca.pairs.map((p) => ({
        pair: p,
        displayA: resolveDisplayName(p.authorA, report.contributors.contributors),
        displayB: resolveDisplayName(p.authorB, report.contributors.contributors),
      })),
    [ca.pairs, report.contributors.contributors],
  );

  const columns: Column<PairRow>[] = [
    {
      key: 'pair',
      header: 'Pair',
      render: (r) => (
        <span className="text-sm">
          <span className="font-medium text-text-primary">{r.displayA}</span>
          <span className="mx-2 text-text-tertiary">↔</span>
          <span className="font-medium text-text-primary">{r.displayB}</span>
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => (
        <Badge
          variant={r.pair.classification === 'human-ai' ? 'coupling' : 'stale'}
        >
          {r.pair.classification === 'human-ai' ? 'AI' : 'Human'}
        </Badge>
      ),
    },
    {
      key: 'coCommits',
      header: 'Co-Commits',
      sortable: true,
      sortValue: (r) => r.pair.coAuthoredCommits,
      render: (r) => (
        <span className="font-mono">{fmt(r.pair.coAuthoredCommits)}</span>
      ),
    },
    {
      key: 'sharedFiles',
      header: 'Shared Files',
      sortable: true,
      sortValue: (r) => r.pair.files.length,
      render: (r) => <span className="font-mono">{fmt(r.pair.files.length)}</span>,
    },
  ];

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col p-6">
        <p className="text-text-secondary">
          No co-authored commits in this analysis window.
        </p>
        {ca.filteredBotCommits > 0 && (
          <p className="mt-2 text-xs text-text-tertiary">
            <span className="font-mono">{ca.filteredBotCommits}</span>{' '}
            bot-authored commits filtered (semantic-release, dependabot, etc.)
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <SortableTable
          columns={columns}
          rows={rows}
          defaultSort={{ key: 'coCommits', direction: 'desc' }}
          rowKey={(r) => `${r.pair.authorA}\0${r.pair.authorB}`}
        />
      </div>
      {ca.filteredBotCommits > 0 && (
        <p className="px-6 py-2 text-xs text-text-tertiary">
          <span className="font-mono">{ca.filteredBotCommits}</span> bot-authored
          commits filtered (semantic-release, dependabot, etc.)
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run CoAuthorsPairsTab`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tabs/CoAuthorsPairsTab.tsx \
        apps/web/src/components/tabs/CoAuthorsPairsTab.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): CoAuthorsPairsTab — classified pair table tab

Alt bottom-panel tab. Sortable table with classification badges
([AI] for human-ai, [Human] for human-pair). Default sort: co-commits
desc. Bots already stripped upstream; footnote renders when applicable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: BottomPanel + Sidebar wiring (delete old `CoAuthorsTab.tsx`)

**Files:**
- Modify: `apps/web/src/components/layout/BottomPanel.tsx`
- Delete: `apps/web/src/components/tabs/CoAuthorsTab.tsx`
- Modify: `apps/web/src/components/layout/Shell.test.tsx` (if it imports/tests the old tab)

**Context:** The old `CoAuthorsTab.tsx` is replaced by the two new tabs. BottomPanel routes the tab IDs to components.

- [ ] **Step 1: Identify the old tab references**

Run:
```bash
grep -rn "CoAuthorsTab" apps/web/src/
```

Catalog every usage. Most likely: import + switch case in `BottomPanel.tsx` plus the file itself.

- [ ] **Step 2: Update `BottomPanel.tsx` to route the new tab IDs**

Find the existing co-author routing branch. Replace:

```tsx
// Old:
case 'co-authors':
  return <CoAuthorsTab report={report} ... />;
```

With:

```tsx
case 'co-authors-ai-adoption':
  return (
    <CoAuthorsAiAdoptionTab
      report={report}
      onApplyPreset={onApplyPreset}
    />
  );
case 'co-authors-pairs':
  return (
    <CoAuthorsPairsTab report={report} onApplyPreset={onApplyPreset} />
  );
```

Update the imports at the top of the file accordingly (drop `CoAuthorsTab`, add the two new tabs).

- [ ] **Step 3: Delete `CoAuthorsTab.tsx`**

```bash
rm apps/web/src/components/tabs/CoAuthorsTab.tsx
```

If `apps/web/src/components/tabs/CoAuthorsTab.test.tsx` exists: delete it too.

```bash
rm apps/web/src/components/tabs/CoAuthorsTab.test.tsx 2>/dev/null || true
```

- [ ] **Step 4: Update `Shell.test.tsx` if it references the old tab**

Run: `grep -n "co-authors" apps/web/src/components/layout/Shell.test.tsx`

If it uses the bare `'co-authors'` string anywhere as a tab ID, update to `'co-authors-ai-adoption'`. If not, no change needed.

- [ ] **Step 5: Run all web tests**

Run: `pnpm --filter @gitrelic/web test --run`
Expected: PASS — but the `co-authors` preset's `defaultTab` and `altTabs` may still reference old IDs (Task 17 fixes the registry). If tests fail because of `unknown tab id`, the registry change is required next.

If many tests fail because of registry mismatch: skip ahead to verify Task 17, run smoke, commit both together. (See judgment-call note in Task 17.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/BottomPanel.tsx \
        apps/web/src/components/layout/Shell.test.tsx
git rm apps/web/src/components/tabs/CoAuthorsTab.tsx \
        apps/web/src/components/tabs/CoAuthorsTab.test.tsx 2>/dev/null
git commit -m "$(cat <<'EOF'
refactor(web): replace CoAuthorsTab with two tab components

Wire BottomPanel to route co-authors-ai-adoption (default) and
co-authors-pairs (alt) to the two new tab components. Delete the old
CoAuthorsTab that mixed both stories into one panel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Metrics composer rewrite

**Files:**
- Modify: `apps/web/src/presets/metrics/co-authors.ts`
- Modify: `apps/web/src/presets/metrics/co-authors.test.ts`

- [ ] **Step 1: Rewrite the test for the new 5-slot composition**

Replace `apps/web/src/presets/metrics/co-authors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { coAuthorsMetrics } from './co-authors';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(overrides: Partial<GitrelicReport['coAuthors']> = {}): GitrelicReport {
  return {
    coAuthors: {
      pairs: [],
      authorStats: [],
      totalCoAuthoredCommits: 0,
      summary: '',
      aiAssistedCommits: 0,
      humanAuthoredCommits: 0,
      aiAdoptionPercent: 0,
      aiAdoptionTier: 'none',
      aiAuthors: [],
      humanPairs: [],
      filteredBotCommits: 0,
      byMonth: [],
      perAuthorMix: [],
      ...overrides,
    },
  } as unknown as GitrelicReport;
}

describe('coAuthorsMetrics', () => {
  it('produces exactly 5 slots in the documented order', () => {
    const metrics = coAuthorsMetrics(makeReport());
    expect(metrics).toHaveLength(5);
    expect(metrics.map((m) => m.label)).toEqual([
      'AI Adoption',
      'AI Commits',
      'AI Authors',
      'Human Pairs',
      'Co-Author Commits',
    ]);
  });

  it('shows percentage suffix on slot 1', () => {
    const metrics = coAuthorsMetrics(
      makeReport({ aiAdoptionPercent: 47 }),
    );
    expect(metrics[0].value).toBe('47%');
  });

  it('renders all-stale on empty report', () => {
    const metrics = coAuthorsMetrics(makeReport());
    for (const m of metrics) {
      expect(m.color).toContain('text-tertiary');
    }
  });

  it('renders coupling color for non-zero values', () => {
    const metrics = coAuthorsMetrics(
      makeReport({
        aiAdoptionPercent: 30,
        aiAssistedCommits: 50,
        aiAuthors: [
          { author: 'a@b.com', displayName: 'A', aiCommits: 50, totalCommits: 100, personalRatio: 50 },
        ],
        humanPairs: [
          {
            authorA: 'a@b.com',
            authorB: 'b@c.com',
            coAuthoredCommits: 5,
            files: [],
            classification: 'human-pair',
          },
        ],
        totalCoAuthoredCommits: 50,
      }),
    );
    for (const m of metrics) {
      expect(m.color).toContain('coupling');
    }
  });
});
```

- [ ] **Step 2: Run the test (expect fail)**

Run: `pnpm --filter @gitrelic/web test --run "presets/metrics/co-authors"`
Expected: FAIL — old composer still emits old slots.

- [ ] **Step 3: Rewrite the composer**

Replace `apps/web/src/presets/metrics/co-authors.ts`:

```ts
import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

const STALE = 'var(--text-tertiary)';
const COUPLING = 'var(--accent-coupling)';

function color(nonZero: boolean): string {
  return nonZero ? COUPLING : STALE;
}

export function coAuthorsMetrics(report: GitrelicReport): Metric[] {
  const ca = report.coAuthors;

  return [
    {
      label: 'AI Adoption',
      value: `${ca.aiAdoptionPercent}%`,
      color: color(ca.aiAdoptionPercent > 0),
    },
    {
      label: 'AI Commits',
      value: fmt(ca.aiAssistedCommits),
      color: color(ca.aiAssistedCommits > 0),
    },
    {
      label: 'AI Authors',
      value: fmt(ca.aiAuthors.length),
      color: color(ca.aiAuthors.length > 0),
    },
    {
      label: 'Human Pairs',
      value: fmt(ca.humanPairs.length),
      color: color(ca.humanPairs.length > 0),
    },
    {
      label: 'Co-Author Commits',
      value: fmt(ca.totalCoAuthoredCommits),
      color: color(ca.totalCoAuthoredCommits > 0),
    },
  ];
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter @gitrelic/web test --run "presets/metrics/co-authors"`
Expected: PASS — all four cases.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/presets/metrics/co-authors.ts \
        apps/web/src/presets/metrics/co-authors.test.ts
git commit -m "$(cat <<'EOF'
feat(web): retune Co-Authors / AI metrics strip for adoption story

Replaces 5 generic count slots (Pairs / Co-commits / Collaborators /
Avg Commits-Pair / Top Pair Commits) with 5 informational-tier slots
(AI Adoption % / AI Commits / AI Authors / Human Pairs / Co-Author
Commits). Two-state coloring (stale / coupling) per Q8 — adoption is
informational, not risk-shaped.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Docs page

**Files:**
- Create: `apps/docs/analyzers/co-authors.md`
- Modify: `apps/docs/.vitepress/config.ts`

**Context:** New analyzer doc. Must land **before** Task 17 sets `docsPath` in the registry — `registry.test.ts` enforces docs-page existence when `docsPath` is set.

- [ ] **Step 1: Read a reference analyzer page**

Run:
```bash
cat apps/docs/analyzers/parallel-dev.md
cat apps/docs/analyzers/contributors.md
```

Note the structure: frontmatter, intro, quick read, formula sections, comparison tables, limitations.

- [ ] **Step 2: Write the docs page**

Create `apps/docs/analyzers/co-authors.md`:

```markdown
---
title: Co-Authors / AI
description: Surfaces AI-assistance adoption and human pair-programming attribution from Co-Authored-By trailers.
---

# Co-Authors / AI

The **Co-Authors / AI** analyzer parses `Co-Authored-By:` trailers from commit messages, classifies each author email as **AI** (Claude / GitHub Copilot / Aider / Devin / Cursor), **bot** (semantic-release / dependabot / renovate / GitHub Actions), or **human**, and surfaces two distinct stories: how AI assistance is adopted in this codebase, and which humans pair-program with each other.

## What it answers

- **AI Adoption story** (default): What fraction of commits used AI assistance? When did adoption start? Is it growing? Who are the team's AI champions?
- **Human Collaboration story** (alt): Who explicitly pairs with whom? Which pairs share the most files?

The analyzer measures **explicit credit attribution**, not coordination. Two engineers can pair-program every day and never appear here if they don't add `Co-Authored-By:` trailers; conversely, an AI assistant gets a trailer-credit pair on every commit it helps with. For *observed* coordination, see the [Parallel Dev](./parallel-dev) analyzer.

## Quick read

1. **Metrics strip** — five-slot summary: `AI Adoption %` · `AI Commits` · `AI Authors` · `Human Pairs` · `Co-Author Commits`
2. **Default hero (AI Adoption Trend)** — monthly stacked bar: AI-assisted commits on top, pure-human on bottom
3. **Alt hero (Per-Author AI Mix)** — horizontal bars, one per human, AI vs solo split
4. **Alt-alt hero (Co-Author Graph)** — force-directed network of who-pairs-with-whom
5. **Bottom panel — AI Adoption tab** — narrative-KPI: adoption %, top 3 AI users, ratio breakdown
6. **Bottom panel — Co-Author Pairs tab** — sortable table of pairs with classification badges

## What counts as AI

| Tool | Email pattern |
|---|---|
| Claude (Anthropic) | `noreply@anthropic.com` |
| GitHub Copilot Workspace | `copilot[bot]@*.noreply.github.com` |
| Aider | `aider@aider.chat` |
| Devin (Cognition) | `devin-ai-integration[bot]@*.noreply.github.com` |
| Cursor | `*@cursor.sh` |
| Generic AI-tool fallback | `*ai*[bot]@*.noreply.github.com` |

If your team uses an AI coding assistant that isn't recognized, please file an issue with the email pattern.

## What counts as a bot

`semantic-release-*`, `dependabot*`, `renovate*`, `github-actions[bot]@*`, plus a catch-all for `*[bot]@users.noreply.github.com` accounts that don't match an AI pattern.

**Bots are stripped from the analysis entirely.** The bottom-panel tabs render a small footnote `"N bot-authored commits filtered"` when applicable, so the filter is transparent.

## Reading the AI Adoption hero

Each bar is one ISO month in the analysis window. Top layer = AI-assisted commits; bottom = pure-human commits. The bars sum to total human-authored commits per month (excludes bots).

- **Hockey stick** = team adopted AI in a given month and use is growing
- **Steady ratio** = consistent AI use over time
- **Empty top layer** = no AI in this codebase yet
- **No bars** = no co-authored commits at all in window

## Reading the Per-Author AI Mix hero

Each horizontal bar is one human author. The colored segment = their AI-assisted commits; the neutral segment = their solo commits. Trailing `N%` = their personal AI ratio.

The chart shows top-20 humans by total commits ∪ all humans with any AI use, capped at 30 rows. Sorted desc by personal ratio.

## Reading the Co-Author Graph hero

Force-directed network. Each circle is a co-author email; each edge is a pair connection. Circle size = co-commit volume. Edge thickness = pair frequency.

- **Star pattern centered on Claude/Copilot** = AI-dominant team (most co-authoring goes through an AI assistant)
- **Dense human cluster** = active pair-programming culture
- **Sparse, fragmented** = little explicit collaboration credit

Single-commit edges are hidden by default to reduce noise (hidden count is shown in the caption). Bot nodes are stripped before rendering.

## AI Adoption vs Human Pairs

| Question | Surface |
|---|---|
| Did we adopt AI? When? | AI Adoption hero (default) + slot 1 |
| Who personally uses AI most? | Per-Author AI Mix hero (alt) + slot 3 |
| Who pairs with whom? | Co-Author Graph hero (alt-alt) + Pairs table tab |

## Three repo modes

The analyzer handles three structurally different states:

### Scenario 1 — no co-author trailers anywhere

Most repos in the wild fall here. The big number reads `—`; tier badge is `No Co-Author Data` (neutral grey). Trend hero shows an empty-state placeholder. Pair table is empty.

### Scenario 2 — trailers present, zero AI

The classic human-pairing repo (e.g., React's analysis window). Big number reads `0%`; tier badge is `No Adoption Yet` (neutral, *not* red — absence of AI isn't risk). Trend hero renders with rich pure-human bars. Pair table shows all `[Human]` rows.

### Scenario 3 — AI-using repo

Big number shows the adoption %; tier badge maps to `Low / Moderate / High Adoption`. Trend hero shows the temporal AI-adoption shape. Pair table mixes `[AI]` and `[Human]` rows.

## Limitations

- **Heuristic tool detection.** New AI tools may not yet be classified; file an issue or PR to add patterns.
- **Trailer-only signal.** Some teams pair-program religiously but don't use trailers; their collaboration is invisible here. The Parallel Dev analyzer complements this with observed concurrent work.
- **Squash merges may drop trailers.** GitHub's squash-merge UI can preserve or strip co-author trailers depending on configuration.
- **Rename tracking.** The pair-graph counts shared files based on file path; rename history isn't followed.
- **Credit ≠ coordination.** A commit with `Co-Authored-By: Claude` doesn't necessarily mean "Claude wrote this code" — it means the human author attributed AI help.

## Related analyzers

- [Contributors](./contributors) — per-author totals, the canonical "who works on this codebase" view
- [Parallel Dev](./parallel-dev) — concurrent file-level work, the *observed* collaboration sibling to this *attributed* one
- [Bus Factor](./bus-factor) — ownership concentration; relevant when AI adoption changes the team's ownership shape
```

- [ ] **Step 3: Update VitePress sidebar**

Edit `apps/docs/.vitepress/config.ts` to add an entry:

Find the analyzer-sidebar block. Add:

```ts
{ text: 'Co-Authors / AI', link: '/analyzers/co-authors' },
```

Position it alphabetically (after `Coupling`, before `Commit Timing` is the typical sort).

If the existing config has an `ignoreDeadLinks` array referencing `/analyzers/co-authors`, remove that entry — the page now exists.

- [ ] **Step 4: Verify the docs build**

Run: `pnpm docs:build`
Expected: VitePress build succeeds. New page appears in `apps/docs/.vitepress/dist/analyzers/co-authors/`.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/analyzers/co-authors.md \
        apps/docs/.vitepress/config.ts
git commit -m "$(cat <<'EOF'
docs: Co-Authors / AI analyzer page

Adds the analyzer's docs page covering AI tool classification, bot
filtering, hero interpretations, and the three repo-mode scenarios.
Wires it into the VitePress sidebar. Required precursor to setting
docsPath on the preset (next commit) per registry.test.ts DoD.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Registry update (gated on Task 16)

**Files:**
- Modify: `apps/web/src/presets/registry.ts`

**Context:** This is the integration step. Wire the new viz IDs and tab IDs into the preset, set `docsPath`, update the sidebar label.

- [ ] **Step 1: Update the `co-authors` preset**

Edit `apps/web/src/presets/registry.ts`. Find the `co-authors` entry. Replace with:

```ts
'co-authors': {
  id: 'co-authors',                              // unchanged — registry key stays
  tier: 'analyzer',
  label: 'Co-Authors / AI',                      // RENAMED from 'Co-Authors'
  group: 'team-activity',
  hero: {
    defaultViz: 'ai-adoption',                   // NEW
    altTabs: ['per-author-ai-mix', 'co-author-graph'],
  },
  bottomPanel: {
    defaultTab: 'co-authors-ai-adoption',
    altTabs: ['co-authors-ai-adoption', 'co-authors-pairs'],
  },
  metrics: coAuthorsMetrics,
  docsPath: 'analyzers/co-authors',              // NEW — surfaces Docs ↗ link
},
```

- [ ] **Step 2: Wire viz ID → component mapping**

Find where hero viz IDs are mapped to components (likely a `vizComponents` map or similar in the registry or layout). Add:

```ts
'ai-adoption': AiAdoptionTrend,
'per-author-ai-mix': PerAuthorAiMix,
'co-author-graph': AuthorForceGraph,  // already wired; ensure ID matches
```

Drop any old `'co-author-graph'` ID variant (e.g. `'repository-map'`) if one existed.

Update imports at the top of the file.

- [ ] **Step 3: Run the registry test**

Run: `pnpm --filter @gitrelic/web test --run "presets/registry"`
Expected: PASS — `docsPath` matches the existing docs page; viz IDs resolve to components.

If `registry.test.ts` fails with `docs file not found`: Task 16 didn't land or the path is wrong. Verify `apps/docs/analyzers/co-authors.md` exists.

- [ ] **Step 4: Run all web tests**

Run: `pnpm --filter @gitrelic/web test --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/presets/registry.ts
git commit -m "$(cat <<'EOF'
feat(web): wire Co-Authors / AI registry — new heroes, tabs, docs

Updates the co-authors preset:
- Sidebar label: 'Co-Authors' → 'Co-Authors / AI'
- Default hero: ai-adoption (AiAdoptionTrend)
- Alt heroes: per-author-ai-mix, co-author-graph (renamed from
  'Repository Map')
- Default bottom-panel tab: co-authors-ai-adoption
- Alt bottom-panel tab: co-authors-pairs
- docsPath: 'analyzers/co-authors' — surfaces Docs ↗ link

Registry key 'co-authors' unchanged → existing deep-links still work.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Final smoke + update polish-pattern.md

**Files:**
- Modify: `docs/polish-pattern.md`

**Context:** Final eyeball pass on real data, then move co-author from "Pending" to "Mapped" in the pattern doc.

- [ ] **Step 1: Build everything**

Run: `pnpm build`
Expected: Core, web, and CLI build successfully.

- [ ] **Step 2: Smoke against GitRelic itself (Scenario 3)**

Run: `node apps/cli/dist/index.mjs --path . --web`

Open the served URL. Click `Co-Authors / AI` in the sidebar. Verify:

- Sidebar label reads `Co-Authors / AI` (with `/AI` divider)
- Metrics strip: 5 slots, slot 1 shows ~58% AI Adoption, slot 4 shows ~0 Human Pairs
- Default hero: AI Adoption Trend with rich AI bars across recent months
- Alt hero: Per-Author AI Mix shows Dan / Lasercobra / Agentvortex with high `personalRatio`
- Alt-alt hero: Co-Author Graph shows the star pattern around Claude, classification colors, no `semantic-release-bot` node
- Default bottom-panel tab (AI Adoption): big number ~58%, `High Adoption` accent badge, top-3 humans, B + A subline, bot footnote
- Alt bottom-panel tab (Co-Author Pairs): table with `[AI]` badges
- See-also footer links to Contributors and Parallel Dev
- `Docs ↗` link renders in the tab bar

- [ ] **Step 3: Smoke against React (Scenario 2)**

Run: `node apps/cli/dist/index.mjs --path ~/Desktop/react --web`

Click `Co-Authors / AI`. Verify:

- Big number shows `0%` with `No Adoption Yet` (neutral, not red) badge
- Trend hero shows pure-human bars across months (no AI segment)
- Per-Author AI Mix shows top human authors, all 0% AI
- Co-Author Graph renders the human pair network without AI nodes
- Pair table shows all `[Human]` badges

- [ ] **Step 4: Smoke against a small repo with no trailers (Scenario 1)**

Pick a small private repo without `Co-Authored-By` history. Run gitrelic against it. Verify:

- Big number shows `—` with `No Co-Author Data` neutral badge
- Scenario 1 copy renders ("This codebase doesn't use Co-Authored-By trailers...")
- Trend hero shows empty-state placeholder
- Pair table empty placeholder

- [ ] **Step 5: Update `docs/polish-pattern.md`**

Edit the file:

1. Find the `## Pending (Batches 2–N)` section's table. Remove the `co-author` row.
2. Find the existing per-analyzer mapped sections (after `### contributors`). Add a new section:

```markdown
### `co-authors` *(shipped — RELIC-320)*

- **Reframe:** Lead question shifted from "who collaborates with whom?" to "how is AI assistance and human collaboration showing up in this codebase?" Sidebar label: `Co-Authors` → `Co-Authors / AI`.
- **Hero:** **3 tabs** — `AI Adoption` (default, 2-stack monthly trend) · `Per-Author AI Mix` (alt, horizontal AI/solo bars per human) · `Co-Author Graph` (alt-alt, polished force graph). First analyzer in the polish initiative with 3 hero tabs — justified by 3 distinct audiences (manager / engineer / advanced).
- **Bottom panel:** **2 tabs** — `AI Adoption` (default, narrative-KPI form) + `Co-Author Pairs` (alt, classified table). Splits along audience axis (adoption vs collaboration), like Churn's source-vs-test split (RELIC-303) but along audience.
- **Big number:** `aiAdoptionPercent` (B-formula: `aiAssistedCommits / humanAuthoredCommits`).
- **Tier thresholds:** 0% = `No Adoption Yet` · 1–19% = `Low` · 20–49% = `Moderate` · 50%+ = `High Adoption`. **Accent (informational) coloring**, not severity — adoption isn't risk-shaped.
- **Sub-content:** Top 3 humans by AI commit count (display names + `aiCommits` + `personalRatio` tooltip). Subline carries B + A ratios side-by-side: `"234 AI-assisted commits · 47% of human work · 42% of all repo activity"`.
- **Bot/AI classification:** New shared util `packages/core/src/utils/authorClassification.ts` — recognizes Claude / GitHub Copilot / Aider / Devin / Cursor as AI; semantic-release / dependabot / renovate / GitHub Actions as bots; everything else human. Bots stripped from analysis with a transparent footnote (`"N bot-authored commits filtered"`). Util location chosen so Contributors can adopt it later (separate ticket).
- **Metrics strip:** Slot 1 `AI Adoption %` (matches panel tier) · Slot 2 `AI Commits` · Slot 3 `AI Authors` · Slot 4 `Human Pairs` · Slot 5 `Co-Author Commits`. **Two-state coloring** (stale / coupling) — adoption is informational, no severity-red anywhere.
- **See also:** Contributors, Parallel Dev. Sticky to bottom of panel. Completes the Team & Activity collaboration triangle (totals / observed / attributed).
- **Backend changes:**
  - New `authorClassification` util.
  - New `RawCommit.coAuthors` field with git's native `%(trailers:...)` parser (data-layer fix; co-author was *empty* before this — trailers live in commit bodies, not subjects).
  - Many new aggregates on `CoAuthorReport`: `aiAssistedCommits`, `humanAuthoredCommits`, `aiAdoptionPercent`, `aiAdoptionTier`, `aiAuthors`, `humanPairs`, `filteredBotCommits`, `byMonth`, `perAuthorMix`. `pairs` field semantics narrow — bots filtered. `CoAuthorPair` gains `classification: 'human-pair' | 'human-ai'`.
  - AI-as-primary-author edge case (Devin commits) excluded from human denominator.
- **Removes:** `Pairs` / `Co-commits` / `Collaborators` / `Avg Commits/Pair` / `Top Pair Commits` metrics-strip slots; old `CoAuthorsTab.tsx` (replaced by 2 new tabs); `Repository Map` viz label string (force graph renamed to `Co-Author Graph`).
- **Pre-1.0 versioning note:** ships as `feat:` (minor bump). Sidebar deep-link `'co-authors'` unchanged. No breaking change to public API.
```

3. Add the one-line note in a new `## When to deviate from "default to 1–2 hero tabs"` subsection (or somewhere sensible near "Bottom-panel forms"):

```markdown
**Hero tab count is not fixed.** Most polished analyzers have 1–2 hero tabs; some have 3 when 3 distinct questions warrant it (e.g., Co-Authors / AI). Don't pad to 3 if 2 are enough; the bar is "does each tab answer a distinct question?"
```

- [ ] **Step 6: Commit**

```bash
git add docs/polish-pattern.md
git commit -m "$(cat <<'EOF'
docs(polish-pattern): move co-authors from Pending to Mapped

Captures the RELIC-320 polish: 3 hero tabs (departure from precedent),
2 bottom-panel tabs along audience axis, AI/bot classification util
shared with Contributors (later), accent (not severity) tier coloring
for adoption, B-formula headline with A-comparison subline. Adds a
note that 3 hero tabs is fine when 3 distinct questions warrant it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review pass

After completing all 18 tasks, run a final verification:

- [ ] **All tests pass**

Run: `pnpm test`
Expected: 312+ core tests, 716+ web tests, all green.

- [ ] **All builds succeed**

Run: `pnpm build && pnpm docs:build`
Expected: All workspaces build cleanly.

- [ ] **Linting clean**

Run: `pnpm lint && pnpm format:check`
Expected: No errors.

- [ ] **`docsPath` invariant**

Run: `pnpm --filter @gitrelic/web test --run "presets/registry"`
Expected: PASS — registry's docsPath assertion is satisfied (file exists on disk).

- [ ] **Bundled-deps mirror invariant** (CLI runtime parity)

Run: `pnpm --filter gitrelic build`
Expected: Build succeeds. The new `authorClassification.ts` is pure (no new runtime deps); no change to the bundled-deps mirror needed.

- [ ] **Pre-commit hooks haven't been bypassed**

Inspect `git log --oneline -20` — no `--no-verify` traces, all commits have the standard `Co-Authored-By:` trailer.

If anything fails: investigate root cause, fix, recommit. Do not skip CI gates.
