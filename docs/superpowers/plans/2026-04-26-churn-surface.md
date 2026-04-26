# Churn Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-class **Churn** preset in the GitRelic web dashboard — sidebar entry, bar-chart hero (default), treemap alt-tab, bottom-panel table, and four-tile metrics strip — so the existing `analyzeChurn` data finally has a home.

**Architecture:** Mirrors the Bus Factor pattern. New preset slots into `apps/web/src/presets/registry.ts`, new sidebar entry under Code Health (position 2, after Hotspots), new `ChurnBar` hero modeled point-for-point on `OwnershipBar.tsx`, new `ChurnTab` thin wrapper around the shared `SortableTable`, new `churnMetrics` composer, no core changes.

**Tech Stack:** React 19 · Vite · TypeScript 6 · Vitest · D3-hierarchy (treemap reuse only). All TypeScript-only — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-26-churn-surface-design.md`

---

## File Structure

### New files
| Path | Responsibility |
|---|---|
| `apps/web/src/components/hero/ChurnBar.tsx` | Default hero. Top-N horizontal bars sorted by commit count. Exports `prepareChurnBarData` (pure helper) and `ChurnBar` (component). |
| `apps/web/src/components/hero/ChurnBar.test.tsx` | Data-prep ordering + tie-breaking + topN cap; empty state; render smoke test; click handler. |
| `apps/web/src/components/tabs/ChurnTab.tsx` | Bottom-panel table, six columns, default sort by commits desc. |
| `apps/web/src/presets/metrics/churn.ts` | `churnMetrics(report)` returning four `Metric` tiles. |
| `apps/web/src/presets/metrics/churn.test.ts` | All four tile values + severity color rules across representative + empty fixtures. |

### Modified files
| Path | Change |
|---|---|
| `apps/web/src/presets/types.ts` | Add `'churn'` to `AnalyzerPresetId`; add `'churn'` to `BottomTab`; add `'churn-bar'` to `HeroViz`. |
| `apps/web/src/presets/registry.ts` | Add `churn` preset entry. |
| `apps/web/src/components/layout/Sidebar.tsx` | Insert "Churn" entry second under Code Health. |
| `apps/web/src/components/layout/BottomPanel.tsx` | Add `TAB_LABELS['churn']` and a `TabContent` case for `'churn'`. |
| `apps/web/src/components/layout/Shell.tsx` | Add `HERO_LABELS['churn-bar']` and the `activeHeroViz === 'churn-bar'` dispatch branch. |

### Verify-only files (no expected change)
| Path | Why we check |
|---|---|
| `apps/web/src/utils/normalizeReport.ts` | Already defaults `report.churn` at line 28 — confirm shape matches what `ChurnBar`/`ChurnTab`/`churnMetrics` consume. |

---

## Reference patterns

The new code mirrors existing patterns. **Read these before starting** — the implementation is closer to "translate" than "design from scratch":

- `apps/web/src/components/hero/OwnershipBar.tsx` — full structural model for `ChurnBar`. ResizeObserver, scroll-into-view via `useLayoutEffect`, hover tooltip, empty state, `HeroCaption`, dynamic right-pad for trailing labels.
- `apps/web/src/components/hero/OwnershipBar.test.tsx` — `prepareOwnershipBarData` test idioms (factory functions for fixtures, sort + tie-break + topN cap assertions).
- `apps/web/src/components/tabs/BusFactorTab.tsx` — thin column-spec wrapper around `SortableTable`. ChurnTab follows the same shape.
- `apps/web/src/presets/metrics/cursed-files.ts` + `cursed-files.test.ts` — metrics composer + test layout.
- `apps/web/src/components/layout/Sidebar.tsx:38–80` — Code Health group structure for the new entry.
- `apps/web/src/components/shared/HeroCaption.tsx` — `primary` + optional `subtitle` API.
- `apps/web/src/utils/colors.ts:5` — `categoryColor(severity, opacity)` accepts `'critical' | 'warning' | 'moderate' | <default>` strings. `ChurnCategory` is `'hot' | 'warm' | 'cold' | 'frozen'`, so a small mapper is needed (Task 2 step 3).

---

## Task 1: Type-level wiring (`types.ts`)

**Files:**
- Modify: `apps/web/src/presets/types.ts`

This is a pure type addition. No tests. It will *break* compilation in the consumers (good — that's our checklist for the rest of the wiring). We commit on its own so the type expansion is a clean diff.

- [ ] **Step 1: Add `'churn'` to `AnalyzerPresetId`**

In `apps/web/src/presets/types.ts`, append `| 'churn'` to the `AnalyzerPresetId` union (around line 89). Pick a position: insert it after `'hotspots'` to mirror the sidebar order.

```ts
export type AnalyzerPresetId =
  | 'hotspots'
  | 'churn'           // ← new
  | 'bus-factor'
  | 'coupling'
  | // … rest unchanged
