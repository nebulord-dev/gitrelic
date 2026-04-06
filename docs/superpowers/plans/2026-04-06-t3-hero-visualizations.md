# T3 Hero Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new interactive hero visualizations (Ownership Bubble, Hotspot Scatter, Timeline, Contributor Swimlanes, Coupling Graph, Commit Graph) to the GitLore web dashboard with a switchable toolbar.

**Architecture:** Bottom-up build. Start with core data changes (expose commits on report), shared color utilities, and hero switching infrastructure. Then build each viz as an independent component, easiest first. Each viz receives the same base props and participates in the existing cross-linked selection model.

**Tech Stack:** React 19, d3-hierarchy, d3-scale (existing), d3-force, d3-shape, d3-chord (new), SVG rendering, TypeScript.

**Design spec:** `docs/superpowers/specs/2026-04-06-t3-hero-visualizations-design.md`

---

### Task 1: Expose commits on GitloreReport

Three vizzes (Timeline, Swimlanes, Commit Graph) need per-commit data (date, author, files). Currently `RawCommit[]` is only used internally by analyzers and not included on the report.

**Files:**
- Modify: `packages/core/src/types.ts:1-30` — add `commits` field to `GitloreReport`
- Modify: `packages/core/src/index.ts:4` — export `RawCommit` type
- Modify: `packages/core/src/runner.ts:145-182` — include commits in return
- Test: `packages/core/src/analyzers/churn.test.ts` (existing tests verify nothing breaks)

- [ ] **Step 1: Add `RawCommit` re-export and `commits` field**

In `packages/core/src/types.ts`, add the import and field. Add this import at the top:

```typescript
import type { RawCommit } from './utils/git.js';
```

Add to the `GitloreReport` interface, after the `renameTracking` field:

```typescript
  commits: RawCommit[];
```

In `packages/core/src/index.ts`, add `RawCommit` to the git.ts export:

```typescript
export type { FileStats, RawCommit } from './utils/git.js';
```

- [ ] **Step 2: Include commits in runner return**

In `packages/core/src/runner.ts`, add `commits` to the return object (after `renameTracking`):

```typescript
    renameTracking,
    commits,
```

- [ ] **Step 3: Run existing tests to verify nothing breaks**

Run: `pnpm test:core`
Expected: All 207 tests pass. Adding a field to the report is backward-compatible.

- [ ] **Step 4: Build core to verify type compilation**

Run: `pnpm --filter @gitlore/core build`
Expected: Clean build with no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts packages/core/src/runner.ts
git commit -m "feat(core): expose commits array on GitloreReport for viz consumption"
```

---

### Task 2: Shared color utilities

Multiple vizzes need the same color logic: severity category colors (already in ChurnTreemap) and a new deterministic author-to-color mapping. Extract into a shared module.

**Files:**
- Create: `apps/web/src/utils/colors.ts`
- Modify: `apps/web/src/components/hero/ChurnTreemap.tsx:67-78` — import from shared utils
- Test: `apps/web/src/utils/colors.test.ts`

- [ ] **Step 1: Write failing tests for color utilities**

Create `apps/web/src/utils/colors.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { authorColor, categoryColor } from './colors';

describe('categoryColor', () => {
  it('returns red for critical', () => {
    expect(categoryColor('critical', 0.5)).toBe('rgba(248, 81, 73, 0.5)');
  });

  it('returns amber for warning', () => {
    expect(categoryColor('warning', 1)).toBe('rgba(210, 153, 34, 1)');
  });

  it('returns blue for moderate', () => {
    expect(categoryColor('moderate', 0.3)).toBe('rgba(88, 166, 255, 0.3)');
  });

  it('returns green for low/unknown', () => {
    expect(categoryColor('low', 0.5)).toBe('rgba(63, 185, 80, 0.5)');
    expect(categoryColor('unknown', 0.5)).toBe('rgba(63, 185, 80, 0.5)');
  });
});

