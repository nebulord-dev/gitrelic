# Co-Authors / AI Polish — Design

> **Linear:** [RELIC-320](https://linear.app/nebulord/issue/RELIC-320)
> **Pattern doc:** [`docs/polish-pattern.md`](../../polish-pattern.md) — co-author entry under "Pending (Batches 2–N)" gets updated when this ships.
> **Status:** Approved by Dan, ready for implementation plan.

## Summary

Polish the Co-Author analyzer in the GitRelic web view. Reframe the lead question from *"who collaborates with whom?"* to *"how is AI assistance and human collaboration showing up in this codebase?"* Rename the sidebar entry to **"Co-Authors / AI"**. Replace the single force-graph hero with a 3-tab hero structure (`AI Adoption` trend default · `Per-Author AI Mix` alt · polished `Co-Author Graph` alt-alt). Replace the bottom-panel pair table with a 2-tab structure (`AI Adoption` narrative-KPI default · `Co-Author Pairs` classified table alt). Add a shared `authorClassification` utility that flags AI-assistant and bot emails. Strip bot-authored commits from analysis with a transparent footnote. Retune the 5-slot metrics strip to surface AI adoption + human-pair signals using **accent (informational)** rather than **severity (risk)** colors — AI adoption isn't risk-shaped. Ship the docs page.

The framing the polish locks: **Co-Authors / AI = the AI-and-human-pairing slice of team activity**. The story it tells: *"a non-trivial fraction of work in modern repos is AI-assisted; this analyzer surfaces both that fraction AND the explicit human↔human pair-programming sub-story, classified honestly."* Distinct from Contributors (per-author totals) and Parallel Dev (concurrent file work) — co-author measures *explicit credit attribution*, not observation of overlap.

## Why this scope

The current Co-Author tab ships:

- **Single hero** — `AuthorForceGraph` (force-directed network of co-author pairs), labeled "Repository Map" (misleading — not a repo map)
- **Metrics strip** — `Pairs / Co-commits / Collaborators / Avg Commits/Pair / Top Pair Commits` (all generic counts, none health- or adoption-tiered)
- **Bottom panel** — `SortableTable` of pair · co-commits · shared files
- **Until 2026-05-04** — was completely empty on every repo because of an upstream `git log` bug. `Co-authored-by:` trailers live in commit bodies, but `getAllCommits` was capturing only `%s` (subject). Fixed in the working tree of this branch (uncommitted at spec-write time): the `--format` string now includes `TRAILERS|%(trailers:key=Co-authored-by,valueonly,separator=%x1F)`, `parseGitLog` parses the new line, and `RawCommit` gains a `coAuthors: CoAuthor[]` field. The fix lands in the same PR as the polish.

A forensic look at the rendered tab against two real repos surfaced six problems:

1. **The analyzer runs in two visually different modes that the design doesn't acknowledge.** On GitRelic (AI-dominant): 5 pairs / 231 co-commits — but the force graph is a star with `noreply@anthropic.com` at the center; ~98% of co-commits go through Claude. On React (human-pair): 47 pairs / 55 co-commits / 0 AI. Same metrics strip, same hero, two completely different stories — neither honestly told.
2. **The force graph is confusing even to the *author* of the tool.** Edge labels like "1 partner" are unintuitive; readability collapses on small networks (degenerate star) and large ones (hairball). Same "redundant alts" pathology Bus Factor (RELIC-304) and Blast Radius (RELIC-315) fixed — except here the **default** hero has the readability problem, not just an alt.
3. **Bot pollution.** `semantic-release-bot` shows up as a "collaborator" — meaningless for the question the analyzer is asking. Same noise problem in the Contributors analyzer (separate ticket — see Out of scope).
4. **No AI awareness.** The 2026-era reality is that a growing share of `Co-authored-by` trailers credit AI tools (Claude, Copilot, Aider, Devin). On GitRelic, ~98% of co-author trailers credit Claude. The analyzer treats AI tools identically to human collaborators — flattening the most distinctive modern signal into a generic "pairs" framing.
5. **Pair table rotates the hero.** Per polish-pattern.md, "table is rotated hero" is the canonical pathology calling for replacement. Each row is `Pair · Co-Commits · Shared Files` — same data the force graph shows, just sorted differently. On AI-dominant repos it's worse: 4 of 5 rows are `Human ↔ Claude` repeated. No third dimension.
6. **Email aliasing leaks through.** On React, Sebastian Silbermann appears as both `sebastian.silbermann@vercel.com` and `silbermann.sebastian@gmail.com` — the same person counted as two collaborators. Contributors has display-name disambiguation logic; co-author re-derives from raw emails and inherits the problem.

The reframe to **"AI Adoption + Human Pairs"** turns "this tab is degenerate on AI-dominant repos" into "this tab tells you something only GitRelic notices." It's the polish initiative's actual goal — the analyzer earning its space by answering a question nothing else on the dashboard answers.

## Out of scope

- **Contributors bot pollution fix.** The new `authorClassification` utility makes the Contributors `Active Contributors` / metrics-strip fix a 5-line change, but it's a *separate ticket*. This polish ships the util in a location that lets Contributors adopt it later without re-shaping it.
- **GitHub API integration for PR-level AI attribution.** Pure-git constitution preserved (per CLAUDE.md "Data source"). PR-level data (review comments, CI status, time-to-merge) lives outside git and would require auth tokens, rate limits, and GitHub-specificity. Future opt-in `gitrelic --github` mode if asked, not in scope here.
- **"Show bots" UI toggle.** YAGNI for v1. Bots are stripped by default; the panel footnote line says `"N bot-authored commits filtered (semantic-release, dependabot, etc.)"` — that's the transparency mechanism. Ship the toggle if users complain.
- **Inspector per-author / per-pair drill-down.** The current Inspector is per-file. Co-Author has no per-file granularity to add; per-author drill-down would be a new Inspector tab. Future enhancement, not in scope.
- **Configurable AI/bot allowlist.** Hard-coded patterns in the util. Adding new tools = a PR. Config-file override is YAGNI.
- **Renaming `noreply@anthropic.com` → "Claude" in the force graph specifically.** Display names come from the contributors map (per RELIC-306), and AI assistants don't have entries there. The classification util provides a `displayName(email)` helper that maps known AI emails → product names ("Claude", "Copilot", etc.) for label rendering, falling back to the contributors map and then to email. This *is* in scope — the per-author display naming for AI is part of making the polished force graph readable.
- **`AuthorForceGraph` deletion.** Considered (per Q5 deliberation) and rejected: the docs site explains how to read the topology view, the cleanups make it meaningfully more readable, and the third hero tab is genuine power-user value. Component stays, polished — see Hero detail.

## Architecture

### Lead reframe — preset metadata and label

**`apps/web/src/presets/registry.ts`** — `co-authors` entry:

```ts
'co-authors': {
  id: 'co-authors',                                    // unchanged — registry key stays for deep-link compat
  tier: 'analyzer',
  label: 'Co-Authors / AI',                            // RENAMED — was 'Co-Authors'
  group: 'team-activity',
  hero: {
    defaultViz: 'ai-adoption',                         // NEW
    altTabs: ['per-author-ai-mix', 'co-author-graph'], // NEW shape — 3 hero tabs total
  },
  bottomPanel: {
    defaultTab: 'co-authors-ai-adoption',              // NEW narrative-KPI tab
    altTabs: ['co-authors-ai-adoption', 'co-authors-pairs'], // NEW table tab
  },
  metrics: coAuthorsMetrics,
  docsPath: 'analyzers/co-authors',                    // NEW — surfaces Docs ↗ link
},
```

The registry key `'co-authors'` is **unchanged** — sidebar deep-links and routing stay valid. Only the human-readable label updates.

### Classification utility — `packages/core/src/utils/authorClassification.ts` (NEW)

The shared infrastructure piece that fixes bot/AI awareness across the codebase. Lives in `core/utils` (not `analyzers/`) so Contributors can adopt it later without depending on the co-author analyzer.

```ts
export type AuthorClass = 'human' | 'ai' | 'bot';

interface AuthorClassificationEntry {
  pattern: RegExp | string;          // exact email or regex
  class: 'ai' | 'bot';
  productName?: string;              // display label override, e.g. "Claude"
}

const AI_PATTERNS: AuthorClassificationEntry[] = [
  { pattern: 'noreply@anthropic.com', class: 'ai', productName: 'Claude' },
  { pattern: /^copilot(\[bot\])?@.*\.noreply\.github\.com$/i, class: 'ai', productName: 'GitHub Copilot' },
  { pattern: 'aider@aider.chat', class: 'ai', productName: 'Aider' },
  { pattern: /^devin-ai-integration\[bot\]@.*\.noreply\.github\.com$/i, class: 'ai', productName: 'Devin' },
  { pattern: /@cursor\.sh$/i, class: 'ai', productName: 'Cursor' },
  // Generic fallback for future AI-tool conventions
  { pattern: /^[^@]*ai[^@]*\[bot\]@/i, class: 'ai' },
];

const BOT_PATTERNS: AuthorClassificationEntry[] = [
  { pattern: /^dependabot.*@/i, class: 'bot' },
  { pattern: /^renovate.*@/i, class: 'bot' },
  { pattern: /^semantic-release.*@/i, class: 'bot' },
  // Catch-all: GitHub bot accounts that survived the AI filter above
  { pattern: /\[bot\]@users\.noreply\.github\.com$/i, class: 'bot' },
];

export function classifyAuthor(email: string): AuthorClass;
export function isAiEmail(email: string): boolean;
export function isBotEmail(email: string): boolean;
export function aiProductName(email: string): string | null;  // returns "Claude" / "Copilot" etc., or null for humans/bots
```

Pure functions, no analyzer-specific state. Order of evaluation: AI patterns first (so `dependabot-ai[bot]@*` would classify as AI, not bot — the more specific match wins). The `\[bot\]@users.noreply.github.com$` catch-all is intentionally broad for unknown future bots.

### Backend additions — `packages/core/src/analyzers/co-author.ts`

The analyzer continues to consume `commit.coAuthors` (recently-fixed data layer) and gains classification logic + new aggregates.

```ts
import { classifyAuthor, isAiEmail, isBotEmail } from '../utils/authorClassification.js';

export function analyzeCoAuthors(commits: RawCommit[]): CoAuthorReport {
  // Filter bot-authored commits OUT of the entire analysis.
  // Footnote count is reported separately for transparency.
  const filteredBotCommits = commits.filter((c) => isBotEmail(c.authorEmail)).length;
  const humanAuthorOrAiAssistedCommits = commits.filter((c) => !isBotEmail(c.authorEmail));

  let aiAssistedCommits = 0;
  let humanAuthoredCommits = 0;

  for (const commit of humanAuthorOrAiAssistedCommits) {
    if (isAiEmail(commit.authorEmail)) continue;  // AI-as-primary-author edge case (rare; e.g. Devin commits) — exclude from human denominator
    humanAuthoredCommits++;

    const hasAiCoAuthor = commit.coAuthors.some((c) => isAiEmail(c.email));
    if (hasAiCoAuthor) aiAssistedCommits++;

    // ... pair-graph accumulation (existing logic) ...
  }

  // Compute pair-graph with classification per pair.
  // Filter bot edges out before reporting; track total filtered for the footnote.

  // ... derive per-author AI mix, monthly aggregates, etc.
}
```

The pair-classification logic per pair: `pair.classification = 'human-ai'` if either endpoint is AI, `'bot-involved'` if either is a bot (excluded from `pairs` after classification), else `'human-pair'`.

### Type additions — `packages/core/src/types.ts`

```ts
export type AdoptionTier = 'none' | 'low' | 'moderate' | 'high';

export interface AiAuthorStat {
  author: string;             // email (lowercased)
  displayName: string;        // resolved via contributors map, falls back to email
  aiCommits: number;          // commits authored by this human with AI co-author
  totalCommits: number;       // all commits authored by this human in window
  personalRatio: number;      // 0–100, aiCommits / totalCommits
}

export interface PerAuthorMixEntry {
  author: string;
  displayName: string;
  aiCommits: number;
  soloCommits: number;
  totalCommits: number;
  personalRatio: number;      // 0–100
}

export interface CoAuthorMonthEntry {
  month: string;              // ISO `YYYY-MM`
  aiAssisted: number;
  pureHuman: number;
  total: number;              // aiAssisted + pureHuman
}

export interface CoAuthorPair {
  // existing
  authorA: string;
  authorB: string;
  coAuthoredCommits: number;
  files: string[];
  // NEW
  classification: 'human-pair' | 'human-ai';   // 'bot-involved' is filtered out before this struct exists
}

export interface CoAuthorReport {
  // existing — semantics shift (bots filtered, humanPairs is a strict subset of pairs)
  pairs: CoAuthorPair[];               // human-pair + human-ai (no bot-involved)
  authorStats: CoAuthorStats[];
  totalCoAuthoredCommits: number;
  summary: string;

  // NEW
  aiAssistedCommits: number;
  humanAuthoredCommits: number;        // denominator for B%
  aiAdoptionPercent: number;           // 0–100 (B-formula: aiAssistedCommits / humanAuthoredCommits)
  aiAdoptionTier: AdoptionTier;
  aiAuthors: AiAuthorStat[];           // sorted desc by aiCommits, includes humans with personalRatio > 0 only
  humanPairs: CoAuthorPair[];          // strict subset of pairs filtered to human-pair only
  filteredBotCommits: number;          // for the panel footnote
  byMonth: CoAuthorMonthEntry[];       // for the trend hero
  perAuthorMix: PerAuthorMixEntry[];   // for the per-author hero, sorted desc by personalRatio
}
```

Pure-addition for new fields. Existing `pairs` field semantics narrow (bots filtered) — this is a behavior change but the field type is unchanged and the ordering is still desc by `coAuthoredCommits`. `summary` text updates to mention AI adoption.

### Adoption tier thresholds

```ts
function adoptionTier(percent: number): AdoptionTier {
  if (percent === 0) return 'none';
  if (percent < 20) return 'low';
  if (percent < 50) return 'moderate';
  return 'high';
}
```

Boundaries chosen to match informal industry framing (low <20%, moderate 20–50%, high 50%+). The bands use **accent colors** (`accent-coupling-bg/text` family or similar) — *not* severity. AI adoption is informational, not risk-shaped.

### Cross-analyzer downstream

- **`packages/core/src/analyzers/cursed-files.ts`** — does **not** consume `CoAuthorReport`. No downstream effect.
- **`apps/web/src/utils/normalizeReport.ts`** — per-field defaults for the new `CoAuthorReport` fields (`aiAssistedCommits: 0`, `humanAuthoredCommits: 0`, `aiAdoptionPercent: 0`, `aiAdoptionTier: 'none'`, `aiAuthors: []`, `humanPairs: []`, `filteredBotCommits: 0`, `byMonth: []`, `perAuthorMix: []`) so old report JSON loads cleanly. The existing `pairs` slice is kept; the rest are pure-additions defaulting to empty/zero.
- **`packages/core/src/__snapshots__/fixture-regression.test.ts.snap`** — regenerates: co-author slice gains the new aggregate fields. The fixture sample-repo (`tests/fixtures/build-sample-repo.sh`) has zero `Co-authored-by:` trailers, so all new aggregates default to 0/empty/`'none'`. Snapshot diff is pure-addition.

### Frontend-derived aggregators

Following the `topDominantOwners.ts` (Bus Factor) / `blastByDirectory.ts` (Blast Radius) precedent:

- **`apps/web/src/utils/topAiUsers.ts`** *(NEW)* — top-N humans from `report.coAuthors.aiAuthors`, resolves display names via the contributors map with email fallback. Consumed by the panel's top-3 sub-finding. Tie-break: by `personalRatio` desc, then alphabetical.
- **`apps/web/src/utils/aiAdoptionByMonth.ts`** *(NEW)* — passthrough/normalizer for `report.coAuthors.byMonth` to the trend hero's data shape (handles empty windows by emitting an empty array; the hero renders an empty-state placeholder).
- **`apps/web/src/utils/perAuthorAiMix.ts`** *(NEW)* — top-N selection from `report.coAuthors.perAuthorMix` with the cap rule: top 20 humans by `totalCommits` *unioned with* all humans where `personalRatio > 0`, hard-capped at 30. Sorted desc by `personalRatio`. Consumed by `PerAuthorAiMix` hero.

These could in principle live in core, but per polish-pattern.md ("frontend-derived aggregators") they're presentation-layer transforms — top-N caps, display-name resolution, emptiness handling. Keeping them in `apps/web/src/utils/` matches the established pattern.

### Hero scope — registry change

| Slot | After | Before |
|---|---|---|
| Default | `ai-adoption` *(NEW — `AiAdoptionTrend`)* | `co-author-graph` (`AuthorForceGraph` labeled "Repository Map") |
| Alt | `per-author-ai-mix` *(NEW — `PerAuthorAiMix`)* | *(none — single hero)* |
| Alt-alt | `co-author-graph` *(polished `AuthorForceGraph`)* | *(was the default; demoted)* |

Three hero tabs is **a deliberate departure from polish-initiative precedent** (most analyzers have 1–2 hero tabs). The justification: Co-Authors / AI genuinely answers three different questions for three different audiences (manager, engineer, advanced) — see Hero detail. polish-pattern.md gets a one-line update post-ship to acknowledge "if you have 3 distinct questions, 3 tabs is fine; if you have 2, don't pad to 3."

## Hero detail

### `AiAdoptionTrend` (default, NEW)

**File:** `apps/web/src/components/hero/AiAdoptionTrend.tsx`

Stacked bar by ISO month. Two layers per bar:

- **AI-assisted** (top layer) — `aiAssisted` count per month, accent-strong color (e.g. `bg-accent-coupling-bg`)
- **Pure-human** (bottom layer) — `pureHuman` count per month, neutral color

X-axis: months in the analysis window (`byMonth[].month`). Y-axis: total commits (sum of layers). Bars sum cleanly to total `humanAuthoredCommits` per month.

**HeroCaption** (one-liner): `"monthly stacked bars · top layer = AI-assisted commits · bottom = pure-human · log scale off (linear)"`.

**Empty state:** when `byMonth.length === 0` (no co-authors at all in window): renders a placeholder card with the empty-state copy from the panel's Scenario 1 + a faint zero-line baseline.

**Component model:** mirror `ShameTrend` / `StressTrend` / `ParallelTimeline` 1:1 (these are the precedent disjoint-time-series hero components). The fifth such hero in the polish initiative.

### `PerAuthorAiMix` (alt, NEW)

**File:** `apps/web/src/components/hero/PerAuthorAiMix.tsx`

Horizontal bar chart, one row per human author. Each bar segment-stacked: `aiCommits` (accent-strong) + `soloCommits` (neutral). Sorted desc by `personalRatio`. Capped via the `perAuthorAiMix.ts` aggregator (top 20 by total commits ∪ all AI users, max 30).

Each row label: `displayName` (full name, never truncated to first-name-only — same naming convention as Ghost Files). Each bar's right side: `personalRatio%` rendered in mono, severity-neutral color.

**HeroCaption:** `"horizontal bars · one row per human · segment width = commit count · split by AI-assisted vs solo"`.

**Empty state:** when `perAuthorMix.length === 0`: empty-state card. When `perAuthorMix.length > 0` but no rows have `aiCommits > 0` (e.g. React): renders the bars at full neutral, top-3 most-active humans visible — answers "who's active here?" even when AI use is zero.

### `CoAuthorGraph` (alt-alt, polished `AuthorForceGraph`)

**File:** `apps/web/src/components/hero/AuthorForceGraph.tsx` (existing, polished — not deleted)

Six improvements applied:

1. **Section header rename** — registry preset's `viz` label changes from `"Repository Map"` → `"Co-Author Graph"`. The current header is misleading (not a repo map).
2. **Classification colors.** Each node colored by `classifyAuthor(email)` result: AI nodes in `accent-coupling-text` (matches the tier colors; consistent with the trend-hero AI segment), human nodes in their existing per-author hash color, bot nodes filtered out entirely (per Q2 decision).
3. **Edge filter.** Pairs with `coAuthoredCommits === 1` are hidden by default — single-commit edges are mostly release-attribution noise on AI-dominant repos and PR-noise on human-pair repos. Hidden-edge count surfaced in the HeroCaption.
4. **Display-name labels.** Replace email rendering on nodes with `displayName` lookup (contributors map first, then `aiProductName(email)` for AI accounts, then email fallback). So Claude renders as "Claude", Copilot as "GitHub Copilot", and human nodes use full names — same convention Ghost Files / Contributors locked in (RELIC-306, RELIC-318).
5. **Improved tooltips.** Edge hover: `"<displayA> ↔ <displayB> · N co-commits · K shared files · <classification badge>"`. Node hover: `"<displayName> · <classification> · N co-authored commits · K partners"` (replaces the cryptic "1 partner" label users found confusing).
6. **HeroCaption strip** — `"force-directed network · circles = co-authors (size = co-commit volume) · edges = shared commits · single-commit pairs hidden (M filtered)"`. Wires through to the docs link.

The `authorGraph.ts` data-derivation utility is updated to consume the classified `pairs` array (which already has bots filtered upstream); the component itself stays at ~the same line count.

## Bottom-panel detail

### Tab 1: `AI Adoption` (default, narrative-KPI)

**`apps/web/src/components/tabs/CoAuthorsAiAdoptionTab.tsx`** *(NEW)* — mirrors `BlastRadiusTab` / `KnowledgeSilosTab` shape with extras-slot:

```tsx
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { topAiUsers } from '../../utils/topAiUsers';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

interface CoAuthorsAiAdoptionTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

function adoptionTierBadge(tier: AdoptionTier): { variant: BadgeVariant; label: string } {
  // Maps to ACCENT variants, not severity. Renders accent-coupling family.
  switch (tier) {
    case 'none':     return { variant: 'stale',           label: 'No Adoption Yet' };
    case 'low':      return { variant: 'accent-soft',     label: 'Low Adoption' };
    case 'moderate': return { variant: 'accent-medium',   label: 'Moderate Adoption' };
    case 'high':     return { variant: 'accent-strong',   label: 'High Adoption' };
  }
}

export function CoAuthorsAiAdoptionTab({ report, onApplyPreset }: CoAuthorsAiAdoptionTabProps) {
  const ca = report.coAuthors;
  const tier = adoptionTierBadge(ca.aiAdoptionTier);
  const topUsers = topAiUsers(ca.aiAuthors, report.contributors.contributors, 3);

  // Scenario detection per Q6 — see Empty / small / huge repo states.
  const scenario =
    ca.totalCoAuthoredCommits === 0 ? 'no-trailers' :
    ca.aiAssistedCommits === 0 ? 'no-ai' :
    'standard';

  return (
    <NarrativeKPI
      bigNumber={scenario === 'no-trailers' ? '—' : `${ca.aiAdoptionPercent}%`}
      tier={tier}
      metric="AI ADOPTION"
      finding={
        scenario === 'standard'
          ? <TopAiUsersList users={topUsers} />
          : <EmptyStateCopy scenario={scenario} report={report} />
      }
      subline={<AdoptionSubline report={report} scenario={scenario} />}
      extras={
        ca.filteredBotCommits > 0
          ? <BotFilterFootnote count={ca.filteredBotCommits} />
          : undefined
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

`<TopAiUsersList>`, `<EmptyStateCopy>`, `<AdoptionSubline>`, `<BotFilterFootnote>` are file-local subcomponents (mirror `BlastRadiusTab` pattern).

**Subline copy in standard scenario:**
```
234 AI-assisted commits · 47% of human work · 42% of all repo activity (incl. bots)
```

`AdoptionSubline` formats both ratios on one line. Numbers in mono font for scannability — same convention as Ghost Files / Blast Radius sublines.

**`BotFilterFootnote`:**
```
N bot-authored commits filtered (semantic-release, dependabot, etc.)
```
Rendered as a small grey line beneath the see-also footer, not in the see-also area itself. Only renders when `filteredBotCommits > 0`.

**Adoption tier badge variants** — the existing `BadgeVariant` token system already covers what we need: `stale` (neutral grey) for the `none` tier; `coupling` (existing accent informational color) for `low` / `moderate` / `high`. The badge **label** carries the tier differentiation (`No Adoption Yet` / `Low Adoption` / `Moderate Adoption` / `High Adoption`); the **color** stays consistent across non-zero adoption. No new badge variants needed — this is a deliberate YAGNI decision: differentiating the four tiers visually with separate colors implies risk-grading, which adoption explicitly is not.

### Tab 2: `Co-Author Pairs` (alt, classified table)

**`apps/web/src/components/tabs/CoAuthorsPairsTab.tsx`** *(NEW)* — sortable table:

| Column | Source |
|---|---|
| Pair | `<displayA> ↔ <displayB>` (display-names resolved per RELIC-306 convention) |
| Type | Classification badge: `[AI]` accent-coupling tint, `[Human]` neutral. (`bot-involved` filtered out upstream — never rendered) |
| Co-Commits | `pair.coAuthoredCommits` (default sort, desc) |
| Shared Files | `pair.files.length` |

Sortable on Co-Commits and Shared Files columns. Default sort: Co-Commits desc.

`BotFilterFootnote` renders beneath this table too when applicable — the footnote is per-tab, not panel-global, so each tab's transparency landing is local.

**Empty state:** when `pairs.length === 0` (Scenario 1 — no trailers): table renders an empty placeholder with the same copy as the AI Adoption tab's empty state. When all pairs are AI (Scenario 3, GitRelic-style): table shows them honestly — every row is `Human ↔ Claude` with `[AI]` badge. Honest, not degenerate.

### Component reuse

The `<NarrativeKPI>` shared component already supports the panel structure (big number, finding, subline, extras, see-also). No new shared-component additions needed beyond the three new badge variants in `classMaps.ts`.

## Metrics strip retune

**`apps/web/src/presets/metrics/co-authors.ts`** — rewrite for 5 accent-tiered slots:

| Slot | Label | Value | Tier coloring | Source |
|---|---|---|---|---|
| 1 | **AI Adoption** | `${aiAdoptionPercent}%` | `0` stale · `>0` coupling | `aiAdoptionPercent` (matches panel tier badge) |
| 2 | **AI Commits** | `fmt(aiAssistedCommits)` | `0` stale · `>0` coupling | `aiAssistedCommits` |
| 3 | **AI Authors** | `fmt(aiAuthors.length)` | `0` stale · `>0` coupling | `aiAuthors.length` |
| 4 | **Human Pairs** | `fmt(humanPairs.length)` | `0` stale · `>0` coupling | `humanPairs.length` |
| 5 | **Co-Author Commits** | `fmt(totalCoAuthoredCommits)` | `0` stale · `>0` coupling | `totalCoAuthoredCommits` |

**Dropped:** `Pairs` (replaced by Human Pairs slot 4 — pair count after bot filter is the meaningful number), `Avg Commits/Pair` (statistical artifact, dilutes on long-tail repos like React's `1`), `Top Pair Commits` (per-pair maximum carries no narrative — the trend hero shows the temporal shape; the table shows per-pair detail).

**Tier rationale:** all five slots use the same two-state coloring (`stale` for zero, `coupling` for non-zero). Color signals "data exists / data absent"; the *value* differentiates magnitude. This is consistent with the panel tier badge approach — adoption isn't risk-shaped, so we don't grade with multi-band severity colors.

**No severity-red anywhere.** Per Q8 — AI adoption is informational, not risk-shaped. Color choices use the `accent-coupling` token family.

The retune mirrors the precedent set by Rewrite Ratio (`Files ≥70`), Parallel Dev (`High Parallel`), Commit Timing (`High Stress` / `Stressed Authors`), Contributors (`Top-3 Share` / `Newcomers`), and Ghost Files (`Ghost Owners` / `True Ghosts`) — replace shape-of-data counts with health-tiered (or here, adoption-tiered) counts.

## Web wiring

**`apps/web/src/components/layout/BottomPanel.tsx`** — wire `onApplyPreset` through to both new tabs (mirror how `KnowledgeSilosTab` / `GhostFilesTab` receive it).

**`apps/web/src/components/layout/Sidebar.tsx`** — sidebar label updates from `Co-Authors` to `Co-Authors / AI` automatically via the registry's `label` field. No code change required.

**`apps/web/src/utils/normalizeReport.ts`** — per-field defaults for the new `CoAuthorReport` fields so old report JSONs without these fields load cleanly.

## Empty / small / huge repo states

Three distinct scenarios, each with separate copy and tier badges. The `scenario` discriminator in `CoAuthorsAiAdoptionTab` selects the right rendering.

### Scenario 1: no Co-Authored-By trailers anywhere

**Trigger:** `totalCoAuthoredCommits === 0`.

- **Big number:** `—` (em-dash, neutral grey)
- **Tier badge:** `No Co-Author Data` (`stale` variant)
- **Finding copy:** *"This codebase doesn't use Co-Authored-By trailers. The analyzer surfaces explicit pair-programming and AI-assistance attribution — when present. Common in projects using GitHub-style PR workflows or AI tools like Claude Code."*
- **Subline:** *"0 co-authored commits across N total commits in window"*
- **Trend hero:** placeholder card explaining the empty data
- **Per-author hero:** standard mix rendering, all bars at 0% AI (still useful — shows commit volume)
- **Pair table:** empty placeholder

### Scenario 2: trailers present, zero AI

**Trigger:** `totalCoAuthoredCommits > 0 && aiAssistedCommits === 0`. (React.)

- **Big number:** `0%`
- **Tier badge:** `No Adoption Yet` (`stale` variant — neutral, *not red*)
- **Finding copy:** *"N co-authored commits across M pairs, none AI-assisted. This codebase uses co-author trailers for human collaboration only."*
- **Subline:** *"0 AI-assisted commits · N human pair-commits · K collaborators"*
- **Trend hero:** flat zero on AI segment, full bars on pure-human (truly informative — shows pair-programming volume)
- **Per-author hero:** rich bars, all 0% AI ratio, sorted by total commits desc
- **Pair table:** rich human-pair data, all `[Human]` badges

### Scenario 3: AI-only mode

**Trigger:** `aiAssistedCommits > 0`. (GitRelic.)

- Standard rendering across all surfaces. Tab 2 pair table shows `[Human ↔ AI]` rows honestly.
- Per Q2: bots filtered upstream; footnote acknowledges the filter.

### Performance considerations

- **Trend hero** — `byMonth` array is bounded by analysis-window months (typically <60). Bars render as plain SVG `<rect>` elements; no virtualization needed.
- **Per-author hero** — capped at 30 rows by aggregator. No virtualization needed.
- **Pair table** — `pairs` array can grow on very large repos. The table uses the existing `SortableTable` component, which already handles 1000+ rows via the established `apps/web/src/components/shared/SortableTable.tsx` pattern (no new perf work).
- **Force graph** — existing `AuthorForceGraph` already uses D3-force simulation, capped at the upstream pair count after bot+single-commit filter. No new perf concerns; the filter actually *reduces* node count vs before.

## Docs page — `apps/docs/analyzers/co-authors.md` (NEW)

Following the structure of `parallel-dev.md` / `commit-timing.md` / `contributors.md`:

1. **Frontmatter** — `title: Co-Authors / AI`, description emphasizing the dual lead question (AI adoption + human pair attribution).
2. **Intro paragraph** — what Co-Authors / AI measures (parses `Co-authored-by:` trailers, classifies into human / AI / bot, separates AI-adoption from human-pair stories), the question it answers ("how is AI assistance and human pairing showing up in this codebase?"), explicit contrast with Contributors (per-author totals) and Parallel Dev (concurrent file work).
3. **Quick read** — 10-second tour: metrics strip → 3 hero tabs → 2 bottom-panel tabs → Inspector. Screenshot placeholder.
4. **What counts as AI** — list of recognized AI tools (Claude / Copilot / Aider / Devin / Cursor) + the generic `*ai*[bot]@*` fallback. Explicit "if your tool isn't here, file an issue" note.
5. **What counts as a bot** — list of recognized bot patterns (semantic-release, dependabot, renovate, generic `[bot]@users.noreply.github.com`). Explicit "bots are stripped from analysis; the panel footnote tells you how many were filtered."
6. **The metrics strip** — 5-slot table with formulas + tier thresholds + worked examples on a hypothetical AI-using repo.
7. **Reading the AI Adoption hero** — what the stacked bars mean, what flat-zero means, what a hockey-stick means.
8. **Reading the Per-Author AI Mix hero** — what the bars and ratios show, why some authors might have 0% AI.
9. **Reading the Co-Author Graph hero** — explicit *"how to read this topology"* section. Edges, nodes, colors, single-commit edge filter. This is the docs page paying off Dan's "the docs site explains it" trade-off from Q5.
10. **AI Adoption vs Human Pairs** — explicit comparison table:
    | Question | Surface |
    |---|---|
    | Did we adopt AI? When? | AI Adoption hero (default) + slot 1 |
    | Who personally uses AI most? | Per-Author AI Mix hero (alt) + slot 3 |
    | Who pairs with whom? | Co-Author Graph hero (alt-alt) + Pairs table tab |
11. **Three repo modes the analyzer handles** — explicit walkthrough of Scenario 1 / Scenario 2 / Scenario 3 with what each surface shows in each mode.
12. **Limitations** — heuristic tool detection (new AI tools may not be classified); GitHub-flavored convention (some VCS platforms don't standardize trailers); branch-merging can drop trailers if PRs are squashed without preservation; rename-tracking not followed; the analyzer measures *credit*, not *coordination* (parallel-dev complements this).
13. **Related analyzers** — Contributors, Parallel Dev, Bus Factor (for context — pair work concentrates ownership).

**`apps/docs/.vitepress/config.ts`:**

- Update existing `{ text: 'Contributors', link: '/analyzers/contributors' }` group to add `{ text: 'Co-Authors / AI', link: '/analyzers/co-authors' }` — alphabetical position (after Coupling, before Commit Timing in the Team & Activity bucket of the sidebar).
- Remove `/analyzers/co-authors` from `ignoreDeadLinks` if present.

## Tests

| File | Coverage |
|---|---|
| `packages/core/src/utils/authorClassification.test.ts` *(NEW)* | Each AI pattern (Claude, Copilot, Aider, Devin, Cursor, generic `*ai*[bot]@*`) + each bot pattern (dependabot, renovate, semantic-release, generic `[bot]@users.noreply.github.com`) + human emails (`alice@example.com`, etc.). `aiProductName` returns correct product names for AI emails, null for humans/bots. Order-of-evaluation test: AI pattern wins when both could match (e.g., `dependabot-ai[bot]@users.noreply.github.com` → AI). |
| `packages/core/src/analyzers/co-author.test.ts` | Update existing 8 cases for new aggregates (`aiAssistedCommits`, `humanAuthoredCommits`, `aiAdoptionPercent`, `aiAdoptionTier`, etc.). Add: bot-author commit fully excluded (denominator + footnote count), AI-as-primary-author edge case (Devin commit) excluded from human denominator, pair classification (`'human-ai'` vs `'human-pair'`), `byMonth` aggregation across multi-month commits, `perAuthorMix` shape, `aiAuthors` filtering (only humans with `personalRatio > 0`), tier-threshold boundaries (`0` / `19.99` → `low` / `20` → `moderate` / `49.99` → `moderate` / `50` → `high`), Scenario 1 / 2 / 3 invariants. |
| `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` | Regenerates: co-author slice gains the new aggregate fields (all default 0/empty/`'none'` since the fixture has no trailers). Snapshot diff is pure-addition. |
| `apps/web/src/utils/topAiUsers.test.ts` *(NEW)* | Top-N selection by `aiCommits`, tie-break by `personalRatio` then alphabetical, display-name resolution from contributors map with email fallback when name is empty, empty input returns `[]`. |
| `apps/web/src/utils/aiAdoptionByMonth.test.ts` *(NEW)* | Passthrough behavior, empty `byMonth` returns empty array (no synthetic months), monotonic ISO month ordering preserved. |
| `apps/web/src/utils/perAuthorAiMix.test.ts` *(NEW)* | Cap rule: top 20 by `totalCommits` ∪ all `personalRatio > 0`, hard cap 30. Sort: `personalRatio` desc, ties broken by `totalCommits` desc then alphabetical. Empty input returns `[]`. |
| `apps/web/src/presets/metrics/co-authors.test.ts` | Update existing test for new 5-slot composition. Verify the two-state coloring (`stale` for zero, `coupling` for non-zero). Empty-repo defaults all `stale` variant. |
| `apps/web/src/components/tabs/CoAuthorsAiAdoptionTab.test.tsx` *(NEW)* | Renders `narrative-kpi-big-number` testid with adoption %; tier badge text matches band; top-3 finding renders display names (not emails); subline carries B + A ratios; sticky see-also footer fires `onApplyPreset` with `contributors` / `parallel-dev`; bot-filter footnote renders only when `filteredBotCommits > 0`; all three empty-state scenarios render correct copy. |
| `apps/web/src/components/tabs/CoAuthorsPairsTab.test.tsx` *(NEW)* | Renders rows with classification badges; default sort is co-commits desc; sortable columns toggle; empty state renders for `pairs.length === 0`; all-AI mode renders all `[Human ↔ AI]` rows; bot-filter footnote renders. |
| `apps/web/src/components/hero/AiAdoptionTrend.test.tsx` *(NEW)* | 2-stack rendering (top layer = AI segments, bottom = pure-human), monthly bars sum to total, empty-state placeholder when `byMonth.length === 0`, hero caption renders. |
| `apps/web/src/components/hero/PerAuthorAiMix.test.tsx` *(NEW)* | Bar segment-stacking (AI vs solo), display-name labels (no truncation), `personalRatio%` rendering, top-N cap behavior, empty-state placeholder, no-AI-but-data state (React mode) renders all 0% AI bars. |
| `apps/web/src/components/hero/AuthorForceGraph.test.tsx` | Update for classification colors, single-commit edge filter, display-name labels (Claude / Copilot rendered as product name; humans by display name; emails as fallback), bot-stripping, improved tooltips ("N partners" wording removed). |
| `apps/web/src/presets/registry.test.ts` | Existing DoD assertion auto-fails if `docsPath` set without docs file — satisfies itself once docs page lands. No new test needed. |

Per polish-pattern.md: tests follow existing patterns. No visual regression infra introduced.

## Removes

- `'Pairs'` / `'Co-commits'` / `'Collaborators'` / `'Avg Commits/Pair'` / `'Top Pair Commits'` slots from `apps/web/src/presets/metrics/co-authors.ts` — replaced by the 5 new slots.
- `'Repository Map'` viz label string — renamed to `'Co-Author Graph'`.
- `CoAuthorsTab.tsx`'s entire current `SortableTable` rendering (the existing tab is mostly the table) — replaced by the 2-tab structure.
- The `AuthorForceGraph`'s "1 partner" tooltip wording — replaced by improved tooltips per Hero detail #5.

No components deleted entirely. `AuthorForceGraph` and `authorGraph.ts` stay (polished).

## Versioning

Ships as `feat:` (minor bump per `.releaserc.json` pre-1.0 rule). The reframe is a **semantic narrowing of what the analyzer reports** (bots filtered out, classifications added) and an **expansion of what aggregates the report carries** (new fields). Old report JSONs without the new fields load cleanly via `normalizeReport.ts` per-field defaults — no breaking change for cached/persisted report files.

The `pairs` field semantic narrows (bots filtered) but the field type is unchanged. Sidebar deep-link `'co-authors'` stays valid (registry key unchanged). No `feat!:` trigger.

## Implementation order

1. **Classification utility** — `packages/core/src/utils/authorClassification.ts` + `authorClassification.test.ts`. Smallest, no analyzer/UI deps. Other steps build on this.
2. **Backend** — `types.ts` (new `AdoptionTier`, `AiAuthorStat`, `PerAuthorMixEntry`, `CoAuthorMonthEntry`, expanded `CoAuthorPair` + `CoAuthorReport`) + `co-author.ts` (classification consumption, bot filter, new aggregates, tier computation) + `co-author.test.ts` updates.
3. **Snapshot diff verification** — run `pnpm test:core`, regenerate `fixture-regression.test.ts.snap`, sanity-check the diff is pure-addition (the fixture has no trailers, so all new aggregates default to empty/zero/`'none'`).
4. **Frontend utils** — `topAiUsers.ts`, `aiAdoptionByMonth.ts`, `perAuthorAiMix.ts` + their tests.
5. **Heroes** — `AiAdoptionTrend.tsx` + `PerAuthorAiMix.tsx` (NEW) + their tests. Polish `AuthorForceGraph.tsx` (classification, edge filter, display names, tooltips, caption) + update its test.
6. **Tabs** — `CoAuthorsAiAdoptionTab.tsx` + `CoAuthorsPairsTab.tsx` (NEW) + their tests. `BottomPanel.tsx` wiring of `onApplyPreset` to both.
7. **Metrics composer** — rewrite `apps/web/src/presets/metrics/co-authors.ts` for the 5 new slots. Update its test.
8. **`normalizeReport.ts`** — per-field defaults for new `CoAuthorReport` fields. Update its test.
9. **Docs page** — `apps/docs/analyzers/co-authors.md` + sidebar entry + `ignoreDeadLinks` cleanup.
10. **Registry update** — flip `defaultViz`, populate `altTabs` with new IDs, **set `docsPath: 'analyzers/co-authors'`** (gated on step 9 — `registry.test.ts` fails CI otherwise), update `label` to `'Co-Authors / AI'`.
11. **Final smoke** — run `pnpm dev`, point CLI at GitRelic and React in sequence:
    - **GitRelic** (Scenario 3): metrics strip shows `~58% AI Adoption` slot 1, `~226 AI Commits` slot 2, panel shows `58%` big number with `High Adoption` accent badge, top-3 humans by AI commits, both ratio sublines, bot footnote renders, `Co-Author Graph` tab shows star pattern with classification colors.
    - **React** (Scenario 2): metrics strip shows `0% AI Adoption` stale slot 1, `0 AI Commits` slot 2, `~6 AI Authors` slot 3 (zero), `~47 Human Pairs` slot 4, panel shows `0%` big number with `No Adoption Yet` neutral badge, finding describes "0 AI-assisted commits across 47 human pairs", trend hero shows flat-zero AI layer with rich pure-human bars.
    - **A repo with no trailers at all** (Scenario 1, e.g., a small private project): big number `—`, `No Co-Author Data` neutral badge, scenario-1 copy renders, trend hero renders empty placeholder.
12. **Update `docs/polish-pattern.md`** — move co-author from "Pending (Batches 2–N)" to a new "Mapped" section. Add the one-line note that "3 hero tabs is fine when 3 distinct questions warrant it; don't pad to 3 otherwise."

Each step is independently testable. Step 10 is the gate — don't set `docsPath` until step 9 (docs page) lands, or `registry.test.ts` will fail CI.