```

- [ ] **Step 2: Add `'churn'` to `BottomTab`**

Append `| 'churn'` to the `BottomTab` union (around line 38). Insert after `'hotspots'`:

```ts
export type BottomTab =
  | 'hotspots'
  | 'churn'           // ← new
  | 'cursed-files'
  | // … rest unchanged
```

- [ ] **Step 3: Add `'churn-bar'` to `HeroViz`**

Append `| 'churn-bar'` to the `HeroViz` union (around line 12). Insert after `'ownership-bar'`:

```ts
export type HeroViz =
  | 'treemap'
  | 'treemap-age'
  | 'treemap-test'
  | 'ownership'
  | 'ownership-bar'
  | 'churn-bar'       // ← new
  | // … rest unchanged
```

- [ ] **Step 4: Verify the type expansion broke the right consumers**

Run:

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: errors in `Shell.tsx` (HERO_LABELS missing 'churn-bar'), `BottomPanel.tsx` (TAB_LABELS missing 'churn'), and `registry.ts` (no preset for 'churn'). These are all expected; later tasks fix them. Confirm there are no errors in *other* files (the `Record<HeroViz, …>` exhaustiveness should be the only signal).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/presets/types.ts
git commit -m "feat(web): add churn types to presets/types

Adds 'churn' to AnalyzerPresetId, 'churn' to BottomTab, and 'churn-bar'
to HeroViz. The Record<…, …> declarations in Shell and BottomPanel will
fail until the next tasks wire them up — that's the type-level checklist."
```

---

## Task 2: `ChurnBar` hero (TDD)

**Files:**
- Create: `apps/web/src/components/hero/ChurnBar.tsx`
- Create: `apps/web/src/components/hero/ChurnBar.test.tsx`

The hero has two pieces: a pure `prepareChurnBarData` helper (testable in isolation) and the `ChurnBar` component (smoke-tested for empty state). The helper drives the order; the component renders SVG bars.

- [ ] **Step 1: Write failing tests for `prepareChurnBarData`**

Create `apps/web/src/components/hero/ChurnBar.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';

import { prepareChurnBarData } from './ChurnBar';

import type { GitrelicReport } from '@gitrelic/core';

interface ChurnFixture {
  file: string;
  commitCount: number;
  churnScore: number;
  category: 'hot' | 'warm' | 'cold' | 'frozen';
}

function makeReport(churnFiles: ChurnFixture[]): GitrelicReport {
  return {
    churn: { files: churnFiles, topFiles: [], hotspotCount: 0, summary: '' },
    busFactors: { files: [], criticalFiles: [], overallBusFactor: 0, summary: '' },
  } as unknown as GitrelicReport;
}

describe('prepareChurnBarData', () => {
  it('sorts rows by commitCount desc', () => {
    const rows = prepareChurnBarData(
      makeReport([
        { file: 'a', commitCount: 10, churnScore: 50, category: 'warm' },
        { file: 'b', commitCount: 80, churnScore: 95, category: 'hot' },
        { file: 'c', commitCount: 30, churnScore: 60, category: 'warm' },
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['b', 'c', 'a']);
  });

  it('breaks commit-count ties by file path asc for determinism', () => {
    const rows = prepareChurnBarData(
      makeReport([
        { file: 'src/zeta.ts', commitCount: 50, churnScore: 70, category: 'warm' },
        { file: 'src/alpha.ts', commitCount: 50, churnScore: 70, category: 'warm' },
        { file: 'src/mid.ts', commitCount: 50, churnScore: 70, category: 'warm' },
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['src/alpha.ts', 'src/mid.ts', 'src/zeta.ts']);
  });

  it('caps at 100 rows by default', () => {
    const many: ChurnFixture[] = Array.from({ length: 150 }, (_, i) => ({
      file: `f${i}.ts`,
      commitCount: 200 - i,
      churnScore: 80,
      category: 'hot',
    }));
    const rows = prepareChurnBarData(makeReport(many));
    expect(rows).toHaveLength(100);
    expect(rows[0].file).toBe('f0.ts');
    expect(rows[99].file).toBe('f99.ts');
  });

  it('honors a custom topN', () => {
    const many: ChurnFixture[] = Array.from({ length: 20 }, (_, i) => ({
      file: `f${i}.ts`,
      commitCount: 20 - i,
      churnScore: 50,
      category: 'warm',
    }));
    expect(prepareChurnBarData(makeReport(many), 5)).toHaveLength(5);
  });

  it('returns [] when churn.files is empty', () => {
    expect(prepareChurnBarData(makeReport([]))).toEqual([]);
  });

  it('exposes basename, full path, commit count, and category on each row', () => {
    const rows = prepareChurnBarData(
      makeReport([
        { file: 'packages/core/src/runner.ts', commitCount: 99, churnScore: 90, category: 'hot' },
      ]),
    );
    expect(rows[0]).toEqual({
      file: 'packages/core/src/runner.ts',
      name: 'runner.ts',
      commitCount: 99,
      category: 'hot',
    });
  });

  it('does not mutate the input churn.files array', () => {
    const churnFiles: ChurnFixture[] = [
      { file: 'a', commitCount: 10, churnScore: 50, category: 'warm' },
      { file: 'b', commitCount: 80, churnScore: 95, category: 'hot' },
    ];
    const beforeOrder = churnFiles.map((f) => f.file);
    prepareChurnBarData(makeReport(churnFiles));
    expect(churnFiles.map((f) => f.file)).toEqual(beforeOrder);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm --filter @gitrelic/web exec vitest run src/components/hero/ChurnBar.test.tsx
```