describe('authorColor', () => {
  it('returns an hsl string', () => {
    const color = authorColor('alice@dev.com');
    expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it('is deterministic — same email returns same color', () => {
    expect(authorColor('bob@dev.com')).toBe(authorColor('bob@dev.com'));
  });

  it('returns different colors for different emails', () => {
    expect(authorColor('alice@dev.com')).not.toBe(authorColor('bob@dev.com'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/utils/colors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement color utilities**

Create `apps/web/src/utils/colors.ts`:

```typescript
/**
 * Returns an RGBA color string for a hotspot severity category.
 * Moved from ChurnTreemap to share across all hero vizzes.
 */
export function categoryColor(category: string, opacity: number): string {
  switch (category) {
    case 'critical':
      return `rgba(248, 81, 73, ${opacity})`;
    case 'warning':
      return `rgba(210, 153, 34, ${opacity})`;
    case 'moderate':
      return `rgba(88, 166, 255, ${opacity})`;
    default:
      return `rgba(63, 185, 80, ${opacity})`;
  }
}

/**
 * Deterministic author-to-color mapping via simple string hash.
 * Returns an HSL color with fixed saturation/lightness for readability
 * on dark backgrounds. Visually distinct for ~12 authors, degrades
 * gracefully beyond that (some hues will be close).
 */
export function authorColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 60%)`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/utils/colors.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 5: Migrate ChurnTreemap to use shared module**

In `apps/web/src/components/hero/ChurnTreemap.tsx`:

Remove the local `categoryColor` function (lines 67–78) and add this import at the top:

```typescript
import { categoryColor } from '../../utils/colors';
```

- [ ] **Step 6: Verify treemap still works**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/utils/colors.ts apps/web/src/utils/colors.test.ts apps/web/src/components/hero/ChurnTreemap.tsx
git commit -m "refactor(web): extract shared color utilities from ChurnTreemap"
```

---

### Task 3: Hero switching infrastructure

Add `activeHeroViz` state to `useSelection` and refactor the Shell to render a data-driven hero toolbar that switches between viz components.

**Files:**
- Modify: `apps/web/src/hooks/useSelection.ts:1-156` — add HeroViz type + state
- Modify: `apps/web/src/components/layout/Shell.tsx:1-132` — data-driven toolbar + switch

- [ ] **Step 1: Add HeroViz type and state to useSelection**

In `apps/web/src/hooks/useSelection.ts`:

Add the type after the existing type definitions (after the `InspectorTab` type):

```typescript
export type HeroViz =
  | 'treemap'
  | 'ownership'
  | 'coupling'
  | 'commit-graph'
  | 'scatter'
  | 'timeline'
  | 'swimlanes';
```

Add to the `SelectionState` interface:

```typescript
  activeHeroViz: HeroViz;
  setActiveHeroViz: (viz: HeroViz) => void;
```

Add state inside `useSelection()`:

```typescript
  const [activeHeroViz, setActiveHeroViz] = useState<HeroViz>('treemap');
```

Add both to the return object:

```typescript
    activeHeroViz,
    setActiveHeroViz,
```

- [ ] **Step 2: Refactor Shell hero area to data-driven toolbar**

In `apps/web/src/components/layout/Shell.tsx`:

Add the import for `HeroViz`:

```typescript
import type { HeroViz } from '../../hooks/useSelection';
```

Add the toolbar data array before the `Shell` component:

```typescript
const HERO_VIZZES: { id: HeroViz; label: string }[] = [
  { id: 'treemap', label: 'Treemap' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'coupling', label: 'Coupling' },
  { id: 'commit-graph', label: 'Graph' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'swimlanes', label: 'Swimlanes' },
];
```

Replace the hardcoded toolbar (the `{['Treemap', 'Ownership', 'Coupling', 'Graph'].map(...)` block) with:

```tsx
{HERO_VIZZES.map((viz) => (
  <span
    key={viz.id}
    onClick={() => selection.setActiveHeroViz(viz.id)}
    style={{
      padding: '4px 10px',
      borderRadius: 4,
      fontSize: 10,
      cursor: 'pointer',
      color:
        selection.activeHeroViz === viz.id
          ? 'var(--text-primary)'
          : 'var(--text-secondary)',
      background:
        selection.activeHeroViz === viz.id
          ? 'var(--surface-elevated)'
          : 'transparent',
    }}
  >
    {viz.label}
  </span>
))}
```

Replace the hero viz rendering area (the `<ChurnTreemap ... />` call) with a switch:

```tsx
{selection.activeHeroViz === 'treemap' && (
  <ChurnTreemap
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

Other viz cases will be added in subsequent tasks. For now, non-treemap selections show a placeholder:

```tsx
{selection.activeHeroViz !== 'treemap' && (
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
    {selection.activeHeroViz} — coming soon
  </div>
)}
```

- [ ] **Step 3: Verify the build compiles**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build. The toolbar now shows all 7 pills, Treemap still works, other pills show placeholders.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useSelection.ts apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add hero viz switching infrastructure with 7-pill toolbar"
```

---

### Task 4: Ownership Bubble Chart

Packed bubble chart showing file ownership concentration. Bubble size = LOC, color = dominant author.

**Files:**
- Create: `apps/web/src/components/hero/OwnershipBubble.tsx`
- Create: `apps/web/src/components/hero/OwnershipBubble.test.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` — wire in the component

- [ ] **Step 1: Write failing test for the tree-building data transform**

Create `apps/web/src/components/hero/OwnershipBubble.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildOwnershipTree } from './OwnershipBubble';

import type { GitloreReport } from '@gitlore/core';

function makeReport(overrides: Partial<GitloreReport> = {}): GitloreReport {
  return {
    loc: {
      totalFiles: 2,
      totalLines: 200,
      files: [
        { file: 'src/app.ts', lines: 150, language: 'TypeScript' },
        { file: 'src/utils.ts', lines: 50, language: 'TypeScript' },
      ],
      languages: [],
      summary: '',
    },
    busFactors: {
      files: [
        {
          file: 'src/app.ts',
          uniqueAuthors: 2,
          authors: ['alice@dev.com', 'bob@dev.com'],
          dominantAuthor: 'alice@dev.com',
          dominantAuthorPercent: 70,
          risk: 'high' as const,
        },
        {
          file: 'src/utils.ts',
          uniqueAuthors: 1,
          authors: ['bob@dev.com'],
          dominantAuthor: 'bob@dev.com',
          dominantAuthorPercent: 100,
          risk: 'critical' as const,
        },
      ],
      criticalFiles: [],
      overallBusFactor: 1,
      summary: '',
    },
    ...overrides,
  } as GitloreReport;
}

describe('buildOwnershipTree', () => {
  it('creates hierarchy nodes with dominantAuthor', () => {
    const report = makeReport();
    const tree = buildOwnershipTree(report);
    expect(tree.name).toBe('root');
    expect(tree.children).toBeDefined();

    // Flatten to leaves
    const leaves: { name: string; dominantAuthor?: string }[] = [];
    const walk = (n: typeof tree) => {
      if (!n.children?.length) leaves.push(n);
      else n.children.forEach(walk);
    };
    walk(tree);

    const app = leaves.find((l) => l.name === 'app.ts');
    expect(app?.dominantAuthor).toBe('alice@dev.com');
    const utils = leaves.find((l) => l.name === 'utils.ts');
    expect(utils?.dominantAuthor).toBe('bob@dev.com');
  });

  it('uses LOC as value for bubble sizing', () => {
    const report = makeReport();
    const tree = buildOwnershipTree(report);
    const leaves: { name: string; value?: number }[] = [];
    const walk = (n: typeof tree) => {
      if (!n.children?.length) leaves.push(n);
      else n.children.forEach(walk);
    };
    walk(tree);

    const app = leaves.find((l) => l.name === 'app.ts');
    expect(app?.value).toBe(150);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/hero/OwnershipBubble.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement OwnershipBubble component**

Create `apps/web/src/components/hero/OwnershipBubble.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { hierarchy, pack } from 'd3-hierarchy';

import { authorColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface OwnershipBubbleProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface BubbleNode {
  name: string;
  fullPath?: string;
  value?: number;
  dominantAuthor?: string;
  children?: BubbleNode[];
}

export function buildOwnershipTree(report: GitloreReport): BubbleNode {
  const root: BubbleNode = { name: 'root', children: [] };
  const dirMap = new Map<string, BubbleNode>();

  const busFactorMap = new Map<string, string>();
  for (const f of report.busFactors.files) {
    busFactorMap.set(f.file, f.dominantAuthor);
  }

  for (const f of report.loc.files) {
    const parts = f.file.split('/');
    const fName = parts.pop()!;

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(0, i + 1).join('/');
      if (!dirMap.has(key)) {
        const node: BubbleNode = { name: parts[i], children: [] };
        dirMap.set(key, node);
        current.children!.push(node);
      }
      current = dirMap.get(key)!;
    }

    current.children!.push({
      name: fName,
      fullPath: f.file,
      value: Math.max(f.lines, 1),
      dominantAuthor: busFactorMap.get(f.file) ?? 'unknown',
    });
  }

  return root;
}

export function OwnershipBubble({ report, selectedFile, onSelectFile }: OwnershipBubbleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const bubbles = useMemo(() => {
    const tree = buildOwnershipTree(report);
    const root = hierarchy(tree)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = pack<BubbleNode>().size([dims.width, dims.height]).padding(3);
    layout(root);
    return root.leaves();
  }, [report, dims.width, dims.height]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {bubbles.map((leaf) => {
          const d = leaf.data;
          if (!d.fullPath || !leaf.r) return null;
          if (leaf.r < 2) return null;

          const isSelected = selectedFile === d.fullPath;
          const color = authorColor(d.dominantAuthor ?? 'unknown');
          const showLabel = leaf.r > 20;

          return (
            <g
              key={d.fullPath}
              onClick={() => onSelectFile(d.fullPath!)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={leaf.x}
                cy={leaf.y}
                r={leaf.r}
                fill={color}
                fillOpacity={0.3}
                stroke={isSelected ? 'var(--accent-primary)' : color}
                strokeOpacity={isSelected ? 1 : 0.5}
                strokeWidth={isSelected ? 2 : 1}
              />
              {showLabel && (
                <text
                  x={leaf.x}
                  y={leaf.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(leaf.r / 3, 11)}
                  fill="rgba(255,255,255,0.8)"
                  style={{ pointerEvents: 'none' }}
                >
                  {d.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/hero/OwnershipBubble.test.tsx`
Expected: All tests pass.

- [ ] **Step 5: Wire into Shell**

In `apps/web/src/components/layout/Shell.tsx`:

Add import:

```typescript
import { OwnershipBubble } from '../hero/OwnershipBubble';
```

In the hero rendering area, add after the treemap case:

```tsx
{selection.activeHeroViz === 'ownership' && (
  <OwnershipBubble
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

Update the placeholder condition to exclude 'ownership':

```tsx
{selection.activeHeroViz !== 'treemap' &&
  selection.activeHeroViz !== 'ownership' && (
```

- [ ] **Step 6: Build and verify**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/hero/OwnershipBubble.tsx apps/web/src/components/hero/OwnershipBubble.test.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add ownership bubble chart hero viz"
```

---

### Task 5: Hotspot Scatter Plot

Standard scatter plot: X = churn, Y = LOC, dot size = hotspot score, color = severity.

**Files:**
- Create: `apps/web/src/components/hero/HotspotScatter.tsx`
- Create: `apps/web/src/components/hero/HotspotScatter.test.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` — wire in

- [ ] **Step 1: Write failing test for scatter data preparation**

Create `apps/web/src/components/hero/HotspotScatter.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { prepareScatterData } from './HotspotScatter';

import type { GitloreReport } from '@gitlore/core';

function makeReport(): GitloreReport {
  return {
    churn: {
      files: [
        { file: 'a.ts', commitCount: 20, churnScore: 80, category: 'hot' as const },
        { file: 'b.ts', commitCount: 5, churnScore: 20, category: 'cold' as const },
      ],
      topFiles: [],
      hotspotCount: 1,
      summary: '',
    },
    loc: {
      totalFiles: 2,
      totalLines: 300,
      files: [
        { file: 'a.ts', lines: 200, language: 'TypeScript' },
        { file: 'b.ts', lines: 100, language: 'TypeScript' },
      ],
      languages: [],
      summary: '',
    },
    hotspots: {
      files: [
        { file: 'a.ts', hotspotScore: 90, churnScore: 80, loc: 200, category: 'critical' as const },
        { file: 'b.ts', hotspotScore: 15, churnScore: 20, loc: 100, category: 'low' as const },
      ],
      topHotspots: [],
      summary: '',
    },
  } as GitloreReport;
}

describe('prepareScatterData', () => {
  it('returns points with churn, loc, score, and category', () => {
    const points = prepareScatterData(makeReport());
    expect(points).toHaveLength(2);

    const a = points.find((p) => p.file === 'a.ts');
    expect(a).toEqual({
      file: 'a.ts',
      churn: 20,
      loc: 200,
      hotspotScore: 90,
      category: 'critical',
    });
  });

  it('only includes files present in both churn and loc', () => {
    const report = makeReport();
    report.churn.files.push({
      file: 'orphan.ts',
      commitCount: 10,
      churnScore: 50,
      category: 'warm' as 'warm',
    });
    const points = prepareScatterData(report);
    expect(points.find((p) => p.file === 'orphan.ts')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/hero/HotspotScatter.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement HotspotScatter**

Create `apps/web/src/components/hero/HotspotScatter.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import { categoryColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface HotspotScatterProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export interface ScatterPoint {
  file: string;
  churn: number;
  loc: number;
  hotspotScore: number;
  category: string;
}

const PADDING = { top: 20, right: 20, bottom: 40, left: 50 };

export function prepareScatterData(report: GitloreReport): ScatterPoint[] {
  const locMap = new Map<string, number>();
  for (const f of report.loc.files) {
    locMap.set(f.file, f.lines);
  }

  const hotspotMap = new Map<string, { score: number; category: string }>();
  for (const h of report.hotspots.files) {
    hotspotMap.set(h.file, { score: h.hotspotScore, category: h.category });
  }

  const points: ScatterPoint[] = [];
  for (const c of report.churn.files) {
    const loc = locMap.get(c.file);
    const hotspot = hotspotMap.get(c.file);
    if (loc == null || !hotspot) continue;

    points.push({
      file: c.file,
      churn: c.commitCount,
      loc,
      hotspotScore: hotspot.score,
      category: hotspot.category,
    });
  }

  return points;
}

export function HotspotScatter({ report, selectedFile, onSelectFile }: HotspotScatterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => prepareScatterData(report), [report]);

  const { xScale, yScale, rScale } = useMemo(() => {
    const w = dims.width - PADDING.left - PADDING.right;
    const h = dims.height - PADDING.top - PADDING.bottom;
    const maxChurn = Math.max(...points.map((p) => p.churn), 1);
    const maxLoc = Math.max(...points.map((p) => p.loc), 1);
    const maxScore = Math.max(...points.map((p) => p.hotspotScore), 1);

    return {
      xScale: scaleLinear().domain([0, maxChurn]).range([0, w]),
      yScale: scaleLinear().domain([0, maxLoc]).range([h, 0]),
      rScale: scaleLinear().domain([0, maxScore]).range([3, 18]),
    };
  }, [points, dims.width, dims.height]);

  const plotW = dims.width - PADDING.left - PADDING.right;
  const plotH = dims.height - PADDING.top - PADDING.bottom;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Quadrant hint */}
          <text
            x={plotW - 4}
            y={4}
            textAnchor="end"
            fontSize={9}
            fill="rgba(255,255,255,0.12)"
          >
            high churn + high complexity
          </text>

          {/* X axis */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
          <text x={plotW / 2} y={plotH + 30} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">
            Churn (commits)
          </text>

          {/* Y axis */}
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--border-primary)" />
          <text
            transform={`translate(-35,${plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Lines of Code
          </text>

          {/* Data points */}
          {points.map((p) => {
            const cx = xScale(p.churn);
            const cy = yScale(p.loc);
            const r = rScale(p.hotspotScore);
            const isSelected = selectedFile === p.file;

            return (
              <circle
                key={p.file}
                cx={cx}
                cy={cy}
                r={r}
                fill={categoryColor(p.category, 0.4)}
                stroke={isSelected ? 'var(--accent-primary)' : categoryColor(p.category, 0.7)}
                strokeWidth={isSelected ? 2.5 : 1}
                onClick={() => onSelectFile(p.file)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run src/components/hero/HotspotScatter.test.tsx`
Expected: All tests pass.

- [ ] **Step 5: Wire into Shell**

In `apps/web/src/components/layout/Shell.tsx`:

Add import:

```typescript
import { HotspotScatter } from '../hero/HotspotScatter';
```

Add case in hero rendering:

```tsx
{selection.activeHeroViz === 'scatter' && (
  <HotspotScatter
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

Update the placeholder condition to also exclude `'scatter'`.

- [ ] **Step 6: Build and verify**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/hero/HotspotScatter.tsx apps/web/src/components/hero/HotspotScatter.test.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add hotspot scatter plot hero viz"
```

---

### Task 6: Timeline (Stacked Area Chart)

Commits over time stacked by contributor. Requires `d3-shape` for area generators.

**Files:**
- Create: `apps/web/src/components/hero/Timeline.tsx`
- Create: `apps/web/src/components/hero/Timeline.test.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` — wire in
- Modify: `apps/web/package.json` — add d3-shape dependency

- [ ] **Step 1: Install d3-shape**

Run: `pnpm --filter @gitlore/web add d3-shape && pnpm --filter @gitlore/web add -D @types/d3-shape`

- [ ] **Step 2: Write failing test for weekly binning logic**

Create `apps/web/src/components/hero/Timeline.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { binCommitsByWeek } from './Timeline';

import type { RawCommit } from '@gitlore/core';

function makeCommit(overrides: Partial<RawCommit>): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@dev.com',
    authorName: 'Alice',
    date: '2025-06-02T10:00:00Z',
    message: 'test',
    files: ['a.ts'],
    fileStats: [],
    insertions: 10,
    deletions: 5,
    ...overrides,
  };
}

describe('binCommitsByWeek', () => {
  it('bins commits into weekly buckets per author', () => {
    const commits = [
      makeCommit({ date: '2025-06-02T10:00:00Z', authorEmail: 'alice@dev.com' }),
      makeCommit({ date: '2025-06-03T10:00:00Z', authorEmail: 'alice@dev.com' }),
      makeCommit({ date: '2025-06-03T10:00:00Z', authorEmail: 'bob@dev.com' }),
      makeCommit({ date: '2025-06-09T10:00:00Z', authorEmail: 'alice@dev.com' }),
    ];

    const { weeks, authors } = binCommitsByWeek(commits);

    expect(authors).toContain('alice@dev.com');
    expect(authors).toContain('bob@dev.com');
    expect(weeks.length).toBeGreaterThanOrEqual(2);

    // First week should have 2 alice + 1 bob
    const firstWeek = weeks[0];
    expect(firstWeek.counts['alice@dev.com']).toBe(2);
    expect(firstWeek.counts['bob@dev.com']).toBe(1);
  });

  it('returns authors sorted by total commits descending', () => {
    const commits = [
      makeCommit({ authorEmail: 'alice@dev.com' }),
      makeCommit({ authorEmail: 'alice@dev.com' }),
      makeCommit({ authorEmail: 'bob@dev.com' }),
    ];

    const { authors } = binCommitsByWeek(commits);
    expect(authors[0]).toBe('alice@dev.com');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/hero/Timeline.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement Timeline component**

Create `apps/web/src/components/hero/Timeline.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear, scaleTime } from 'd3-scale';
import { area, stack, stackOrderNone, stackOffsetNone } from 'd3-shape';

import { authorColor } from '../../utils/colors';

import type { GitloreReport, RawCommit } from '@gitlore/core';

interface TimelineProps {
  report: GitloreReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
}

export interface WeekBin {
  weekStart: Date;
  counts: Record<string, number>;
}

const PADDING = { top: 20, right: 20, bottom: 30, left: 40 };
const MAX_AUTHORS = 8;

/**
 * Bin commits into weekly buckets grouped by author.
 * Returns week bins and author list sorted by total commits descending.
 */
export function binCommitsByWeek(commits: RawCommit[]): {
  weeks: WeekBin[];
  authors: string[];
} {
  if (commits.length === 0) return { weeks: [], authors: [] };

  // Count commits per author for sorting
  const authorTotals = new Map<string, number>();
  for (const c of commits) {
    authorTotals.set(c.authorEmail, (authorTotals.get(c.authorEmail) ?? 0) + 1);
  }
  const authors = [...authorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([email]) => email);

  // Find date range
  const dates = commits.map((c) => new Date(c.date).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  // Align to Monday
  const startMonday = new Date(minDate);
  startMonday.setUTCDate(startMonday.getUTCDate() - ((startMonday.getUTCDay() + 6) % 7));
  startMonday.setUTCHours(0, 0, 0, 0);

  // Build empty bins
  const bins: WeekBin[] = [];
  const cursor = new Date(startMonday);
  while (cursor <= maxDate) {
    const counts: Record<string, number> = {};
    for (const a of authors) counts[a] = 0;
    bins.push({ weekStart: new Date(cursor), counts });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  // Fill bins
  for (const c of commits) {
    const d = new Date(c.date);
    const weekIdx = Math.floor(
      (d.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    if (weekIdx >= 0 && weekIdx < bins.length) {
      bins[weekIdx].counts[c.authorEmail] =
        (bins[weekIdx].counts[c.authorEmail] ?? 0) + 1;
    }
  }

  return { weeks: bins, authors };
}

export function Timeline({
  report,
  selectedContributor,
  onSelectContributor,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { weeks, authors } = useMemo(
    () => binCommitsByWeek(report.commits ?? []),
    [report.commits],
  );

  const displayAuthors = authors.slice(0, MAX_AUTHORS);
  const hasOthers = authors.length > MAX_AUTHORS;
  const stackKeys = hasOthers ? [...displayAuthors, '__others__'] : displayAuthors;

  const stackData = useMemo(() => {
    return weeks.map((w) => {
      const row: Record<string, number | Date> = { weekStart: w.weekStart };
      for (const a of displayAuthors) {
        row[a] = w.counts[a] ?? 0;
      }
      if (hasOthers) {
        let othersTotal = 0;
        for (const a of authors.slice(MAX_AUTHORS)) {
          othersTotal += w.counts[a] ?? 0;
        }
        row.__others__ = othersTotal;
      }
      return row;
    });
  }, [weeks, displayAuthors, hasOthers, authors]);

  const plotW = dims.width - PADDING.left - PADDING.right;
  const plotH = dims.height - PADDING.top - PADDING.bottom;

  const paths = useMemo(() => {
    if (weeks.length === 0) return [];

    const xScale = scaleTime()
      .domain([weeks[0].weekStart, weeks[weeks.length - 1].weekStart])
      .range([0, plotW]);

    const stacker = stack<Record<string, number | Date>>()
      .keys(stackKeys)
      .order(stackOrderNone)
      .offset(stackOffsetNone);

    const series = stacker(stackData as Record<string, number>[]);

    const maxY = Math.max(
      ...series.flatMap((s) => s.map((d) => d[1])),
      1,
    );
    const yScale = scaleLinear().domain([0, maxY]).range([plotH, 0]);

    const areaGen = area<[number, number]>()
      .x((_d, i) => xScale(weeks[i].weekStart))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]));

    return series.map((s) => ({
      key: s.key,
      d: areaGen(s as unknown as [number, number][]) ?? '',
    }));
  }, [weeks, stackKeys, stackData, plotW, plotH]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* X axis line */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />

          {/* Stacked areas */}
          {paths.map(({ key, d }) => {
            const isSelected = selectedContributor === key;
            const isOthers = key === '__others__';
            const color = isOthers ? 'var(--text-tertiary)' : authorColor(key);
            const dimmed = selectedContributor != null && !isSelected && !isOthers;

            return (
              <path
                key={key}
                d={d}
                fill={color}
                fillOpacity={dimmed ? 0.08 : 0.35}
                stroke={color}
                strokeOpacity={dimmed ? 0.1 : 0.6}
                strokeWidth={isSelected ? 1.5 : 0.5}
                onClick={() => {
                  if (!isOthers) onSelectContributor(key);
                }}
                style={{ cursor: isOthers ? 'default' : 'pointer' }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run src/components/hero/Timeline.test.tsx`
Expected: All tests pass.

- [ ] **Step 6: Wire into Shell**

In `apps/web/src/components/layout/Shell.tsx`:

Add import:

```typescript
import { Timeline } from '../hero/Timeline';
```

Add case:

```tsx
{selection.activeHeroViz === 'timeline' && (
  <Timeline
    report={report}
    selectedFile={selection.selectedFile}
    selectedContributor={selection.selectedContributor}
    onSelectFile={selection.selectFile}
    onSelectContributor={selection.selectContributor}
  />
)}
```

Update the placeholder condition to also exclude `'timeline'`.

- [ ] **Step 7: Build and verify**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/hero/Timeline.tsx apps/web/src/components/hero/Timeline.test.tsx apps/web/src/components/layout/Shell.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add stacked area timeline hero viz"
```

---

### Task 7: Contributor Swimlanes

Three-layer swimlane visualization: activity bars, commit dots, intensity heatstrip.

**Files:**
- Create: `apps/web/src/components/hero/ContributorSwimlanes.tsx`
- Create: `apps/web/src/components/hero/ContributorSwimlanes.test.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` — wire in

- [ ] **Step 1: Write failing test for swimlane data preparation**

Create `apps/web/src/components/hero/ContributorSwimlanes.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { prepareSwimlaneData } from './ContributorSwimlanes';

import type { GitloreReport, RawCommit } from '@gitlore/core';

function makeCommit(overrides: Partial<RawCommit>): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@dev.com',
    authorName: 'Alice',
    date: '2025-06-02T10:00:00Z',
    message: 'test',
    files: ['a.ts'],
    fileStats: [],
    insertions: 10,
    deletions: 5,
    ...overrides,
  };
}

function makeReport(commits: RawCommit[]): GitloreReport {
  return {
    commits,
    hotspots: {
      files: [{ file: 'hot.ts', hotspotScore: 90, churnScore: 80, loc: 200, category: 'critical' }],
      topHotspots: [],
      summary: '',
    },
    ghostFiles: {
      files: [
        {
          file: 'old.ts',
          dominantAuthor: 'ghost@dev.com',
          dominantAuthorPercent: 100,
          lastAuthorCommitDate: '2025-01-01T00:00:00Z',
          authorInactiveDays: 180,
          loc: 50,
        },
      ],
      totalGhostFiles: 1,
      summary: '',
    },
    contributors: {
      contributors: [
        {
          email: 'alice@dev.com',
          name: 'Alice',
          commitCount: 3,
          firstCommit: '2025-06-02T10:00:00Z',
          lastCommit: '2025-06-16T10:00:00Z',
          filesOwned: 1,
          linesChanged: 30,
          activeDays: 3,
          focusAreas: [],
          isActive: true,
        },
      ],
      activeContributors: [],
      ghostContributors: [],
      topContributor: {} as any,
      summary: '',
    },
  } as GitloreReport;
}

describe('prepareSwimlaneData', () => {
  it('returns one lane per contributor sorted by commit count', () => {
    const commits = [
      makeCommit({ authorEmail: 'alice@dev.com', date: '2025-06-02T10:00:00Z' }),
      makeCommit({ authorEmail: 'alice@dev.com', date: '2025-06-03T10:00:00Z' }),
      makeCommit({ authorEmail: 'bob@dev.com', date: '2025-06-02T10:00:00Z' }),
    ];
    const report = makeReport(commits);
    report.contributors.contributors.push({
      email: 'bob@dev.com',
      name: 'Bob',
      commitCount: 1,
      firstCommit: '2025-06-02T10:00:00Z',
      lastCommit: '2025-06-02T10:00:00Z',
      filesOwned: 0,
      linesChanged: 10,
      activeDays: 1,
      focusAreas: [],
      isActive: true,
    });

    const lanes = prepareSwimlaneData(report);
    expect(lanes[0].email).toBe('alice@dev.com');
    expect(lanes[0].commits).toHaveLength(2);
    expect(lanes[1].email).toBe('bob@dev.com');
  });

  it('marks commits touching hotspot files', () => {
    const commits = [
      makeCommit({ files: ['hot.ts'], date: '2025-06-02T10:00:00Z' }),
      makeCommit({ files: ['safe.ts'], date: '2025-06-03T10:00:00Z' }),
    ];
    const report = makeReport(commits);
    const lanes = prepareSwimlaneData(report);

    const hotCommit = lanes[0].commits.find((c) => c.isHotspot);
    expect(hotCommit).toBeDefined();

    const safeCommit = lanes[0].commits.find((c) => !c.isHotspot);
    expect(safeCommit).toBeDefined();
  });

  it('identifies ghost contributors', () => {
    const commits = [
      makeCommit({ authorEmail: 'ghost@dev.com', date: '2025-01-15T10:00:00Z' }),
    ];
    const report = makeReport(commits);
    report.contributors.contributors.push({
      email: 'ghost@dev.com',
      name: 'Ghost',
      commitCount: 1,
      firstCommit: '2025-01-15T10:00:00Z',
      lastCommit: '2025-01-15T10:00:00Z',
      filesOwned: 0,
      linesChanged: 10,
      activeDays: 1,
      focusAreas: [],
      isActive: false,
    });

    const lanes = prepareSwimlaneData(report);
    const ghostLane = lanes.find((l) => l.email === 'ghost@dev.com');
    expect(ghostLane?.isGhost).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/hero/ContributorSwimlanes.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement ContributorSwimlanes**

Create `apps/web/src/components/hero/ContributorSwimlanes.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear, scaleTime } from 'd3-scale';

import { authorColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface ContributorSwimlanesProps {
  report: GitloreReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
}

export interface SwimCommit {
  date: Date;
  files: string[];
  isHotspot: boolean;
}

export interface SwimLane {
  email: string;
  name: string;
  commitCount: number;
  commits: SwimCommit[];
  weeklyIntensity: number[]; // per-week commit count
  isGhost: boolean;
  lastActiveDate: Date | null;
}

const LANE_HEIGHT = 56;
const HEATSTRIP_H = 8;
const LABEL_WIDTH = 130;

export function prepareSwimlaneData(report: GitloreReport): SwimLane[] {
  const commits = report.commits ?? [];
  const hotspotFiles = new Set(
    report.hotspots.files.filter((h) => h.category === 'critical' || h.category === 'warning').map((h) => h.file),
  );
  const ghostAuthors = new Set(report.ghostFiles.files.map((g) => g.dominantAuthor));

  // Group commits by author
  const byAuthor = new Map<string, SwimCommit[]>();
  for (const c of commits) {
    const isHotspot = c.files.some((f) => hotspotFiles.has(f));
    const entry: SwimCommit = { date: new Date(c.date), files: c.files, isHotspot };
    const arr = byAuthor.get(c.authorEmail) ?? [];
    arr.push(entry);
    byAuthor.set(c.authorEmail, arr);
  }

  // Date range for weekly binning
  if (commits.length === 0) return [];
  const allDates = commits.map((c) => new Date(c.date).getTime());
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const startMonday = new Date(minDate);
  startMonday.setUTCDate(startMonday.getUTCDate() - ((startMonday.getUTCDay() + 6) % 7));
  startMonday.setUTCHours(0, 0, 0, 0);
  const totalWeeks = Math.ceil((maxDate.getTime() - startMonday.getTime()) / (7 * 86_400_000)) + 1;

  // Build lanes from contributor report (sorted by commit count)
  const sorted = [...report.contributors.contributors].sort(
    (a, b) => b.commitCount - a.commitCount,
  );

  return sorted.map((contrib) => {
    const authorCommits = byAuthor.get(contrib.email) ?? [];
    const weekly = new Array(totalWeeks).fill(0);
    for (const c of authorCommits) {
      const idx = Math.floor((c.date.getTime() - startMonday.getTime()) / (7 * 86_400_000));
      if (idx >= 0 && idx < totalWeeks) weekly[idx]++;
    }

    const isGhost = ghostAuthors.has(contrib.email) || !contrib.isActive;
    const lastActiveDate = authorCommits.length > 0
      ? new Date(Math.max(...authorCommits.map((c) => c.date.getTime())))
      : null;

    return {
      email: contrib.email,
      name: contrib.name,
      commitCount: contrib.commitCount,
      commits: authorCommits.sort((a, b) => a.date.getTime() - b.date.getTime()),
      weeklyIntensity: weekly,
      isGhost,
      lastActiveDate,
    };
  });
}

export function ContributorSwimlanes({
  report,
  selectedContributor,
  onSelectFile,
  onSelectContributor,
}: ContributorSwimlanesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const lanes = useMemo(() => prepareSwimlaneData(report), [report]);

  const timeRange = useMemo(() => {
    const commits = report.commits ?? [];
    if (commits.length === 0) return { min: new Date(), max: new Date() };
    const dates = commits.map((c) => new Date(c.date).getTime());
    return { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) };
  }, [report.commits]);

  const trackWidth = width - LABEL_WIDTH;
  const xScale = scaleTime().domain([timeRange.min, timeRange.max]).range([0, trackWidth]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative' }}
    >
      {lanes.map((lane) => {
        const isSelected = selectedContributor === lane.email;
        const color = authorColor(lane.email);
        const maxWeekly = Math.max(...lane.weeklyIntensity, 1);
        const intensityScale = scaleLinear().domain([0, maxWeekly]).range([0.03, 0.8]);

        return (
          <div
            key={lane.email}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: LANE_HEIGHT,
              marginBottom: 4,
            }}
          >
            {/* Name label */}
            <div
              onClick={() => onSelectContributor(lane.email)}
              style={{
                width: LABEL_WIDTH,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                paddingRight: 12,
                cursor: 'pointer',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    fontWeight: isSelected ? 700 : 600,
                  }}
                >
                  {lane.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  {lane.isGhost && (
                    <span style={{ color: 'rgba(248,81,73,0.8)', marginRight: 4 }}>ghost</span>
                  )}
                  {lane.commitCount} commits
                </div>
              </div>
            </div>

            {/* Swimlane track */}
            <div
              style={{
                flex: 1,
                position: 'relative',
                borderRadius: 4,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {/* Layer 1: Activity bars */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  padding: `4px 2px ${HEATSTRIP_H + 2}px 2px`,
                  display: 'flex',
                  gap: 1,
                  alignItems: 'stretch',
                }}
              >
                {lane.weeklyIntensity.map((count, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      background: count > 0 ? `${color}` : 'transparent',
                      opacity: count > 0 ? 0.15 + intensityScale(count) * 0.15 : 0,
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>

              {/* Layer 2: Commit dots */}
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  bottom: HEATSTRIP_H,
                  pointerEvents: 'none',
                }}
                width={trackWidth}
                height={LANE_HEIGHT - HEATSTRIP_H}
              >
                {lane.commits.map((c, i) => {
                  const cx = xScale(c.date);
                  const cy = (LANE_HEIGHT - HEATSTRIP_H) / 2;
                  return (
                    <circle
                      key={i}
                      cx={cx}
                      cy={cy}
                      r={c.isHotspot ? 3 : 2.5}
                      fill={c.isHotspot ? 'rgba(248,81,73,0.9)' : color}
                      fillOpacity={c.isHotspot ? 0.9 : 0.7}
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (c.files.length > 0) onSelectFile(c.files[0]);
                      }}
                    />
                  );
                })}
              </svg>

              {/* Layer 3: Heatstrip */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: HEATSTRIP_H,
                  display: 'flex',
                  gap: 1,
                  padding: '0 2px',
                }}
              >
                {lane.weeklyIntensity.map((count, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      background: color,
                      opacity: intensityScale(count),
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>

              {/* Ghost cutoff line */}
              {lane.isGhost && lane.lastActiveDate && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: xScale(lane.lastActiveDate),
                      borderLeft: '1px dashed rgba(248,81,73,0.3)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: xScale(lane.lastActiveDate) + 4,
                      fontSize: 8,
                      color: 'rgba(248,81,73,0.5)',
                    }}
                  >
                    inactive
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run src/components/hero/ContributorSwimlanes.test.tsx`
Expected: All tests pass.

- [ ] **Step 5: Wire into Shell**

In `apps/web/src/components/layout/Shell.tsx`:

Add import:

```typescript
import { ContributorSwimlanes } from '../hero/ContributorSwimlanes';
```

Add case:

```tsx
{selection.activeHeroViz === 'swimlanes' && (
  <ContributorSwimlanes
    report={report}
    selectedFile={selection.selectedFile}
    selectedContributor={selection.selectedContributor}
    onSelectFile={selection.selectFile}
    onSelectContributor={selection.selectContributor}
  />
)}
```

Update the placeholder condition to also exclude `'swimlanes'`.

- [ ] **Step 6: Build and verify**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/hero/ContributorSwimlanes.tsx apps/web/src/components/hero/ContributorSwimlanes.test.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add contributor swimlanes hero viz with three-layer design"
```

---

### Task 8: Coupling Graph (Adaptive)

Force-directed graph for ≤50 files, chord diagram for >50. Requires `d3-force` and `d3-chord`.

**Files:**
- Create: `apps/web/src/components/hero/CouplingGraph.tsx` (wrapper)
- Create: `apps/web/src/components/hero/CouplingForceGraph.tsx`
- Create: `apps/web/src/components/hero/CouplingChord.tsx`
- Create: `apps/web/src/components/hero/CouplingGraph.test.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install d3-force and d3-chord**

Run: `pnpm --filter @gitlore/web add d3-force d3-chord && pnpm --filter @gitlore/web add -D @types/d3-force @types/d3-chord`

- [ ] **Step 2: Write failing tests for threshold logic and node extraction**

Create `apps/web/src/components/hero/CouplingGraph.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { countUniqueFiles, COUPLING_THRESHOLD } from './CouplingGraph';

import type { CoupledPair } from '@gitlore/core';

describe('countUniqueFiles', () => {
  it('counts unique files across pairs', () => {
    const pairs: CoupledPair[] = [
      { fileA: 'a.ts', fileB: 'b.ts', coCommits: 5, totalCommitsA: 10, totalCommitsB: 8, couplingStrength: 0.5 },
      { fileA: 'a.ts', fileB: 'c.ts', coCommits: 3, totalCommitsA: 10, totalCommitsB: 6, couplingStrength: 0.3 },
    ];
    expect(countUniqueFiles(pairs)).toBe(3); // a, b, c
  });

  it('returns 0 for empty array', () => {
    expect(countUniqueFiles([])).toBe(0);
  });
});

describe('COUPLING_THRESHOLD', () => {
  it('is 50', () => {
    expect(COUPLING_THRESHOLD).toBe(50);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/components/hero/CouplingGraph.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement CouplingForceGraph**

Create `apps/web/src/components/hero/CouplingForceGraph.tsx`:

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force';

import { categoryColor } from '../../utils/colors';

import type { GitloreReport, CoupledPair } from '@gitlore/core';

interface CouplingForceGraphProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface GraphNode {
  id: string;
  hotspotScore: number;
  category: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

function buildGraph(
  pairs: CoupledPair[],
  report: GitloreReport,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodeSet = new Set<string>();
  const links: GraphLink[] = [];

  for (const p of pairs) {
    nodeSet.add(p.fileA);
    nodeSet.add(p.fileB);
    links.push({ source: p.fileA, target: p.fileB, strength: p.couplingStrength });
  }

  const hotspotMap = new Map<string, { score: number; category: string }>();
  for (const h of report.hotspots.files) {
    hotspotMap.set(h.file, { score: h.hotspotScore, category: h.category });
  }

  const nodes: GraphNode[] = [...nodeSet].map((id) => {
    const h = hotspotMap.get(id);
    return { id, hotspotScore: h?.score ?? 0, category: h?.category ?? 'low' };
  });

  return { nodes, links };
}

export function CouplingForceGraph({ report, selectedFile, onSelectFile }: CouplingForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { nodes, links } = useMemo(
    () => buildGraph(report.coupling.topPairs, report),
    [report],
  );

  useEffect(() => {
    if (nodes.length === 0) return;

    const simNodes = nodes.map((n) => ({ ...n, x: dims.width / 2, y: dims.height / 2 }));
    const simLinks = links.map((l) => ({ ...l }));

    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(80)
          .strength((d: any) => d.strength),
      )
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(dims.width / 2, dims.height / 2));

    sim.on('tick', () => {
      const positions = new Map<string, { x: number; y: number }>();
      for (const n of simNodes) {
        positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
      }
      setNodePositions(new Map(positions));
    });

    return () => { sim.stop(); };
  }, [nodes, links, dims.width, dims.height]);

  const rScale = useMemo(() => {
    const maxScore = Math.max(...nodes.map((n) => n.hotspotScore), 1);
    return (score: number) => 5 + (score / maxScore) * 15;
  }, [nodes]);

  const getPos = useCallback(
    (id: string) => nodePositions.get(id) ?? { x: dims.width / 2, y: dims.height / 2 },
    [nodePositions, dims],
  );

  const fileName = (path: string) => path.split('/').pop() ?? path;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        {/* Edges */}
        {links.map((l, i) => {
          const s = getPos(l.source);
          const t = getPos(l.target);
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke="rgba(88,166,255,0.3)"
              strokeWidth={1 + l.strength * 3}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const pos = getPos(n.id);
          const r = rScale(n.hotspotScore);
          const isSelected = selectedFile === n.id;
          const showLabel = r > 8;

          return (
            <g
              key={n.id}
              onClick={() => onSelectFile(n.id)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={categoryColor(n.category, 0.4)}
                stroke={isSelected ? 'var(--accent-primary)' : categoryColor(n.category, 0.6)}
                strokeWidth={isSelected ? 2 : 1}
              />
              {showLabel && (
                <text
                  x={pos.x}
                  y={pos.y + r + 10}
                  textAnchor="middle"
                  fontSize={8}
                  fill="rgba(255,255,255,0.6)"
                  style={{ pointerEvents: 'none' }}
                >
                  {fileName(n.id)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Implement CouplingChord**

Create `apps/web/src/components/hero/CouplingChord.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { chord, ribbon } from 'd3-chord';
import { scaleOrdinal } from 'd3-scale';
import { arc } from 'd3-shape';

import { authorColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface CouplingChordProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

function getDirectory(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 1) return '.';
  return parts.slice(0, -1).join('/');
}

export function CouplingChord({ report, selectedFile, onSelectFile }: CouplingChordProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { matrix, dirs, dirFiles } = useMemo(() => {
    // Group coupling pairs by directory
    const dirSet = new Set<string>();
    const dirFilesMap = new Map<string, Set<string>>();
    for (const p of report.coupling.topPairs) {
      const dA = getDirectory(p.fileA);
      const dB = getDirectory(p.fileB);
      dirSet.add(dA);
      dirSet.add(dB);

      if (!dirFilesMap.has(dA)) dirFilesMap.set(dA, new Set());
      if (!dirFilesMap.has(dB)) dirFilesMap.set(dB, new Set());
      dirFilesMap.get(dA)!.add(p.fileA);
      dirFilesMap.get(dB)!.add(p.fileB);
    }

    const dirs = [...dirSet].sort();
    const dirIdx = new Map(dirs.map((d, i) => [d, i]));
    const n = dirs.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (const p of report.coupling.topPairs) {
      const iA = dirIdx.get(getDirectory(p.fileA))!;
      const iB = dirIdx.get(getDirectory(p.fileB))!;
      if (iA !== iB) {
        matrix[iA][iB] += p.coCommits;
        matrix[iB][iA] += p.coCommits;
      }
    }

    return { matrix, dirs, dirFiles: dirFilesMap };
  }, [report.coupling.topPairs]);

  const radius = Math.min(dims.width, dims.height) / 2 - 40;
  const innerRadius = radius - 20;

  const chordLayout = useMemo(() => chord().padAngle(0.04)(matrix), [matrix]);

  const arcGen = arc<any>().innerRadius(innerRadius).outerRadius(radius);
  const ribbonGen = ribbon<any, any>().radius(innerRadius);

  const colorScale = scaleOrdinal<string>()
    .domain(dirs)
    .range(dirs.map((d) => authorColor(d)));

  const selectedDir = selectedFile ? getDirectory(selectedFile) : null;

  const dirLabel = (d: string) => {
    const parts = d.split('/');
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : d;
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${dims.width / 2},${dims.height / 2})`}>
          {/* Arcs (directories) */}
          {chordLayout.groups.map((g, i) => {
            const isSelected = selectedDir === dirs[i];
            return (
              <g key={dirs[i]}>
                <path
                  d={arcGen(g) ?? ''}
                  fill={colorScale(dirs[i])}
                  fillOpacity={isSelected ? 0.8 : 0.5}
                  stroke={isSelected ? 'var(--accent-primary)' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                  onClick={() => {
                    const files = dirFiles.get(dirs[i]);
                    if (files) onSelectFile([...files][0]);
                  }}
                  style={{ cursor: 'pointer' }}
                />
                {g.endAngle - g.startAngle > 0.15 && (
                  <text
                    transform={`rotate(${((g.startAngle + g.endAngle) / 2 * 180) / Math.PI - 90}) translate(${radius + 8})`}
                    textAnchor={((g.startAngle + g.endAngle) / 2) > Math.PI ? 'end' : 'start'}
                    fontSize={9}
                    fill="var(--text-secondary)"
                    style={{
                      transform: ((g.startAngle + g.endAngle) / 2) > Math.PI
                        ? `rotate(${((g.startAngle + g.endAngle) / 2 * 180) / Math.PI - 90}deg) translate(${radius + 8}px) rotate(180deg)`
                        : undefined,
                    }}
                  >
                    {dirLabel(dirs[i])}
                  </text>
                )}
              </g>
            );
          })}

          {/* Chords (relationships) */}
          {chordLayout.map((c, i) => {
            const srcDir = dirs[c.source.index];
            const tgtDir = dirs[c.target.index];
            const involves = selectedDir === srcDir || selectedDir === tgtDir;
            return (
              <path
                key={i}
                d={ribbonGen(c) ?? ''}
                fill={colorScale(srcDir)}
                fillOpacity={selectedDir == null ? 0.15 : involves ? 0.3 : 0.04}
                stroke={colorScale(srcDir)}
                strokeOpacity={selectedDir == null ? 0.2 : involves ? 0.4 : 0.05}
                strokeWidth={0.5}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 6: Implement CouplingGraph wrapper with threshold**

Create `apps/web/src/components/hero/CouplingGraph.tsx`:

```typescript
import { useMemo } from 'react';

import { CouplingChord } from './CouplingChord';
import { CouplingForceGraph } from './CouplingForceGraph';

import type { GitloreReport, CoupledPair } from '@gitlore/core';

interface CouplingGraphProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export const COUPLING_THRESHOLD = 50;

export function countUniqueFiles(pairs: CoupledPair[]): number {
  const files = new Set<string>();
  for (const p of pairs) {
    files.add(p.fileA);
    files.add(p.fileB);
  }
  return files.size;
}

export function CouplingGraph({ report, selectedFile, onSelectFile }: CouplingGraphProps) {
  const uniqueCount = useMemo(
    () => countUniqueFiles(report.coupling.topPairs),
    [report.coupling.topPairs],
  );

  if (uniqueCount <= COUPLING_THRESHOLD) {
    return (
      <CouplingForceGraph
        report={report}
        selectedFile={selectedFile}
        onSelectFile={onSelectFile}
      />
    );
  }

  return (
    <CouplingChord
      report={report}
      selectedFile={selectedFile}
      onSelectFile={onSelectFile}
    />
  );
}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/web && npx vitest run src/components/hero/CouplingGraph.test.tsx`
Expected: All tests pass.

- [ ] **Step 8: Wire into Shell**

In `apps/web/src/components/layout/Shell.tsx`:

Add import:

```typescript
import { CouplingGraph } from '../hero/CouplingGraph';
```

Add case:

```tsx
{selection.activeHeroViz === 'coupling' && (
  <CouplingGraph
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

Update the placeholder condition to also exclude `'coupling'`.

- [ ] **Step 9: Build and verify**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/hero/CouplingGraph.tsx apps/web/src/components/hero/CouplingForceGraph.tsx apps/web/src/components/hero/CouplingChord.tsx apps/web/src/components/hero/CouplingGraph.test.tsx apps/web/src/components/layout/Shell.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add adaptive coupling graph hero viz (force + chord)"
```

---

### Task 9: Commit Graph (Multi-Mode)

Three sub-modes (DAG, Branches, Heatmap) selectable via dropdown. Default based on commit count.

**Files:**
- Create: `apps/web/src/components/hero/CommitGraph.tsx` (wrapper + dropdown)
- Create: `apps/web/src/components/hero/CommitDAG.tsx`
- Create: `apps/web/src/components/hero/CommitBranches.tsx`
- Create: `apps/web/src/components/hero/CommitHeatmap.tsx`
- Create: `apps/web/src/components/hero/CommitGraph.test.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx`

- [ ] **Step 1: Write failing tests for default mode selection and heatmap binning**

Create `apps/web/src/components/hero/CommitGraph.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { getDefaultMode } from './CommitGraph';
import { binCommitsForHeatmap } from './CommitHeatmap';

import type { RawCommit } from '@gitlore/core';

describe('getDefaultMode', () => {
  it('returns dag for small repos', () => {
    expect(getDefaultMode(100)).toBe('dag');
  });

  it('returns dag at boundary', () => {
    expect(getDefaultMode(500)).toBe('dag');
  });

  it('returns heatmap for large repos', () => {
    expect(getDefaultMode(501)).toBe('heatmap');
  });
});

describe('binCommitsForHeatmap', () => {
  function makeCommit(overrides: Partial<RawCommit>): RawCommit {
    return {
      hash: 'abc',
      authorEmail: 'alice@dev.com',
      authorName: 'Alice',
      date: '2025-06-02T10:00:00Z',
      message: 'test',
      files: ['a.ts'],
      fileStats: [],
      insertions: 10,
      deletions: 5,
      ...overrides,
    };
  }

  it('creates a grid of week × author', () => {
    const commits = [
      makeCommit({ date: '2025-06-02T10:00:00Z', authorEmail: 'alice@dev.com' }),
      makeCommit({ date: '2025-06-02T12:00:00Z', authorEmail: 'alice@dev.com' }),
      makeCommit({ date: '2025-06-09T10:00:00Z', authorEmail: 'bob@dev.com' }),
    ];

    const { grid, authors, weeks } = binCommitsForHeatmap(commits);
    expect(authors).toContain('alice@dev.com');
    expect(authors).toContain('bob@dev.com');
    expect(weeks.length).toBeGreaterThanOrEqual(2);

    // alice has 2 commits in week 0
    const aliceIdx = authors.indexOf('alice@dev.com');
    expect(grid[aliceIdx][0]).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/components/hero/CommitGraph.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement CommitHeatmap**

Create `apps/web/src/components/hero/CommitHeatmap.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { authorColor } from '../../utils/colors';

import type { RawCommit } from '@gitlore/core';

interface CommitHeatmapProps {
  commits: RawCommit[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const ROW_HEIGHT = 24;
const CELL_GAP = 2;
const LABEL_WIDTH = 120;

export interface HeatmapData {
  grid: number[][]; // [authorIdx][weekIdx]
  authors: string[];
  weeks: Date[];
}

export function binCommitsForHeatmap(commits: RawCommit[]): HeatmapData {
  if (commits.length === 0) return { grid: [], authors: [], weeks: [] };

  // Count per author for sort
  const authorTotals = new Map<string, number>();
  for (const c of commits) {
    authorTotals.set(c.authorEmail, (authorTotals.get(c.authorEmail) ?? 0) + 1);
  }
  const authors = [...authorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([e]) => e);
  const authorIdx = new Map(authors.map((a, i) => [a, i]));

  // Date range
  const dates = commits.map((c) => new Date(c.date).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const startMonday = new Date(minDate);
  startMonday.setUTCDate(startMonday.getUTCDate() - ((startMonday.getUTCDay() + 6) % 7));
  startMonday.setUTCHours(0, 0, 0, 0);

  const totalWeeks = Math.ceil((maxDate.getTime() - startMonday.getTime()) / (7 * 86_400_000)) + 1;
  const weeks: Date[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    weeks.push(new Date(startMonday.getTime() + i * 7 * 86_400_000));
  }

  const grid = Array.from({ length: authors.length }, () => new Array(totalWeeks).fill(0));

  for (const c of commits) {
    const ai = authorIdx.get(c.authorEmail);
    if (ai == null) continue;
    const wi = Math.floor((new Date(c.date).getTime() - startMonday.getTime()) / (7 * 86_400_000));
    if (wi >= 0 && wi < totalWeeks) grid[ai][wi]++;
  }

  return { grid, authors, weeks };
}

export function CommitHeatmap({ commits, onSelectFile }: CommitHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { grid, authors, weeks } = useMemo(() => binCommitsForHeatmap(commits), [commits]);
  const maxCount = Math.max(...grid.flat(), 1);
  const cellW = Math.max((width - LABEL_WIDTH) / (weeks.length || 1), 2);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      {authors.map((email, ai) => {
        const color = authorColor(email);
        const name = email.split('@')[0];
        return (
          <div key={email} style={{ display: 'flex', height: ROW_HEIGHT, marginBottom: CELL_GAP }}>
            <div
              style={{
                width: LABEL_WIDTH,
                flexShrink: 0,
                fontSize: 10,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                paddingRight: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </div>
            <div style={{ display: 'flex', flex: 1, gap: 1 }}>
              {grid[ai].map((count, wi) => (
                <div
                  key={wi}
                  style={{
                    width: cellW,
                    height: '100%',
                    background: color,
                    opacity: count === 0 ? 0.04 : 0.15 + (count / maxCount) * 0.7,
                    borderRadius: 2,
                    cursor: count > 0 ? 'pointer' : 'default',
                  }}
                  title={count > 0 ? `${email}: ${count} commits (week of ${weeks[wi].toISOString().slice(0, 10)})` : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement CommitDAG (simplified vertical timeline)**

Create `apps/web/src/components/hero/CommitDAG.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { authorColor } from '../../utils/colors';

import type { RawCommit } from '@gitlore/core';

interface CommitDAGProps {
  commits: RawCommit[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const MAX_COMMITS = 200;
const NODE_RADIUS = 5;
const ROW_HEIGHT = 20;
const PADDING_LEFT = 40;

export function CommitDAG({ commits, selectedFile, onSelectFile }: CommitDAGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Most recent commits first, limited
  const displayed = useMemo(() => {
    const sorted = [...commits].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, MAX_COMMITS);
  }, [commits]);

  const totalHeight = displayed.length * ROW_HEIGHT + 40;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <svg width={width} height={totalHeight}>
        {/* Vertical spine */}
        <line
          x1={PADDING_LEFT}
          y1={10}
          x2={PADDING_LEFT}
          y2={totalHeight - 10}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {displayed.map((commit, i) => {
          const y = 20 + i * ROW_HEIGHT;
          const color = authorColor(commit.authorEmail);
          const topFile = commit.files[0] ?? null;
          const isSelected = topFile != null && selectedFile === topFile;

          return (
            <g
              key={commit.hash}
              onClick={() => {
                if (topFile) onSelectFile(topFile);
              }}
              style={{ cursor: topFile ? 'pointer' : 'default' }}
            >
              {/* Connect to next */}
              {i < displayed.length - 1 && (
                <line
                  x1={PADDING_LEFT}
                  y1={y + NODE_RADIUS}
                  x2={PADDING_LEFT}
                  y2={y + ROW_HEIGHT - NODE_RADIUS}
                  stroke={color}
                  strokeOpacity={0.2}
                  strokeWidth={1}
                />
              )}

              {/* Node */}
              <circle
                cx={PADDING_LEFT}
                cy={y}
                r={NODE_RADIUS}
                fill={color}
                fillOpacity={0.7}
                stroke={isSelected ? 'var(--accent-primary)' : color}
                strokeWidth={isSelected ? 2 : 1}
              />

              {/* Message */}
              <text
                x={PADDING_LEFT + 16}
                y={y + 1}
                dominantBaseline="central"
                fontSize={10}
                fill="var(--text-secondary)"
              >
                {commit.message.length > 60
                  ? `${commit.message.slice(0, 57)}...`
                  : commit.message}
              </text>

              {/* Date (right-aligned) */}
              <text
                x={width - 10}
                y={y + 1}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={9}
                fill="var(--text-tertiary)"
              >
                {commit.date.slice(0, 10)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Implement CommitBranches (horizontal contributor lanes)**

Create `apps/web/src/components/hero/CommitBranches.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleTime } from 'd3-scale';

import { authorColor } from '../../utils/colors';

import type { RawCommit } from '@gitlore/core';

interface CommitBranchesProps {
  commits: RawCommit[];
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const LANE_HEIGHT = 28;
const LABEL_WIDTH = 120;
const DOT_RADIUS = 3;

export function CommitBranches({ commits, selectedFile, onSelectFile }: CommitBranchesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { lanes, xScale } = useMemo(() => {
    if (commits.length === 0) return { lanes: [], xScale: scaleTime().range([0, 1]) };

    const byAuthor = new Map<string, RawCommit[]>();
    for (const c of commits) {
      const arr = byAuthor.get(c.authorEmail) ?? [];
      arr.push(c);
      byAuthor.set(c.authorEmail, arr);
    }

    const sorted = [...byAuthor.entries()].sort((a, b) => b[1].length - a[1].length);
    const dates = commits.map((c) => new Date(c.date).getTime());
    const xScale = scaleTime()
      .domain([new Date(Math.min(...dates)), new Date(Math.max(...dates))])
      .range([0, width - LABEL_WIDTH]);

    return {
      lanes: sorted.map(([email, authorCommits]) => ({
        email,
        name: email.split('@')[0],
        commits: authorCommits.sort((a, b) => a.date.localeCompare(b.date)),
      })),
      xScale,
    };
  }, [commits, width]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      {lanes.map((lane) => {
        const color = authorColor(lane.email);
        return (
          <div key={lane.email} style={{ display: 'flex', height: LANE_HEIGHT, marginBottom: 2 }}>
            <div
              style={{
                width: LABEL_WIDTH,
                flexShrink: 0,
                fontSize: 10,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                paddingRight: 8,
              }}
            >
              {lane.name}
            </div>
            <svg style={{ flex: 1 }} height={LANE_HEIGHT}>
              {/* Lane line */}
              <line
                x1={0}
                y1={LANE_HEIGHT / 2}
                x2={width - LABEL_WIDTH}
                y2={LANE_HEIGHT / 2}
                stroke={color}
                strokeOpacity={0.1}
                strokeWidth={1}
              />
              {/* Commit dots */}
              {lane.commits.map((c) => {
                const cx = xScale(new Date(c.date));
                const topFile = c.files[0] ?? null;
                const isSelected = topFile != null && selectedFile === topFile;
                return (
                  <circle
                    key={c.hash}
                    cx={cx}
                    cy={LANE_HEIGHT / 2}
                    r={DOT_RADIUS}
                    fill={color}
                    fillOpacity={0.7}
                    stroke={isSelected ? 'var(--accent-primary)' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                    onClick={() => {
                      if (topFile) onSelectFile(topFile);
                    }}
                    style={{ cursor: topFile ? 'pointer' : 'default' }}
                  />
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Implement CommitGraph wrapper with dropdown**

Create `apps/web/src/components/hero/CommitGraph.tsx`:

```typescript
import { useState } from 'react';

import { CommitBranches } from './CommitBranches';
import { CommitDAG } from './CommitDAG';
import { CommitHeatmap } from './CommitHeatmap';

import type { GitloreReport } from '@gitlore/core';

interface CommitGraphProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export type CommitGraphMode = 'dag' | 'branches' | 'heatmap';

const COMMIT_THRESHOLD = 500;

export function getDefaultMode(commitCount: number): CommitGraphMode {
  return commitCount <= COMMIT_THRESHOLD ? 'dag' : 'heatmap';
}

const MODE_LABELS: Record<CommitGraphMode, string> = {
  dag: 'DAG',
  branches: 'Branches',
  heatmap: 'Heatmap',
};

export function CommitGraph({ report, selectedFile, onSelectFile }: CommitGraphProps) {
  const commits = report.commits ?? [];
  const [mode, setMode] = useState<CommitGraphMode>(() => getDefaultMode(commits.length));
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Dropdown */}
      <div style={{ position: 'relative', flexShrink: 0, marginBottom: 8 }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            background: 'var(--surface-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 10,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {MODE_LABELS[mode]}
          <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>▾</span>
        </button>

        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 2,
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              padding: 2,
              zIndex: 10,
            }}
          >
            {(['dag', 'branches', 'heatmap'] as CommitGraphMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setDropdownOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 12px',
                  fontSize: 10,
                  border: 'none',
                  background: m === mode ? 'var(--surface-tertiary)' : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 3,
                }}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Viz */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {mode === 'dag' && (
          <CommitDAG commits={commits} selectedFile={selectedFile} onSelectFile={onSelectFile} />
        )}
        {mode === 'branches' && (
          <CommitBranches
            commits={commits}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        )}
        {mode === 'heatmap' && (
          <CommitHeatmap
            commits={commits}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/web && npx vitest run src/components/hero/CommitGraph.test.tsx`
Expected: All tests pass.

- [ ] **Step 8: Wire into Shell and remove placeholder fallback**

In `apps/web/src/components/layout/Shell.tsx`:

Add import:

```typescript
import { CommitGraph } from '../hero/CommitGraph';
```

Add case:

```tsx
{selection.activeHeroViz === 'commit-graph' && (
  <CommitGraph
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

At this point all 7 vizzes are wired in. Remove the placeholder fallback entirely — all `activeHeroViz` values now have a corresponding component.

- [ ] **Step 9: Run full build + tests**

Run: `pnpm --filter @gitlore/web build && cd apps/web && npx vitest run`
Expected: Clean build, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/hero/CommitGraph.tsx apps/web/src/components/hero/CommitDAG.tsx apps/web/src/components/hero/CommitBranches.tsx apps/web/src/components/hero/CommitHeatmap.tsx apps/web/src/components/hero/CommitGraph.test.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add multi-mode commit graph hero viz (DAG, branches, heatmap)"
```

---

### Task 10: Final integration verification

Smoke test the full dashboard with all 7 hero vizzes wired up.

**Files:** None new — verification only.

- [ ] **Step 1: Build everything**

Run: `pnpm build`
Expected: All three packages build clean (core, cli, web).

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass (core's 207 + new web tests).

- [ ] **Step 3: Run lint and format**

Run: `pnpm lint && pnpm format:check`
Expected: No lint errors, no formatting issues.

- [ ] **Step 4: Lint fix if needed**

Run: `pnpm lint:fix && pnpm format`
Then commit any fixes:

```bash
git add -u
git commit -m "chore: lint and format T3 hero viz code"
```

- [ ] **Step 5: Visual smoke test**

Run: `node apps/cli/dist/index.js --path . --web`

Open the web dashboard and verify:
1. All 7 pills appear in the hero toolbar
2. Clicking each pill shows the corresponding viz
3. Clicking a file in any viz updates the inspector panel
4. The coupling graph switches modes based on data size
5. The commit graph dropdown works
6. Swimlanes show ghost markers for inactive authors

This is a manual check — no automated test.
