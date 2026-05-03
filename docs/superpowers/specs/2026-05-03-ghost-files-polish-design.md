# Ghost Files Polish — Design

> **Linear:** [RELIC-318](https://linear.app/nebulord/issue/RELIC-318)
> **Pattern doc:** [`docs/polish-pattern.md`](../../polish-pattern.md) — Ghost Files entry under "Pending (Batches 2–N)" gets updated when this ships.
> **Status:** Approved by Trace, ready for implementation plan.

## Summary

Polish the Ghost Files analyzer in the GitRelic web view. Tighten the analyzer's claim by gating on the Contributors-analyzer `isGhost` flag (>180d, scaled) instead of `!isActive` (>90d), bump the ownership concentration threshold from 70% to 80%, collapse the hero slate to a single hero (`OwnershipSunburst mode='ghost'`), replace the bottom-panel `SortableTable` with a people-first narrative-KPI panel headlined by distinct ghost-owner count, retune the metrics strip with health-tiered counts, polish the shared `OwnershipSunburst` with display-name labels and a hero caption, and ship the analyzer's docs page.

The framing the polish locks: **Ghost Files = materialized knowledge-loss risk** — files where one author wrote essentially the whole thing AND that author has gone silent. The story it tells: *"knowledge has left even though work continues."* Distinct from Stale Files (which catches files no one is touching) — these analyzers operate on disjoint file sets.

## Why this scope

The current Ghost Files view ships:

- **Default hero:** `OwnershipSunburst mode='ghost'` (legitimately ghost-scoped sunburst)
- **Alt heroes:** `OwnershipSunburst mode='all'` (full-repo by-author breakdown — *not* ghost-specific), `OwnershipBubble` (per-directory bubble pack — exact dupe of the Contributors analyzer's hero)
- **Metrics strip:** Ghost Files / True Ghosts (>365d) / Fading (180–365d) / Ghost LOC / Max Inactive Days
- **Bottom panel:** `SortableTable` of every ghost file

A forensic look at the rendered Ghost Files tab against the React repo (1,114 commits, 85 authors, 12-month analysis window) surfaced four problems:

1. **The KPI distribution is broken.** 562 GHOST FILES · 0 TRUE GHOSTS (>365D) · 106 FADING (180–365D). The "True Ghosts" threshold can never fire on a default 1-year analysis window. The remaining 562 - 106 = 456 are owned by authors who haven't committed in 90–180 days — the "intermediate" zone in the Contributors classification, not actually ghost. The analyzer is **using a different cutoff than the Contributors analyzer it depends on** (`!isActive` ≥90d vs `isGhost` ≥180d), conflating "quiet recently" with "gone."
2. **The KPI strip invents a third cutoff.** `True Ghosts (>365d)` doesn't match either of the two upstream cutoffs. A repo on a 12-month analysis window can't have any author inactive >365d. Defective slot.
3. **Two of three hero alts are redundant.** `mode='all'` is a worse Knowledge Silos / Overview viz that doesn't filter to ghosts. `OwnershipBubble` is byte-equivalent to the Contributors analyzer's hero (user-confirmed). Same "redundant alts" pathology Bus Factor and Rewrite Ratio fixed.
4. **The bottom-panel table is repetitive on real data.** Every visible row on React shows `nathanmarks@users.noreply.github.com — fading — 93d — fixtures file`. One author owns the entire visible table because their compiler-fixtures dump is one big concentrated owner. The SortableTable shape rotates the hero's data without adding a third dimension; per polish-pattern.md, this is the canonical "table is rotated hero" pathology that calls for a narrative-KPI rewrite.

The 80% ownership bump (from 70%) tightens the analyzer's claim to match its name: at 80%+ ownership, the dominant author *wrote the file*; at 70%, you still have meaningful distributed knowledge. Removing the 70/80 asymmetry against the Knowledge Silos `SILOS_THRESHOLD = 80` is a coincidental win, not the justification.

## Out of scope

- **Knowledge Silos / Bus Factor re-tuning.** Even if our work surfaces that their thresholds should also shift, that's their own polish ticket.
- **Configurable ownership cutoff.** A CLI flag for users who want to slide the 80% threshold; future ticket if requested.
- **`GhostHandoffSwimlanes` (novel "who's adopting orphans" hero).** A genuinely new viz that would directly render the locked framing — each ghost-file row split into pre/post-departure commit segments, surfacing accidental knowledge-acquirers. Considered as a second hero alt and rejected for this session: net-new component, novel viz, requires new backend aggregates, real design risk in a polish session. File as RELIC-XXX follow-up if the analyzer feels under-told post-ship.
- **`GhostFilesLeaderboard` alt hero.** A LOC-ranked top-N file list considered as the alt that would fill the scannable-file-list gap left by killing the table. Rejected after evaluation: LOC-rank charts are dominated by generated/fixture files (`expect.md` × 20 on React), the leaderboard duplicates the sunburst's outer ring rather than adding a new dimension, and the ghost-files actionable unit is the *owner cluster* (sunburst slice) rather than individual files.
- **Inspector display-name migration.** Memory tagged display-names as a global follow-up — applying the rule to `FileInspector` / `ContributorsInspector` is its own ticket.
- **`ContributorSwimlanes` disjunction simplification.** Post-fix, line 94 of `ContributorSwimlanes.tsx` (`const isGhost = ghostAuthors.has(contrib.email) || contrib.isGhost`) becomes technically redundant — the first branch is implied by the second once ghost-files itself gates on `isGhost`. Leaving the disjunction as-is is harmless (correct in both branches); a one-line cleanup is filed for future hygiene PR.

## Architecture

### Analyzer fix — `packages/core/src/analyzers/ghost-files.ts`

Two precise edits:

```ts
const GHOST_OWNERSHIP_THRESHOLD = 80;  // was 70

// inside the per-file loop:
const author = contributorMap.get(fileBus.dominantAuthor);
if (!author || !author.isGhost) continue;  // was !author.isActive
```

After the loop, compute three new aggregates in a single pass:

```ts
const ghostOwners = new Set(files.map((f) => f.dominantAuthor)).size;
const ghostLoc = files.reduce((sum, f) => sum + f.loc, 0);
const tierMix = {
  trueGhost: files.filter((f) => f.authorInactiveDays >= 365).length,
  fading: files.filter((f) => f.authorInactiveDays >= 180 && f.authorInactiveDays < 365).length,
};
```

Because the gate is now `isGhost`, every flagged file has `authorInactiveDays >= 180` by construction; `tierMix.trueGhost + tierMix.fading === totalGhostFiles` is invariant.

### Type additions — `packages/core/src/types.ts`

```ts
export interface GhostFilesReport {
  files: GhostFile[];
  totalGhostFiles: number;
  ghostOwners: number;        // NEW — distinct dominant-author count (panel big number)
  ghostLoc: number;           // NEW — total LOC across ghost files
  tierMix: {                  // NEW — file-side band counts
    trueGhost: number;        // authorInactiveDays >= 365
    fading: number;           // 180 <= authorInactiveDays < 365
  };
  summary: string;
}
```

Pure-addition fields. No removed fields, no renamed fields.

### Cross-analyzer alignment (no code change required)

`ContributorSwimlanes.prepareSwimlaneData` line 94:

```ts
const isGhost = ghostAuthors.has(contrib.email) || contrib.isGhost;
```

Today this disjunction uses *two* different ghost definitions: the first branch reads from the broken ghost-files set (anyone `!isActive`, ≥90d), the second from the contributors-analyzer's `isGhost` (≥180d, scaled). The swimlane labels authors as ghost using whichever is broader.

After the analyzer fix, the first branch becomes a strict subset of the second — both definitions converge on `isGhost`. The swimlane's ghost label silently corrects without touching the swimlane code. Concrete React example: `nathanmarks` (93d inactive) is currently labeled ghost in the swimlane via the broken first branch. Post-fix, he correctly drops the ghost label (he's intermediate, not ghost). The `<HeroCaption>` copy ("ghost rows show inactive cutoff") stays accurate.

### Cross-analyzer downstream

- **`packages/core/src/analyzers/cursed-files.ts`** consumes `report.ghostFiles.files[]` as one of its risk dimensions. Smaller ghost-files set → lower ghost contribution to per-file curse scores. The `fixture-regression.test.ts.snap` regenerates with shifted curse scores — review the diff is a pure-shrink + addition pattern; no behavior change in cursed-files itself.
- **`apps/web/src/utils/normalizeReport.ts`** needs per-field defaults for the three new `GhostFilesReport` fields (`ghostOwners: 0`, `ghostLoc: 0`, `tierMix: { trueGhost: 0, fading: 0 }`) so old report JSON loads cleanly.

### Frontend-derived aggregators

Following the `topDominantOwners.ts` (Bus Factor) and `blastByDirectory.ts` (Blast Radius) precedent — analyzer-specific aggregators that only the panel consumes live in `apps/web/src/utils/`:

- **`apps/web/src/utils/ghostOwners.ts`** *(NEW)* — groups `report.ghostFiles.files` by `dominantAuthor`, sums file count + LOC per owner, returns top-N sorted desc by file count. Resolves display name via the contributors map; falls back to email when name is empty. Consumed by the panel's top-3 finding.
- **`apps/web/src/utils/ghostFilesByDirectory.ts`** *(NEW)* — depth-1 directory rollup of ghost files for the panel's "where they live" extras slot. Same shape as `blastByDirectory.ts`.

### Hero scope — registry change

| Slot | After | Before |
|---|---|---|
| Default | `ownership-sunburst-ghosts` | `ownership-sunburst-ghosts` (unchanged) |
| Alt | *(none)* — single-hero | `ownership-sunburst`, `ownership` |
| Removed | `ownership-sunburst` (mode='all'), `ownership` (bubble) | — |

`OwnershipSunburst` the component stays — Knowledge Silos still consumes it with `mode='single-author'`. `OwnershipBubble` the component stays — Contributors still consumes it as its alt hero.

The single-hero choice mirrors Knowledge Silos's shape (also single-hero) and follows the Polish Initiative's strongest theme: drop alts that don't add a *new* dimension. The sunburst already shows files (outer ring, sized by LOC, color-coded by inactivity tier) and people (inner ring, color-keyed by author identity) in one viz; per-file detail goes to the Inspector on click; the panel + metrics strip carry the aggregate story. A second hero would either duplicate the sunburst's data or fail-on-healthy-repos with no ghosts.

### Hero polish — `OwnershipSunburst` (shared with Knowledge Silos)

Three improvements applied to the shared component:

1. **Display-name labels.** Replace `email.split('@')[0]` (lines 80, 329) with a contributor-name lookup against `report.contributors.contributors`, using `contrib.name` verbatim and falling back to email when name is empty.
2. **Hero caption.** Add an optional `caption?: string` prop. The component wraps its existing SVG in `<div className="w-full h-full flex flex-col">` with a `<HeroCaption primary={caption} />` sibling beneath when the prop is supplied. The Ghost Files preset wires:
   ```
   inner ring = ghost author · outer ring = orphaned files (size = LOC, color = inactivity tier) · click to drill in
   ```
   Knowledge Silos's caption is set during this PR with a sensible default; if KS wants to refine its caption text further, that lands in the KS polish ticket.
3. **Bottom-right author legend cap.** The current code caps the legend at 8 entries (`authorNames.slice(0, 8)`). Display names are wider than email-prefixes; reduce the cap to **6** entries to preserve the no-truncation rule for individual names. If the legend still overflows, prefer shrinking the font over per-name truncation.

Tooltip text picks up display names automatically through the same lookup.

#### Naming convention

Applies wherever Ghost Files renders an author identity (sunburst inner-ring labels, sunburst tooltip, sunburst bottom-right legend, narrative-KPI top-3 finding, directory-rollup tooltips):

- Use the full `contrib.name` string verbatim — typically `First Last` from the author's git config.
- **Never** truncate to first-name-only or initials; **never** strip the surname for space.
- Fall back to email **only** when `contrib.name` is empty/missing.
- If a render slot runs out of horizontal room, prefer reducing the visible item count or shrinking the font over truncating individual names.

### Bottom panel — narrative-KPI rewrite

**`apps/web/src/components/tabs/GhostFilesTab.tsx`** — full rewrite, mirroring `KnowledgeSilosTab.tsx` shape with extras-slot (per the `BlastRadiusTab` precedent that introduced `NarrativeKPI.extras`):

```tsx
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { topGhostOwners } from '../../utils/ghostOwners';
import { ghostFilesByDirectory } from '../../utils/ghostFilesByDirectory';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface GhostFilesTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

function ghostOwnerTier(count: number): { variant: BadgeVariant; label: string } {
  if (count === 0) return { variant: 'healthy', label: 'Healthy' };
  if (count <= 2) return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Risk' };
}

export function GhostFilesTab({ report, onApplyPreset }: GhostFilesTabProps) {
  const gf = report.ghostFiles;
  const tier = ghostOwnerTier(gf.ghostOwners);
  const topOwners = topGhostOwners(gf.files, report.contributors.contributors, 3);
  const dirRollup = ghostFilesByDirectory(gf.files, 5);

  return (
    <NarrativeKPI
      bigNumber={String(gf.ghostOwners)}
      tier={tier}
      metric="GHOST OWNERS"
      finding={<TopGhostOwnersList owners={topOwners} />}
      subline={
        <>
          <span className="font-mono text-text-primary font-semibold">
            {gf.totalGhostFiles}
          </span>{' '}
          ghost files —{' '}
          <span className="font-mono">{gf.tierMix.trueGhost}</span> true ghost ·{' '}
          <span className="font-mono">{gf.tierMix.fading}</span> fading ·{' '}
          <span className="font-mono">{fmt(gf.ghostLoc)}</span> LOC dormant
        </>
      }
      extras={<GhostDirectoryRollup rows={dirRollup} />}
      seeAlso={[
        { label: 'Bus Factor', presetId: 'bus-factor' },
        { label: 'Knowledge Silos', presetId: 'knowledge-silos' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

`<TopGhostOwnersList>` and `<GhostDirectoryRollup>` are file-local subcomponents (defined in the same file, mirroring `BlastRadiusTab`'s pattern). Each top-owner row: full display name + `N files · K LOC`. Each directory-rollup row: parent directory · proportional bar · file count · share %.

### Metrics strip retune

**`apps/web/src/presets/metrics/ghost-files.ts`** — rewrite for 5 health-tiered slots:

| Slot | Label | Value | Severity bands | Source |
|---|---|---|---|---|
| 1 | **Ghost Files** | count | `0` healthy · `1–9` warning · `10+` critical | `totalGhostFiles` |
| 2 | **Ghost Owners** | count | `0` healthy · `1–2` warning · `3+` critical | NEW `ghostOwners` (mirrors panel tier) |
| 3 | **True Ghosts (≥365d)** | count | `0` healthy · `1+` critical | NEW `tierMix.trueGhost` |
| 4 | **Fading (180–364d)** | count | `0` healthy · `1–9` warning · `10+` critical | NEW `tierMix.fading` |
| 5 | **Ghost LOC** | `fmt(ghostLoc)` | `<2%` healthy · `2–9%` warning · `10%+` critical of `report.loc.totalLines` | NEW `ghostLoc`; severity computed against repo total |

**Dropped:** `Max Inactive Days` (pure trivia, no actionable signal).

**Slot 3 binary severity rationale:** post-fix, even one true ghost (>365d-silent owner) is meaningful — the dominant owner has been silent for over a full year while still owning ≥80% of the file. No middle band justified.

**Slot 5 absolute display + percent severity rationale:** absolute LOC matches the rest of the dashboard's count-style rendering, but the severity color band needs repo-relative context (112K means very different things on a 200K-line vs 5M-line repo). User scans a number; color tells them magnitude.

The retune mirrors the precedent set by Rewrite Ratio (`Files ≥70`), Parallel Dev (`High Parallel`), Commit Timing (`High Stress` / `Stressed Authors`), and Contributors (`Top-3 Share` / `Newcomers`) — replace shape-of-data counts with health-tiered counts.

### Web wiring

**`apps/web/src/presets/registry.ts` — `ghost-files` entry:**

```ts
'ghost-files': {
  id: 'ghost-files',
  tier: 'analyzer',
  label: 'Ghost Files',
  group: 'ownership-risk',
  hero: {
    defaultViz: 'ownership-sunburst-ghosts',
    altTabs: ['ownership-sunburst-ghosts'],         // was 3 entries
  },
  bottomPanel: {
    defaultTab: 'ghost-files',
    altTabs: ['ghost-files'],
  },
  metrics: ghostFilesMetrics,
  docsPath: 'analyzers/ghost-files',                 // NEW
},
```

The `docsPath` field is what causes the right-anchored `Docs ↗` link to render in the bottom-panel tab bar (per the per-analyzer docs-links feature shipped in #69 / RELIC-XXX). The link is conditional on `docsPath` being declared on the preset; `registry.test.ts` enforces that if `docsPath` is set, the docs file must exist on disk — so the implementation order below is gated.

**`apps/web/src/components/layout/BottomPanel.tsx`:** wire `onApplyPreset` through to `GhostFilesTab` (mirror how `ChurnTab` / `ShameTab` / `KnowledgeSilosTab` receive it).

**`apps/web/src/utils/normalizeReport.ts`:** per-field defaults for the three new `GhostFilesReport` fields so old report JSON loads without `undefined`.

**`apps/web/src/components/hero/OwnershipSunburst.tsx`:** display-name lookup, optional `caption?` prop with `<HeroCaption>` integration, legend cap reduction from 8 → 6.

### Empty / small / huge repo states

- **Empty repo:** `ghostOwners = 0`, `tierMix = { trueGhost: 0, fading: 0 }`, `ghostLoc = 0`. Tier badge = `Healthy`; big number "0"; finding empty (or short "no ghost owners"); subline reads "0 ghost files".
- **Healthy repo (no ghosts):** Identical to empty rendering — KPI panel shows "0 GHOST OWNERS · Healthy". Sunburst hero centers on "Ghost Ownership · 0 files" naturally via `modeHeading` + `countSunburstFiles`.
- **Huge repo:** Sunburst arcs scale fine (existing component, already tested on React's 2,754 files in mode='all'). Top-3 list and directory rollup are bounded by their own caps. The strip's LOC % calculation handles `report.loc.totalLines` denominators of any size.

### Docs page — `apps/docs/analyzers/ghost-files.md` (NEW)

Following the structure of `parallel-dev.md` / `commit-timing.md` / `contributors.md`:

1. **Frontmatter** — `title: Ghost Files`, description emphasizing the "knowledge has left even though work continues" framing.
2. **Intro paragraph** — what Ghost Files measures (intersection of concentration + author silence), what question it answers ("which orphans need a new owner before the trail goes cold"), explicit contrast with Stale Files (file-touch metric vs ownership metric — disjoint file sets).
3. **Quick read** — 10-second tour: metrics strip → sunburst hero → narrative-KPI panel → Inspector. Screenshot placeholder per the `::: tip Screenshot` pattern.
4. **How ghost files are detected** — mermaid pipeline diagram showing the two predicates in series:
   - Step 1: from Bus Factor — files where `dominantAuthorPercent >= 80`
   - Step 2: from Contributors — filter to those whose dominant author has `isGhost === true`
   - Threshold math: `MIN_GHOST_DAYS = 180`; `ghostWindowDays = max(180, repoAgeDays * 0.5)` (sliding window — adapts to analysis window)
5. **The metrics strip** — 5-slot table with formulas + tier thresholds + worked examples on a hypothetical repo.
6. **Reading the surfaces** — sunburst (default → only) → narrative-KPI panel → Inspector. Explicit "where each piece of information lives" guide.
7. **What action it suggests** — high ghost-owner count → triage by author cluster (sunburst slice); high true-ghost count → urgent code archaeology; high ghost LOC % → consider a knowledge-transfer initiative.
8. **The triangle: Ghost Files vs Bus Factor vs Knowledge Silos** — explicit comparison table:
   | Analyzer | Concentration check | Activity check | Tells you |
   |---|---|---|---|
   | Knowledge Silos | yes (any concentration) | no | "concentration shape" |
   | Bus Factor | yes (per file) | no | "potential collapse risk" |
   | Ghost Files | yes (≥80%) | yes (`isGhost`) | "materialized knowledge gap" |
9. **Ghost Files vs Stale Files** — explicit non-overlap callout. Disjoint file sets: Ghost Files derives from `BusFactorReport.files` (only files with commits in window); Stale Files derives from `trackedFiles` minus `activeFiles` (only files with NO commits in window). Different question → different file set.
10. **Limitations** — heuristic `isGhost` cutoff (people on long leave look like departed); 80% ownership may miss meaningfully-distributed files; analysis window scales the cutoff (a 6-month window catches more "ghosts"); rename-tracking not followed; bot accounts can show up as ghosts when they roll over.
11. **Related analyzers** — Bus Factor, Knowledge Silos, Contributors, Cursed Files.

**`apps/docs/.vitepress/config.ts`:**

- Add `{ text: 'Ghost Files', link: '/analyzers/ghost-files' }` to the Analyzers sidebar — alphabetical position next to Contributors.
- Remove `/analyzers/ghost-files` from `ignoreDeadLinks` if present.

## Tests

| File | Coverage |
|---|---|
| `packages/core/src/analyzers/ghost-files.test.ts` | Update existing 6 cases for new gate (`isGhost` not `isActive`) + 80% threshold. Add: `ghostOwners` distinctness (1 author owning 5 files = 1), `tierMix` boundaries (179d / 180d / 364d / 365d), `ghostLoc` sum, empty-repo aggregates default to 0. Update `makeContributors` test helper to include `isGhost` field. |
| `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` | Regenerates: ghost-files slice (smaller `files[]` + new aggregates) AND cursed-files slice (curse-scores shift downward where ghost contribution shrinks). Review diff is pure-shrink + addition pattern; no behavior change in cursed-files itself. |
| `apps/web/src/utils/ghostOwners.test.ts` *(NEW)* | Top-N grouping by `dominantAuthor`; sums files + LOC per owner; ties broken by file count then alphabetical; empty input returns `[]`; display-name resolution from contributors map with email fallback when name is empty. |
| `apps/web/src/utils/ghostFilesByDirectory.test.ts` *(NEW)* | Depth-1 directory grouping; share-% calculation; top-5 cap; empty input. |
| `apps/web/src/presets/metrics/ghost-files.test.ts` *(NEW)* | 5-slot composer: tier band correctness for slot 1 (0 / 1–9 / 10+), slot 2 (0 / 1–2 / 3+), slot 3 (0 / 1+), slot 4 (0 / 1–9 / 10+), slot 5 (<2% / 2–9% / 10%+ of `report.loc.totalLines`). Empty-repo defaults all healthy. |
| `apps/web/src/components/tabs/GhostFilesTab.test.tsx` *(NEW)* | Renders `narrative-kpi-big-number` testid with ghost-owner count; tier badge text matches band; top-3 finding renders display names (not emails); subline carries tier-mix counts and ghost-LOC; sticky see-also footer fires `onApplyPreset` with `bus-factor` / `knowledge-silos`; extras-slot renders directory rollup; empty-state when `ghostOwners === 0`. |
| `apps/web/src/presets/registry.test.ts` | Existing DoD assertion auto-fails if `docsPath` set without docs file — satisfies itself once docs page lands. No new test needed. |

Per polish-pattern.md: tests follow existing patterns. No visual regression infra introduced.

## Removes

- `'ownership-sunburst'` (mode='all') from `ghost-files.altTabs` — component stays.
- `'ownership'` (`OwnershipBubble`) from `ghost-files.altTabs` — component stays (Contributors still consumes it).
- `Max Inactive Days` slot from the metrics composer.
- `GhostFilesTab`'s entire current `SortableTable` rendering (~85 lines): columns array, badge-derivation logic, `Column<GhostFile>` import, `Badge` import. Inspector + sunburst + narrative-KPI top-3 already cover per-file detail at every granularity.

## Versioning

Ships as `feat:` (minor bump per `.releaserc.json` pre-1.0 rule). The threshold + gate change is a **semantic narrowing of the analyzer's claim** — the ghost-files set strictly shrinks on every existing repo. No downstream consumer breaks (cursed-files just receives less feed-in; its score formula is unchanged). No `feat!:` trigger.

Old report JSONs without the new `ghostOwners` / `ghostLoc` / `tierMix` fields load cleanly via `normalizeReport.ts` per-field defaults — no breaking change for cached/persisted report files.

## Implementation order

1. **Backend** — `types.ts` (3 new fields on `GhostFilesReport`) + `ghost-files.ts` (formula fix, threshold bump, 3 aggregates) + `ghost-files.test.ts` updates + `makeContributors` helper update for `isGhost`. Smallest, no UI deps.
2. **Snapshot diff verification** — run `pnpm test:core`, regenerate `fixture-regression.test.ts.snap`, sanity-check the diff is pure-shrink + addition (ghost-files slice shrinks; cursed-files curse-scores shift downward where ghost contribution shrinks).
3. **Frontend utils** — `ghostOwners.ts` + `ghostFilesByDirectory.ts` + their tests.
4. **Metrics composer** — `presets/metrics/ghost-files.ts` rewrite + composer test.
5. **Hero polish** — `OwnershipSunburst` (display-name lookup, new `caption?` prop with `<HeroCaption>` integration, legend cap 8 → 6). Verify against Knowledge Silos visually (no behavior regression on KS's hero — KS's hero gets the display-name win silently and a default caption string).
6. **Tab rewrite** — `GhostFilesTab.tsx` (NarrativeKPI + extras + see-also), `BottomPanel.tsx` wiring of `onApplyPreset`, tab test, `normalizeReport.ts` per-field defaults.
7. **Docs page** — `apps/docs/analyzers/ghost-files.md` + sidebar entry + `ignoreDeadLinks` cleanup.
8. **Registry update** — drop both alts from `ghost-files.altTabs`, supply Ghost Files's caption string to the sunburst wiring, **set `docsPath: 'analyzers/ghost-files'`** (this is what surfaces the right-anchored `Docs ↗` link in the bottom-panel tab bar; `registry.test.ts` fails CI if step 7 hasn't landed).
9. **Final smoke** — run `pnpm dev`, point CLI at React (`~/Desktop/react`), eyeball: KPI strip shows the new 5 slots with the formula-fixed counts, sunburst renders with display-name labels and caption, panel shows "X GHOST OWNERS" with top-3 owners by full name, sticky see-also fires Bus Factor and Knowledge Silos, `Docs ↗` link renders right-anchored in the tab bar.

Each step is independently testable. Step 8 is the gate — don't set `docsPath` until step 7 (docs page) lands, or `registry.test.ts` will fail CI.