Expected: import resolution fails — `./ChurnBar` does not exist. That's the right kind of failure.

- [ ] **Step 3: Implement `ChurnBar.tsx`**

Create `apps/web/src/components/hero/ChurnBar.tsx`. Mirror `OwnershipBar.tsx` structurally but adapt to churn semantics. Use `categoryColor` with a churn → severity mapper.

```tsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { categoryColor } from '../../utils/colors';
import { HeroCaption } from '../shared/HeroCaption';

import type { ChurnCategory, GitrelicReport } from '@gitrelic/core';

export interface ChurnBarRow {
  file: string;
  name: string;
  commitCount: number;
  category: ChurnCategory;
}

const ROW_HEIGHT = 28;
const BAR_HEIGHT = 18;
const TOP_PAD = 12;
const BOTTOM_PAD = 12;
const LABEL_WIDTH = 220;
// Same empirical char width used by OwnershipBar for the trailing label pad.
const CHAR_PX = 6.4;
const LABEL_PAD_PX = 14;
const MIN_RIGHT_PAD = 90;
const MIN_BAR_LANE = 120;

function truncateToFit(label: string, maxChars: number): string {
  return label.length > maxChars ? `${label.slice(0, Math.max(1, maxChars - 1))}…` : label;
}

export function prepareChurnBarData(report: GitrelicReport, topN = 100): ChurnBarRow[] {
  const files = report.churn?.files ?? [];
  const sorted = [...files].sort((a, b) => {
    const diff = b.commitCount - a.commitCount;
    if (diff !== 0) return diff;
    return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  });
  return sorted.slice(0, topN).map((f) => {
    const basename = f.file.split('/').pop();
    return {
      file: f.file,
      name: basename && basename.length > 0 ? basename : f.file,
      commitCount: f.commitCount,
      category: f.category,
    };
  });
}

// Maps churn categories to the severity tokens used by `categoryColor` and the
// shared `Badge` component, so ChurnBar tooltips and ChurnTab badges agree on
// what `frozen` looks like.
function severityForChurn(category: ChurnCategory): 'critical' | 'warning' | 'moderate' | 'healthy' {
  switch (category) {
    case 'hot':
      return 'critical';
    case 'warm':
      return 'warning';
    case 'cold':
      return 'moderate';
    case 'frozen':
      return 'healthy';
  }
}

function fillFor(category: ChurnCategory, opacity: number): string {
  return categoryColor(severityForChurn(category), opacity);
}

interface ChurnBarProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function ChurnBar({ report, selectedFile, onSelectFile }: ChurnBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: ChurnBarRow } | null>(null);

  const rows = useMemo(() => prepareChurnBarData(report), [report]);
  const totalChurnedFiles = report.churn?.files.length ?? 0;

  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!selectedFile || !scrollRef.current) return;
    const idx = rows.findIndex((r) => r.file === selectedFile);
    if (idx < 0) return;
    const rowTop = TOP_PAD + idx * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewTop = scrollRef.current.scrollTop;
    const viewBottom = viewTop + scrollRef.current.clientHeight;
    if (rowTop < viewTop || rowBottom > viewBottom) {
      scrollRef.current.scrollTo({ top: Math.max(0, rowTop - 40), behavior: 'smooth' });
    }
  }, [selectedFile, rows]);

  if (rows.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          No file churn detected.
        </div>
        <HeroCaption
          primary="One row per file · bar = commit count · color = churn category"
          subtitle="Churn = how many commits each file appears in."
        />
      </div>
    );
  }

  const maxCommits = rows[0].commitCount;
  const longestLabelChars = rows.reduce((max, r) => {
    const len = `${r.commitCount.toLocaleString()} commits`.length;
    return len > max ? len : max;
  }, 0);
  const desiredRightPad = longestLabelChars * CHAR_PX + LABEL_PAD_PX;
  const maxAllowedRightPad = Math.max(MIN_RIGHT_PAD, width - LABEL_WIDTH - MIN_BAR_LANE);
  const rightPad = Math.max(MIN_RIGHT_PAD, Math.min(desiredRightPad, maxAllowedRightPad));
  const available = Math.max(MIN_BAR_LANE, width - LABEL_WIDTH - rightPad);
  const labelMaxChars = Math.max(8, Math.floor((rightPad - LABEL_PAD_PX) / CHAR_PX));
  const chartHeight = TOP_PAD + rows.length * ROW_HEIGHT + BOTTOM_PAD;
  const truncated = totalChurnedFiles > rows.length;
  const subtitle = truncated
    ? `Showing top ${rows.length} of ${totalChurnedFiles.toLocaleString()} churned files. Sorted by commits, ties broken by file path.`
    : `${rows.length.toLocaleString()} churned file${rows.length === 1 ? '' : 's'}. Sorted by commits, ties broken by file path.`;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <svg width={width} height={chartHeight} style={{ display: 'block' }}>
          {rows.map((row, i) => {
            const y = TOP_PAD + i * ROW_HEIGHT;
            const barTop = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            const barWidth = Math.max(2, (row.commitCount / maxCommits) * available);
            const isSelected = selectedFile === row.file;
            const color = fillFor(row.category, isSelected ? 0.9 : 0.7);
            const trailingLabel = truncateToFit(
              `${row.commitCount.toLocaleString()} commits`,
              labelMaxChars,
            );

            return (
              <g
                key={row.file}
                onClick={() => onSelectFile(row.file)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, row });
                }}
                onMouseMove={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setTooltip((prev) =>
                    prev
                      ? { ...prev, x: evt.clientX - rect.left, y: evt.clientY - rect.top }
                      : prev,
                  );
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <text
                  x={LABEL_WIDTH - 8}
                  y={barTop + BAR_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                >
                  {row.name}
                </text>
                <rect
                  x={LABEL_WIDTH}
                  y={barTop}
                  width={available}
                  height={BAR_HEIGHT}
                  rx={2}
                  fill="var(--surface-secondary)"
                  fillOpacity={0.4}
                />
                <rect
                  x={LABEL_WIDTH}
                  y={barTop}
                  width={barWidth}
                  height={BAR_HEIGHT}
                  rx={2}
                  fill={color}
                  stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                  strokeWidth={isSelected ? 1 : 0}
                />
                <text
                  x={LABEL_WIDTH + available + 6}
                  y={barTop + BAR_HEIGHT / 2}
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill="var(--text-secondary)"
                  style={{ pointerEvents: 'none' }}
                >
                  {trailingLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <HeroCaption
        primary="One row per file · bar = commit count · color = churn category"
        subtitle={subtitle}
      />
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 10,
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            zIndex: 20,
            maxWidth: 320,
            wordBreak: 'break-all',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.row.file}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.row.commitCount.toLocaleString()} commit
            {tooltip.row.commitCount === 1 ? '' : 's'}
          </div>
          <div
            style={{
              color: fillFor(tooltip.row.category, 1),
              marginTop: 2,
              textTransform: 'capitalize',
            }}
          >
            {tooltip.row.category}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the data-prep tests; expect green**

```bash
pnpm --filter @gitrelic/web exec vitest run src/components/hero/ChurnBar.test.tsx
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/hero/ChurnBar.tsx apps/web/src/components/hero/ChurnBar.test.tsx
git commit -m "feat(web): add ChurnBar hero component

Top-N horizontal bar chart sorted by commit count, mirroring the
OwnershipBar pattern (ResizeObserver, scroll-into-view-on-selection,
hover tooltip, HeroCaption with dynamic subtitle, empty state). Pure
prepareChurnBarData helper is exported for testing and reuse."
```

---

## Task 3: `churnMetrics` composer (TDD)

**Files:**
- Create: `apps/web/src/presets/metrics/churn.ts`
- Create: `apps/web/src/presets/metrics/churn.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/presets/metrics/churn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { churnMetrics } from './churn';

import type { FileChurn, GitrelicReport, RawCommit } from '@gitrelic/core';

function makeFile(overrides: Partial<FileChurn> = {}): FileChurn {
  return {
    file: 'a.ts',
    commitCount: 10,
    churnScore: 50,
    category: 'warm',
    ...overrides,
  };
}

function makeReport(
  files: FileChurn[],
  totalCommits: number,
): GitrelicReport {
  const commits = Array.from({ length: totalCommits }, (_, i) => ({
    hash: String(i),
  })) as unknown as RawCommit[];
  return {
    churn: { files, topFiles: [], hotspotCount: 0, summary: '' },
    commits,
  } as unknown as GitrelicReport;
}

describe('churnMetrics', () => {
  it('returns healthy/em-dash values when there is no churn', () => {
    const metrics = churnMetrics(makeReport([], 0));
    expect(metrics).toHaveLength(4);
    expect(metrics[0]).toMatchObject({ label: 'Hot Files', value: '0' });
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1]).toMatchObject({ label: 'Top Churn', value: '—' });
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2]).toMatchObject({ label: 'Top File %', value: '—' });
    expect(metrics[3]).toMatchObject({ label: 'Tracked Files', value: '0' });
  });

  it('counts hot files (churnScore > 75) and colors critical', () => {
    const metrics = churnMetrics(
      makeReport(
        [
          makeFile({ file: 'a.ts', commitCount: 80, churnScore: 90, category: 'hot' }),
          makeFile({ file: 'b.ts', commitCount: 75, churnScore: 85, category: 'hot' }),
          makeFile({ file: 'c.ts', commitCount: 30, churnScore: 50, category: 'warm' }),
        ],
        100,
      ),
    );
    expect(metrics[0].value).toBe('2');
    expect(metrics[0].color).toBe('var(--severity-critical)');
  });

  it('reports top churn as the max commitCount, formatted with thousands separators', () => {
    const metrics = churnMetrics(
      makeReport(
        [
          makeFile({ file: 'a.ts', commitCount: 1847, churnScore: 90, category: 'hot' }),
          makeFile({ file: 'b.ts', commitCount: 12, churnScore: 30, category: 'cold' }),
        ],
        2000,
      ),
    );
    expect(metrics[1].value).toBe('1,847');
  });

  it('reports top file % rounded to one decimal', () => {
    const metrics = churnMetrics(
      makeReport(
        [
          makeFile({ file: 'a.ts', commitCount: 80, churnScore: 90, category: 'hot' }),
        ],
        2400,
      ),
    );
    // 80 / 2400 = 0.0333 → 3.3%
    expect(metrics[2].value).toBe('3.3%');
  });

  it('reports tracked files count formatted with thousands separators', () => {
    const files: FileChurn[] = Array.from({ length: 1234 }, (_, i) => makeFile({ file: `f${i}.ts` }));
    const metrics = churnMetrics(makeReport(files, 5000));
    expect(metrics[3].value).toBe('1,234');
  });

  it('colors Top Churn warning when there is churn but no hot files', () => {
    const metrics = churnMetrics(
      makeReport(
        [makeFile({ file: 'a.ts', commitCount: 30, churnScore: 50, category: 'warm' })],
        100,
      ),
    );
    expect(metrics[1].color).toBe('var(--severity-warning)');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm --filter @gitrelic/web exec vitest run src/presets/metrics/churn.test.ts
```

Expected: import resolution fails — `./churn` does not exist.

- [ ] **Step 3: Implement `churn.ts`**

Create `apps/web/src/presets/metrics/churn.ts`:

```ts
import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function churnMetrics(report: GitrelicReport): Metric[] {
  const files = report.churn?.files ?? [];
  const fileCount = files.length;
  const hotCount = files.filter((f) => f.churnScore > 75).length;
  const topCommitCount = files.reduce((max, f) => (f.commitCount > max ? f.commitCount : max), 0);
  const totalCommits = report.commits?.length ?? 0;
  const topFilePct =
    fileCount > 0 && totalCommits > 0
      ? Math.round((topCommitCount / totalCommits) * 1000) / 10
      : null;

  return [
    {
      label: 'Hot Files',
      value: String(hotCount),
      color: hotCount > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Top Churn',
      value: fileCount > 0 ? fmt(topCommitCount) : '—',
      color:
        fileCount === 0
          ? 'var(--severity-healthy)'
          : hotCount > 0
            ? 'var(--severity-critical)'
            : 'var(--severity-warning)',
    },
    {
      label: 'Top File %',
      value: topFilePct != null ? `${topFilePct}%` : '—',
      color: 'var(--accent-primary)',
    },
    {
      label: 'Tracked Files',
      value: fmt(fileCount),
      color: 'var(--accent-primary)',
    },
  ];
}
```

- [ ] **Step 4: Run the test; expect green**

```bash
pnpm --filter @gitrelic/web exec vitest run src/presets/metrics/churn.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/presets/metrics/churn.ts apps/web/src/presets/metrics/churn.test.ts
git commit -m "feat(web): add churn metrics composer

Four headline tiles: Hot Files (count where churnScore > 75) ·
Top Churn (max commitCount) · Top File % (top / total commits) ·
Tracked Files (count). Severity colors flip on Hot/Top Churn."
```

---

## Task 4: `ChurnTab` table

**Files:**
- Create: `apps/web/src/components/tabs/ChurnTab.tsx`

This is a thin column-spec wrapper around `SortableTable`. No dedicated test — the wrapper has no logic that wouldn't be covered by the column shape itself, matching the precedent set by `ChurnVelocityTab.tsx` (which also has no `.test.tsx`).

- [ ] **Step 1: Implement `ChurnTab.tsx`**

Create `apps/web/src/components/tabs/ChurnTab.tsx`:

```tsx
import { useMemo } from 'react';

import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt, severityColor } from '../theme';

import type { ChurnCategory, FileChurn, GitrelicReport } from '@gitrelic/core';

interface ChurnTabProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface ChurnRow {
  file: string;
  commitCount: number;
  category: ChurnCategory;
  loc: number | null;
  uniqueAuthors: number | null;
  ageDays: number | null;
}

function severityForChurn(category: ChurnCategory): 'critical' | 'warning' | 'moderate' | 'healthy' {
  switch (category) {
    case 'hot':
      return 'critical';
    case 'warm':
      return 'warning';
    case 'cold':
      return 'moderate';
    case 'frozen':
      return 'healthy';
  }
}

function formatRelative(days: number | null): string {
  if (days == null) return '—';
  if (days < 1) return 'today';
  if (days < 30) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  const years = days / 365;
  return `${years.toFixed(years >= 10 ? 0 : 1)}y ago`;
}

function buildRows(report: GitrelicReport): ChurnRow[] {
  const locByFile = new Map(report.loc.files.map((f) => [f.file, f.lines]));
  const bfByFile = new Map(report.busFactors.files.map((f) => [f.file, f.uniqueAuthors]));
  const ageByFile = new Map(report.ageMap.files.map((f) => [f.file, f.ageInDays]));

  return (report.churn?.files ?? []).map((f: FileChurn) => ({
    file: f.file,
    commitCount: f.commitCount,
    category: f.category,
    loc: locByFile.get(f.file) ?? null,
    uniqueAuthors: bfByFile.get(f.file) ?? null,
    ageDays: ageByFile.get(f.file) ?? null,
  }));
}

export function ChurnTab({ report, selectedFile, onSelectFile }: ChurnTabProps) {
  const rows = useMemo(() => buildRows(report), [report]);

  const columns: Column<ChurnRow>[] = [
    {
      key: 'file',
      label: 'File',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fileName(r.file)}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
            {filePath(r.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'commits',
      label: 'Commits',
      width: '90px',
      align: 'right',
      sortValue: (r) => r.commitCount,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
          {fmt(r.commitCount)}
        </span>
      ),
    },
    {
      key: 'loc',
      label: 'LOC',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.loc ?? -1,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
          {r.loc != null ? fmt(r.loc) : '—'}
        </span>
      ),
    },
    {
      key: 'authors',
      label: 'Authors',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.uniqueAuthors ?? -1,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
          {r.uniqueAuthors != null ? r.uniqueAuthors : '—'}
        </span>
      ),
    },
    {
      key: 'lastTouched',
      label: 'Last Touched',
      width: '110px',
      align: 'right',
      sortValue: (r) => r.ageDays ?? Number.MAX_SAFE_INTEGER,
      render: (r) => (
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {formatRelative(r.ageDays)}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      width: '80px',
      align: 'center',
      render: (r) => <Badge variant={severityForChurn(r.category)}>{r.category}</Badge>,
    },
  ];

  // Initial sort: commits desc. SortableTable auto-defaults to desc on first column click;
  // we don't have a direct "default sort" prop, so the data is pre-sorted here so the
  // initial render matches what the user expects without any clicks.
  const sorted = useMemo(() => [...rows].sort((a, b) => b.commitCount - a.commitCount), [rows]);

  return (
    <SortableTable
      data={sorted}
      columns={columns}
      rowKey={(r) => r.file}
      selectedKey={selectedFile}
      onRowClick={(r) => onSelectFile(r.file)}
    />
  );
}
```

- [ ] **Step 2: Verify the file type-checks against the existing code**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: errors are still only in `Shell.tsx`, `BottomPanel.tsx`, `registry.ts` (the wiring tasks). No errors in `ChurnTab.tsx`. The age field on `FileAge` is `ageInDays` (`packages/core/src/types.ts`), as already used by `apps/web/src/components/tabs/AgeMapTab.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tabs/ChurnTab.tsx
git commit -m "feat(web): add ChurnTab bottom-panel table

Six columns: File · Commits (default sort ↓) · LOC · Authors ·
Last Touched · Category. Cross-analyzer fields lookup against loc,
busFactors, ageMap with — placeholder for missing entries."
```

---

## Task 5: Wire the preset (registry, sidebar, BottomPanel, Shell)

**Files:**
- Modify: `apps/web/src/presets/registry.ts`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Modify: `apps/web/src/components/layout/BottomPanel.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx`

This task closes all the type errors from Task 1 in one swoop. After it lands, the full app should compile and render.

- [ ] **Step 1: Register the `churn` preset**

In `apps/web/src/presets/registry.ts`:

a) Add an import alongside the others (alphabetical):

```ts
import { churnMetrics } from './metrics/churn';
```

b) Add a `churn` entry to the `PRESETS` record. Insert after `'cursed-files'` to keep the source layout grouped (the `Record<>` order doesn't affect runtime behavior, but it keeps diffs clean):

```ts
  churn: {
    id: 'churn',
    tier: 'analyzer',
    label: 'Churn',
    group: 'code-health',
    hero: {
      defaultViz: 'churn-bar',
      altTabs: ['churn-bar', 'treemap'],
    },
    bottomPanel: {
      defaultTab: 'churn',
      altTabs: ['churn'],
    },
    metrics: churnMetrics,
  },
```

- [ ] **Step 2: Add the Sidebar entry under Code Health**

In `apps/web/src/components/layout/Sidebar.tsx`, add the Churn entry as the **second** item in the Code Health group (after Hotspots, before Cursed Files) so the visual order is:

```
Hotspots → Churn → Cursed Files → Stale Files → Blast Radius → …
```

```ts
      label: 'Code Health',
      groupId: 'code-health',
      items: [
        {
          id: 'hotspots',
          label: 'Hotspots',
          badge: report.hotspots.topHotspots.filter((h) => h.category === 'critical').length,
        },
        {
          id: 'churn',                                          // ← new
          label: 'Churn',
          badge: report.churn.files.filter((f) => f.churnScore > 75).length,
        },
        {
          id: 'cursed-files',
          label: 'Cursed Files',
          // … rest unchanged
```

- [ ] **Step 3: Wire the Churn tab into BottomPanel**

In `apps/web/src/components/layout/BottomPanel.tsx`:

a) Add the import:

```ts
import { ChurnTab } from '../tabs/ChurnTab';
```

b) Add `'churn': 'Churn'` to `TAB_LABELS`:

```ts
const TAB_LABELS: Record<BottomTab, string> = {
  hotspots: 'Hotspots',
  churn: 'Churn',                  // ← new
  'cursed-files': 'Cursed Files',
  // … rest unchanged
};
```

c) Add a case to the `TabContent` switch:

```ts
    case 'churn':
      return (
        <ChurnTab report={report} selectedFile={selectedFile} onSelectFile={onSelectFile} />
      );
```

- [ ] **Step 4: Wire the bar hero into Shell**

In `apps/web/src/components/layout/Shell.tsx`:

a) Add the import alongside the other hero imports (alphabetical):

```ts
import { ChurnBar } from '../hero/ChurnBar';
```

b) Add `'churn-bar': 'Top Churn'` to `HERO_LABELS`. The convention is a 2-word noun phrase (`'Bus Bar'`, `'Stacked'`, `'By Dir'`, `'Sankey'`). `'Top Churn'` keeps it terse and self-describing:

```ts
export const HERO_LABELS: Record<HeroViz, string> = {
  treemap: 'Treemap',
  // …
  'ownership-bar': 'Bus Bar',
  'churn-bar': 'Top Churn',                // ← new
  // …
};
```

c) Add the dispatch branch in the hero switch (insert after `ownership-bar`):

```tsx
                {selection.activeHeroViz === 'churn-bar' && (
                  <ChurnBar
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
```

- [ ] **Step 5: Run the type-checker**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: zero errors. If anything remains, the most likely culprit is a name mismatch between the spec and an actual field (e.g., the age-map field name) — read the error message and adjust the relevant file.

- [ ] **Step 6: Run the full web test suite**

```bash
pnpm test:web
```

Expected: all pre-existing tests still pass + the new ones (7 + 6) added by Tasks 2 and 3.

- [ ] **Step 7: Lint and format**

```bash
pnpm lint
pnpm format:check
```

Expected: clean. If `format:check` fails, run `pnpm format` and re-stage.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/presets/registry.ts apps/web/src/components/layout/Sidebar.tsx apps/web/src/components/layout/BottomPanel.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): wire churn preset into registry, sidebar, BottomPanel, Shell

Sidebar entry slots in second under Code Health (after Hotspots).
BottomPanel routes 'churn' to ChurnTab. Shell dispatches 'churn-bar'
to ChurnBar; treemap remains as alt-tab via colorBy='churn'."
```

---

## Task 6: Smoke test against the React fixture

**Files:** none modified — verification only.

- [ ] **Step 1: Build the CLI bundle**

```bash
pnpm build
```

Expected: clean build. The CLI bundle includes the new web dist via `apps/cli/scripts/copy-web-dist.mjs`.

- [ ] **Step 2: Run against the React fixture (the standard target per memory)**

```bash
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Open the printed URL.

- [ ] **Step 3: Verify the Churn entry**

  - **Sidebar**: "Churn" appears second under Code Health (between Hotspots and Cursed Files). The badge shows the hot file count.
  - Click it. Active state highlights.

- [ ] **Step 4: Verify the bar hero (default)**

  - The hero pane shows ranked horizontal bars.
  - Each row: basename label · colored bar · trailing `N commits`.
  - Hover a bar → tooltip with full path, commit count, churn category.
  - Click a bar → selection highlights, scroll-into-view animation works for off-screen rows (try a row at the very bottom of the top 100).
  - Caption strip below reads `One row per file · bar = commit count · color = churn category` with the dynamic subtitle (`Showing top 100 of N…` because React has thousands of files).

- [ ] **Step 5: Verify the treemap alt-tab**

  - Click the alt-tab labeled "Treemap" in the hero pane.
  - The existing `ChurnTreemap` renders with `colorBy='churn'`.
  - Tiles are colored by churn category; sized by LOC.

- [ ] **Step 6: Verify the metrics strip**

  - Four tiles: `Hot Files` · `Top Churn` · `Top File %` · `Tracked Files`.
  - On the React fixture: Hot Files > 0 (severity-critical color), Top Churn is a large four-digit number, Top File % is a low single-digit percent, Tracked Files in the thousands.

- [ ] **Step 7: Verify the bottom-panel table**

  - Tab labeled "Churn" is selected.
  - Six columns: File · Commits · LOC · Authors · Last Touched · Category.
  - Rows pre-sorted by commit count desc.
  - Click a column header → sort direction flips visibly.
  - Click a row → file becomes selected (synchronized with hero).

- [ ] **Step 8: Edge-state spot-check (gitrelic itself)**

```bash
node apps/cli/dist/index.mjs --path . --web
```

  - Sidebar still shows Churn (small repo).
  - Bars render normally with whatever subset of files have churn.
  - Treemap renders sparser but functional.
  - No console errors.

- [ ] **Step 9: Stop the smoke server**

Ctrl-C the CLI process.

- [ ] **Step 10: Stop the brainstorming companion server (if still running)**

```bash
/Users/tracericochet/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.5/skills/brainstorming/scripts/stop-server.sh /Users/tracericochet/Desktop/nebulord/gitrelic/.superpowers/brainstorm/$(ls -1 /Users/tracericochet/Desktop/nebulord/gitrelic/.superpowers/brainstorm | tail -1)
```

If multiple session dirs exist and the latest isn't the one to stop, run `ls /Users/tracericochet/Desktop/nebulord/gitrelic/.superpowers/brainstorm/` first and pick the right one.

---

## Task 7: Final verification

**Files:** none modified — gating checks before opening a PR.

- [ ] **Step 1: Run the full repo test suite**

```bash
pnpm test
```

Expected: all 231 core + 29 (now ~42) web tests pass.

- [ ] **Step 2: Run lint and format checks**

```bash
pnpm lint
pnpm format:check
```

Expected: clean.

- [ ] **Step 3: Verify the build outputs**

```bash
pnpm build
ls apps/cli/dist/web/
```

Expected: `apps/cli/dist/web/` contains `index.html` and the asset bundle (the publishing invariant — see CLAUDE.md "Publishing invariants").

- [ ] **Step 4: Diff sanity-check**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

Expected: 5 commits, ~5 new files, ~5 modified files (registry/sidebar/BottomPanel/Shell/types).

- [ ] **Step 5: Update Linear**

The build work needs a Linear ticket sibling to RELIC-303 under the Polish Initiative project (or its own "Build" sub-project). Create one named **"Build: churn surface"**, link the spec and plan paths, set state to In Progress, and link RELIC-303 as blocked by it. Use the Linear tools to create and update the issue (or do this manually via the Linear web UI).

---

## Risks & rollback

- **`report.commits` may be unavailable** for older reports. `normalizeReport.ts:166` already defaults `commits: raw.commits ?? []`, so the metrics composer's `?? 0` fallback is redundant but harmless.
- **`report.ageMap.files[].ageInDays`** is the field name in `FileAge` (`packages/core/src/types.ts`). `AgeMapTab.tsx` is the reference. The plan's snippet uses the right name; flagged here only because earlier drafts had it wrong.
- **Sidebar badge depends on `normalizeReport`** — the `report.churn.files.filter(…)` expression in `Sidebar.tsx` would crash if `report.churn` were undefined. `apps/web/src/utils/normalizeReport.ts:28` defaults it, so this is safe in practice. Don't remove that default without updating the badge expression.
- **Rollback path**: revert the five commits in reverse order — start with the wiring commit (Task 5), then ChurnTab (Task 4), then metrics (Task 3), then ChurnBar (Task 2), then types (Task 1). Each revert is independent and leaves the app in a working state.

---

## After this plan ships

- Pick up RELIC-303 (Polish: churn) as a separate ticket — caption wording, threshold tuning, color/contrast checks, copy review, edge-case audit on real repos.
- Consider whether the Polish Initiative needs additional "Build:" tickets for the other missing analyzer surfaces (`hotspot-clustering`, possibly `churn-velocity` standalone). Out of scope here.
