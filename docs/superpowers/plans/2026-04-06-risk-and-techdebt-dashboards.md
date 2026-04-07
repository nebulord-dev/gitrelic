# Risk Dashboard & Tech Debt Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two composite dashboard views — Risk Dashboard (KAN-75) and Tech Debt Workbench (KAN-76) — as sub-items under the Dashboard sidebar entry.

**Architecture:** Both dashboards are pure web features that recombine existing `GitloreReport` data. The work is: extend `useSelection` with dashboard modes, modify Sidebar/Shell/MetricsStrip/BottomPanel to be mode-aware, then build 4 new hero viz components and 2 new composite table tabs.

**Tech Stack:** React 19, TypeScript, d3-hierarchy/d3-scale/d3-shape (already installed), SortableTable/Badge/Tooltip shared components.

**Spec:** `docs/superpowers/specs/2026-04-06-risk-and-techdebt-dashboards-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/src/components/hero/RiskHeatmap.tsx` | Risk heatmap hero viz — files x risk dimensions grid |
| `apps/web/src/components/hero/OwnershipSunburst.tsx` | Ownership sunburst hero viz — contributors → files arc chart |
| `apps/web/src/components/hero/GrowthTimeline.tsx` | Stacked area chart of complexity growth over time |
| `apps/web/src/components/hero/DebtScatter.tsx` | Age x rewrite ratio scatter plot with LOC bubble size |
| `apps/web/src/components/tabs/RiskRegisterTab.tsx` | Composite table blending bus factor, ghost, concentration, blast |
| `apps/web/src/components/tabs/DebtInventoryTab.tsx` | Composite table blending age, rewrite, growth, churn velocity, shame |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/src/hooks/useSelection.ts` | Add `DashboardMode` type, new state, new BottomTab/HeroViz values, new GROUP_TABS entries |
| `apps/web/src/components/layout/Sidebar.tsx` | Dashboard tree expansion with sub-items |
| `apps/web/src/components/layout/Shell.tsx` | Dynamic hero viz switcher per mode, pass mode to MetricsStrip |
| `apps/web/src/components/layout/MetricsStrip.tsx` | Mode-aware metric sets |
| `apps/web/src/components/layout/BottomPanel.tsx` | Register RiskRegisterTab and DebtInventoryTab |

---

### Task 1: Extend useSelection with Dashboard Mode

**Files:**
- Modify: `apps/web/src/hooks/useSelection.ts`

- [ ] **Step 1: Add DashboardMode type and new union members**

Add the `DashboardMode` type after the existing `HeroViz` type (line 102). Add new values to `BottomTab`, `HeroViz`, and `SidebarGroup` unions. Add new `GROUP_TABS` entries and `navToGroupTab` mappings.

```typescript
// After line 102 (after HeroViz type):
export type DashboardMode = 'overview' | 'risk' | 'tech-debt';
```

Add to the `BottomTab` union (after `'renames'` on line 45):
```typescript
  | 'risk-register'
  | 'debt-inventory';
```

Add to the `HeroViz` union (after `'swimlanes'` on line 101):
```typescript
  | 'risk-heatmap'
  | 'ownership-sunburst'
  | 'growth-timeline'
  | 'debt-scatter';
```

Add to `SidebarGroup` (after `'structure'` on line 52):
```typescript
  | 'risk'
  | 'tech-debt';
```

Add to `GROUP_TABS` (after the `structure` entry on line 68):
```typescript
  risk: ['risk-register', 'bus-factor', 'ghost-files', 'knowledge-silos'],
  'tech-debt': ['debt-inventory', 'dead-code', 'complexity-trend', 'rewrite-ratio', 'churn-velocity'],
```

Add to `navToGroupTab` (after the `'health-score'` entry on line 72):
```typescript
  // These are handled by dashboardMode, not navToGroupTab, but we need entries
  // so TypeScript doesn't complain if NavItem changes. They map to their own groups.
```

- [ ] **Step 2: Add dashboardMode state to useSelection**

Add to `SelectionState` interface (after `setActiveHeroViz` on line 118):
```typescript
  dashboardMode: DashboardMode;
  setDashboardMode: (mode: DashboardMode) => void;
```

Add state in `useSelection` function (after line 128, `activeHeroViz` state):
```typescript
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('overview');
```

- [ ] **Step 3: Wire dashboardMode into navigateTo and add setDashboardMode logic**

Replace the `navigateTo` callback (lines 147-152) with a version that handles dashboard mode:

```typescript
  const handleSetDashboardMode = useCallback((mode: DashboardMode) => {
    setDashboardMode(mode);
    setActiveNavItem('dashboard');
    const groupMap: Record<DashboardMode, SidebarGroup> = {
      overview: 'overview',
      risk: 'risk',
      'tech-debt': 'tech-debt',
    };
    const tabMap: Record<DashboardMode, BottomTab> = {
      overview: 'hotspots',
      risk: 'risk-register',
      'tech-debt': 'debt-inventory',
    };
    const vizMap: Record<DashboardMode, HeroViz> = {
      overview: 'treemap',
      risk: 'risk-heatmap',
      'tech-debt': 'growth-timeline',
    };
    setActiveGroup(groupMap[mode]);
    setActiveBottomTab(tabMap[mode]);
    setActiveHeroViz(vizMap[mode]);
  }, []);

  const navigateTo = useCallback((item: NavItem) => {
    setActiveNavItem(item);
    if (item !== 'dashboard') {
      setDashboardMode('overview');
    }
    const { group, tab } = navToGroupTab[item];
    setActiveGroup(group);
    setActiveBottomTab(tab);
  }, []);
```

- [ ] **Step 4: Add new state to the return object**

Add `dashboardMode` and `setDashboardMode` to the return statement (after `setActiveHeroViz` on line 168):

```typescript
    dashboardMode,
    setDashboardMode: handleSetDashboardMode,
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors (there may be unused import warnings from other files, but no type errors in useSelection.ts)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useSelection.ts
git commit -m "feat(web): add dashboard mode to useSelection (KAN-75, KAN-76)"
```

---

### Task 2: Sidebar Dashboard Tree Expansion

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update Sidebar props to include dashboard mode**

Replace the `SidebarProps` interface:

```typescript
import type { DashboardMode, NavItem } from '../../hooks/useSelection';
import type { GitloreReport } from '@gitlore/core';

interface SidebarProps {
  report: GitloreReport;
  activeItem: NavItem;
  dashboardMode: DashboardMode;
  onNavigate: (item: NavItem) => void;
  onDashboardMode: (mode: DashboardMode) => void;
}
```

- [ ] **Step 2: Add dashboard sub-items rendering**

Replace the `Sidebar` component body. The key change: detect when `activeItem === 'dashboard'` and render sub-items under Dashboard. Other nav items stay the same.

```typescript
export function Sidebar({ report, activeItem, dashboardMode, onNavigate, onDashboardMode }: SidebarProps) {
  const groups = getNavGroups(report);
  const isDashboardExpanded = activeItem === 'dashboard';

  return (
    <nav
      style={{
        width: 200,
        minWidth: 200,
        background: 'var(--surface-primary)',
        borderRight: '1px solid var(--border-primary)',
        padding: '12px 0',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 16, padding: '0 12px' }}>
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: 'var(--text-tertiary)',
              marginBottom: 8,
              padding: '0 8px',
            }}
          >
            {group.label}
          </div>
          {group.items.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (item.id === 'dashboard') {
                    onDashboardMode('overview');
                  } else {
                    onNavigate(item.id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'left',
                  background: activeItem === item.id ? 'var(--nav-item-active-bg)' : 'transparent',
                  color: activeItem === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  marginBottom: 2,
                }}
              >
                {item.id === 'dashboard' && (
                  <span
                    style={{
                      fontSize: 8,
                      transition: 'transform 0.15s',
                      transform: isDashboardExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    ▶
                  </span>
                )}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 5px',
                      borderRadius: 8,
                      fontWeight: 600,
                      background: 'var(--nav-badge-critical)',
                      color: '#fff',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>

              {/* Dashboard sub-items */}
              {item.id === 'dashboard' && isDashboardExpanded && (
                <div style={{ marginBottom: 4 }}>
                  {([
                    { mode: 'overview' as DashboardMode, label: 'Overview' },
                    { mode: 'risk' as DashboardMode, label: 'Risk' },
                    { mode: 'tech-debt' as DashboardMode, label: 'Tech Debt' },
                  ]).map((sub) => (
                    <button
                      key={sub.mode}
                      onClick={() => onDashboardMode(sub.mode)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '4px 8px 4px 32px',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        textAlign: 'left',
                        background: dashboardMode === sub.mode ? 'var(--nav-item-active-bg)' : 'transparent',
                        color: dashboardMode === sub.mode ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                        marginBottom: 1,
                      }}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Shell.tsx will error because it's not passing the new props yet — that's expected and will be fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(web): add dashboard tree expansion to sidebar"
```

---

### Task 3: Shell — Dynamic Hero Viz Switcher and Mode Plumbing

**Files:**
- Modify: `apps/web/src/components/layout/Shell.tsx`

- [ ] **Step 1: Replace static HERO_VIZZES with mode-aware function**

Replace the `HERO_VIZZES` constant (lines 18-26) and update imports:

```typescript
import type { DashboardMode, HeroViz } from '../../hooks/useSelection';

function getHeroVizzes(mode: DashboardMode): { id: HeroViz; label: string }[] {
  switch (mode) {
    case 'risk':
      return [
        { id: 'risk-heatmap', label: 'Heatmap' },
        { id: 'ownership-sunburst', label: 'Sunburst' },
      ];
    case 'tech-debt':
      return [
        { id: 'growth-timeline', label: 'Timeline' },
        { id: 'debt-scatter', label: 'Scatter' },
      ];
    default:
      return [
        { id: 'treemap', label: 'Treemap' },
        { id: 'ownership', label: 'Ownership' },
        { id: 'coupling', label: 'Coupling' },
        { id: 'commit-graph', label: 'Graph' },
        { id: 'scatter', label: 'Scatter' },
        { id: 'timeline', label: 'Timeline' },
        { id: 'swimlanes', label: 'Swimlanes' },
      ];
  }
}
```

- [ ] **Step 2: Update Shell to pass dashboard mode props**

Inside the `Shell` component, derive `heroVizzes` from mode and pass new props to Sidebar, MetricsStrip. Add placeholder rendering for new hero vizzes (they'll be built in later tasks).

Replace `const selection = useSelection();` area and the JSX. Key changes:

After `const selection = useSelection();`, add:
```typescript
  const heroVizzes = getHeroVizzes(selection.dashboardMode);
```

Update `Sidebar` JSX to pass new props:
```tsx
<Sidebar
  report={report}
  activeItem={selection.activeNavItem}
  dashboardMode={selection.dashboardMode}
  onNavigate={selection.navigateTo}
  onDashboardMode={selection.setDashboardMode}
/>
```

Update `MetricsStrip` JSX:
```tsx
<MetricsStrip report={report} dashboardMode={selection.dashboardMode} />
```

Replace `HERO_VIZZES` in the viz switcher JSX with `heroVizzes`:
```tsx
{heroVizzes.map((viz) => (
```

Add placeholder cases for the new hero vizzes (after the `commit-graph` case, before the closing `</div>`):
```tsx
{selection.activeHeroViz === 'risk-heatmap' && (
  <div style={{ color: 'var(--text-tertiary)', padding: 20 }}>Risk Heatmap (coming in Task 5)</div>
)}
{selection.activeHeroViz === 'ownership-sunburst' && (
  <div style={{ color: 'var(--text-tertiary)', padding: 20 }}>Ownership Sunburst (coming in Task 6)</div>
)}
{selection.activeHeroViz === 'growth-timeline' && (
  <div style={{ color: 'var(--text-tertiary)', padding: 20 }}>Growth Timeline (coming in Task 7)</div>
)}
{selection.activeHeroViz === 'debt-scatter' && (
  <div style={{ color: 'var(--text-tertiary)', padding: 20 }}>Debt Scatter (coming in Task 8)</div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: MetricsStrip will error because it doesn't accept `dashboardMode` yet. That's fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): wire dashboard mode through Shell with dynamic hero viz switcher"
```

---

### Task 4: MetricsStrip — Mode-Aware Metrics

**Files:**
- Modify: `apps/web/src/components/layout/MetricsStrip.tsx`

- [ ] **Step 1: Add dashboardMode prop and mode-specific metric functions**

Replace the entire `MetricsStrip.tsx`:

```typescript
import { fmt } from '../theme';

import type { DashboardMode } from '../../hooks/useSelection';
import type { GitloreReport } from '@gitlore/core';

interface MetricsStripProps {
  report: GitloreReport;
  dashboardMode: DashboardMode;
}

interface Metric {
  label: string;
  value: string;
  color: string;
}

function getOverviewMetrics(report: GitloreReport): Metric[] {
  const criticalCount = report.hotspots.topHotspots.filter((h) => h.category === 'critical').length;

  return [
    {
      label: 'Cursed Files',
      value: String(report.cursedFiles.length),
      color: report.cursedFiles.length > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Hotspots',
      value: String(criticalCount),
      color:
        criticalCount > 3
          ? 'var(--severity-critical)'
          : criticalCount > 0
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Bus Factor Risks',
      value: String(report.busFactors.criticalFiles.length),
      color:
        report.busFactors.criticalFiles.length > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Contributors',
      value: String(report.meta.totalAuthors),
      color: 'var(--accent-primary)',
    },
    {
      label: 'Repo Age',
      value: `${(report.meta.ageInDays / 365).toFixed(1)}y`,
      color: 'var(--text-primary)',
    },
    {
      label: 'Lines of Code',
      value: fmt(report.loc.totalLines),
      color: 'var(--text-primary)',
    },
  ];
}

function getRiskMetrics(report: GitloreReport): Metric[] {
  const criticalBusFactorCount = report.busFactors.criticalFiles.length;
  const ghostCount = report.ghostFiles.totalGhostFiles;
  const concentrationIndex = report.knowledgeConcentration.concentrationIndex;
  const highBlastCount = report.blastRadius.files.filter((f) => f.blastScore > 70).length;

  // Sum LOC of files with critical bus factor
  const criticalFileSet = new Set(report.busFactors.criticalFiles.map((f) => f.file));
  const atRiskLoc = report.loc.files
    .filter((f) => criticalFileSet.has(f.file))
    .reduce((sum, f) => sum + f.lines, 0);

  return [
    {
      label: 'Critical Bus Factor',
      value: String(criticalBusFactorCount),
      color: criticalBusFactorCount > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Ghost Files',
      value: String(ghostCount),
      color: ghostCount > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Knowledge Concentration',
      value: `${Math.round(concentrationIndex)}%`,
      color:
        concentrationIndex > 60
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'High Blast Radius',
      value: String(highBlastCount),
      color: highBlastCount > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'At-Risk LOC',
      value: fmt(atRiskLoc),
      color: atRiskLoc > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
  ];
}

function getTechDebtMetrics(report: GitloreReport): Metric[] {
  const deadFiles = report.deadCode.totalDeadFiles;
  const growingCount = report.complexityTrend.growingFiles.length;
  const highRewriteCount = report.rewriteRatio.topRewriters.length;
  const acceleratingCount = report.churnVelocity.acceleratingFiles.length;

  // Sum LOC of dead code candidates + top rewriters
  const debtFileSet = new Set([
    ...report.deadCode.candidates.map((f) => f.file),
    ...report.rewriteRatio.topRewriters.map((f) => f.file),
  ]);
  const debtLoc = report.loc.files
    .filter((f) => debtFileSet.has(f.file))
    .reduce((sum, f) => sum + f.lines, 0);

  return [
    {
      label: 'Dead Files',
      value: String(deadFiles),
      color: deadFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Growing Files',
      value: String(growingCount),
      color: growingCount > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'High Rewrite',
      value: String(highRewriteCount),
      color: highRewriteCount > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Accelerating Churn',
      value: String(acceleratingCount),
      color: acceleratingCount > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Debt LOC',
      value: fmt(debtLoc),
      color: debtLoc > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
  ];
}

function getMetrics(report: GitloreReport, mode: DashboardMode): Metric[] {
  switch (mode) {
    case 'risk':
      return getRiskMetrics(report);
    case 'tech-debt':
      return getTechDebtMetrics(report);
    default:
      return getOverviewMetrics(report);
  }
}

export function MetricsStrip({ report, dashboardMode }: MetricsStripProps) {
  const metrics = getMetrics(report, dashboardMode);

  return (
    <div
      style={{
        display: 'flex',
        gap: 1,
        background: 'var(--border-primary)',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0,
      }}
    >
      {metrics.map((m) => (
        <div
          key={m.label}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'var(--surface-primary)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--text-tertiary)',
              marginTop: 2,
            }}
          >
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/MetricsStrip.tsx
git commit -m "feat(web): mode-aware metrics strip for risk and tech debt dashboards"
```

---

### Task 5: Risk Register Tab (Composite Table)

**Files:**
- Create: `apps/web/src/components/tabs/RiskRegisterTab.tsx`
- Modify: `apps/web/src/components/layout/BottomPanel.tsx`

- [ ] **Step 1: Create RiskRegisterTab**

```typescript
import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { GitloreReport } from '@gitlore/core';

interface RiskRegisterTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

interface RiskRow {
  file: string;
  busFactorRisk: string;
  busFactorScore: number;
  isGhost: boolean;
  concentration: number;
  blastScore: number;
  riskScore: number;
}

function busFactorToScore(risk: string): number {
  switch (risk) {
    case 'critical': return 100;
    case 'high': return 75;
    case 'medium': return 50;
    default: return 25;
  }
}

function buildRiskRows(report: GitloreReport): RiskRow[] {
  const ghostSet = new Set(report.ghostFiles.files.map((f) => f.file));
  const blastMap = new Map(report.blastRadius.files.map((f) => [f.file, f.blastScore]));

  const rows: RiskRow[] = [];
  for (const bf of report.busFactors.files) {
    const isGhost = ghostSet.has(bf.file);
    const blastScore = blastMap.get(bf.file) ?? 0;
    const bfScore = busFactorToScore(bf.risk);
    const concentration = bf.dominantAuthorPercent;

    // Filter: must have at least one risk signal
    if (bf.risk === 'low' && !isGhost && concentration <= 80 && blastScore <= 70) continue;

    const riskScore = Math.round(
      bfScore * 0.35 +
      (isGhost ? 100 : 0) * 0.25 +
      concentration * 0.25 +
      blastScore * 0.15
    );

    rows.push({
      file: bf.file,
      busFactorRisk: bf.risk,
      busFactorScore: bfScore,
      isGhost,
      concentration,
      blastScore,
      riskScore,
    });
  }

  return rows.sort((a, b) => b.riskScore - a.riskScore);
}

function riskBadgeVariant(risk: string): 'critical' | 'warning' | 'moderate' | 'healthy' {
  switch (risk) {
    case 'critical': return 'critical';
    case 'high': return 'warning';
    case 'medium': return 'moderate';
    default: return 'healthy';
  }
}

export function RiskRegisterTab({ report, onSelectFile }: RiskRegisterTabProps) {
  const rows = buildRiskRows(report);

  const columns: Column<RiskRow>[] = [
    {
      key: 'file',
      label: 'File',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>
          {fileName(r.file)}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
            {filePath(r.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'busFactor',
      label: 'Bus Factor',
      width: '90px',
      align: 'center',
      sortValue: (r) => r.busFactorScore,
      render: (r) => <Badge variant={riskBadgeVariant(r.busFactorRisk)}>{r.busFactorRisk}</Badge>,
    },
    {
      key: 'ghost',
      label: 'Ghost',
      width: '80px',
      align: 'center',
      sortValue: (r) => (r.isGhost ? 1 : 0),
      render: (r) =>
        r.isGhost ? (
          <Badge variant="critical">orphaned</Badge>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--severity-healthy)' }}>active</span>
        ),
    },
    {
      key: 'concentration',
      label: 'Concentration',
      width: '90px',
      align: 'right',
      sortValue: (r) => r.concentration,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.concentration > 80 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {r.concentration}%
        </span>
      ),
    },
    {
      key: 'blast',
      label: 'Blast',
      width: '60px',
      align: 'right',
      sortValue: (r) => r.blastScore,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.blastScore > 70 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {fmt(r.blastScore)}
        </span>
      ),
    },
    {
      key: 'riskScore',
      label: 'Risk Score',
      width: '80px',
      align: 'right',
      sortValue: (r) => r.riskScore,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            color:
              r.riskScore > 70
                ? 'var(--severity-critical)'
                : r.riskScore > 40
                  ? 'var(--severity-warning)'
                  : 'var(--text-secondary)',
          }}
        >
          {r.riskScore}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.file}
      onRowClick={(r) => onSelectFile(r.file)}
    />
  );
}
```

- [ ] **Step 2: Register RiskRegisterTab in BottomPanel**

In `apps/web/src/components/layout/BottomPanel.tsx`:

Add import (after the existing tab imports):
```typescript
import { RiskRegisterTab } from '../tabs/RiskRegisterTab';
```

Add to `TAB_LABELS` (after the `renames` entry):
```typescript
  'risk-register': 'Risk Register',
  'debt-inventory': 'Debt Inventory',
```

Add case in `TabContent` switch (before the closing `}`):
```typescript
    case 'risk-register':
      return <RiskRegisterTab report={report} onSelectFile={onSelectFile} />;
```

- [ ] **Step 3: Build and verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors. The `debt-inventory` case will be added in Task 9.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tabs/RiskRegisterTab.tsx apps/web/src/components/layout/BottomPanel.tsx
git commit -m "feat(web): add Risk Register composite table (KAN-75)"
```

---

### Task 6: Risk Heatmap Hero Viz

**Files:**
- Create: `apps/web/src/components/hero/RiskHeatmap.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` (replace placeholder)

- [ ] **Step 1: Create RiskHeatmap component**

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import type { GitloreReport } from '@gitlore/core';

interface RiskHeatmapProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface HeatmapRow {
  file: string;
  busFactor: number;
  ghostRisk: number;
  knowledge: number;
  blastRadius: number;
  composite: number;
}

const DIMENSIONS = ['Bus Factor', 'Ghost Risk', 'Knowledge', 'Blast Radius'] as const;
const DIMENSION_KEYS: (keyof Pick<HeatmapRow, 'busFactor' | 'ghostRisk' | 'knowledge' | 'blastRadius'>)[] = [
  'busFactor', 'ghostRisk', 'knowledge', 'blastRadius',
];

function buildHeatmapData(report: GitloreReport): HeatmapRow[] {
  const ghostSet = new Set(report.ghostFiles.files.map((f) => f.file));
  const blastMap = new Map(report.blastRadius.files.map((f) => [f.file, f.blastScore]));

  const rows: HeatmapRow[] = [];
  for (const bf of report.busFactors.files) {
    const busFactor = bf.risk === 'critical' ? 100 : bf.risk === 'high' ? 75 : bf.risk === 'medium' ? 50 : 25;
    const ghostRisk = ghostSet.has(bf.file) ? 100 : 0;
    const knowledge = bf.dominantAuthorPercent;
    const blastRadius = blastMap.get(bf.file) ?? 0;
    const composite = busFactor * 0.35 + ghostRisk * 0.25 + knowledge * 0.25 + blastRadius * 0.15;

    if (composite < 30) continue; // filter low-risk files

    rows.push({ file: bf.file, busFactor, ghostRisk, knowledge, blastRadius, composite });
  }

  return rows.sort((a, b) => b.composite - a.composite).slice(0, 30);
}

function cellColor(value: number): string {
  if (value >= 75) return 'rgba(248, 81, 73, 0.7)';
  if (value >= 50) return 'rgba(210, 153, 34, 0.5)';
  if (value >= 25) return 'rgba(88, 166, 255, 0.3)';
  return 'rgba(63, 185, 80, 0.2)';
}

const LABEL_WIDTH = 140;
const CELL_HEIGHT = 22;
const HEADER_HEIGHT = 30;

export function RiskHeatmap({ report, selectedFile, onSelectFile }: RiskHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; file: string; dim: string; value: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => buildHeatmapData(report), [report]);

  const cellWidth = (dims.width - LABEL_WIDTH) / DIMENSIONS.length;
  const visibleRows = Math.min(rows.length, Math.floor((dims.height - HEADER_HEIGHT) / CELL_HEIGHT));

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <svg width={dims.width} height={dims.height}>
        {/* Column headers */}
        {DIMENSIONS.map((dim, i) => (
          <text
            key={dim}
            x={LABEL_WIDTH + i * cellWidth + cellWidth / 2}
            y={18}
            textAnchor="middle"
            fontSize={9}
            fill="var(--text-tertiary)"
          >
            {dim}
          </text>
        ))}

        {/* Rows */}
        {rows.slice(0, visibleRows).map((row, rowIdx) => {
          const y = HEADER_HEIGHT + rowIdx * CELL_HEIGHT;
          const isSelected = selectedFile === row.file;
          const shortName = row.file.split('/').pop() ?? row.file;

          return (
            <g
              key={row.file}
              onClick={() => onSelectFile(row.file)}
              style={{ cursor: 'pointer' }}
            >
              {/* File label */}
              <text
                x={LABEL_WIDTH - 8}
                y={y + CELL_HEIGHT / 2 + 3}
                textAnchor="end"
                fontSize={9}
                fill={isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                fontFamily="var(--font-mono)"
              >
                {shortName.length > 18 ? `${shortName.slice(0, 18)}…` : shortName}
              </text>

              {/* Heat cells */}
              {DIMENSION_KEYS.map((key, colIdx) => {
                const value = row[key];
                return (
                  <rect
                    key={key}
                    x={LABEL_WIDTH + colIdx * cellWidth + 1}
                    y={y + 1}
                    width={cellWidth - 2}
                    height={CELL_HEIGHT - 2}
                    fill={cellColor(value)}
                    rx={3}
                    stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
                    strokeWidth={isSelected ? 1.5 : 0}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (rect) {
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          file: row.file,
                          dim: DIMENSIONS[colIdx],
                          value,
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
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
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.file}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {tooltip.dim}: {tooltip.value}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into Shell — replace placeholder**

In `apps/web/src/components/layout/Shell.tsx`, add import:
```typescript
import { RiskHeatmap } from '../hero/RiskHeatmap';
```

Replace the risk-heatmap placeholder:
```tsx
{selection.activeHeroViz === 'risk-heatmap' && (
  <RiskHeatmap
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

- [ ] **Step 3: Build and verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/hero/RiskHeatmap.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add Risk Heatmap hero visualization (KAN-75)"
```

---

### Task 7: Ownership Sunburst Hero Viz

**Files:**
- Create: `apps/web/src/components/hero/OwnershipSunburst.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` (replace placeholder)

- [ ] **Step 1: Create OwnershipSunburst component**

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { hierarchy, partition } from 'd3-hierarchy';
import { arc as d3Arc } from 'd3-shape';

import { authorColor } from '../../utils/colors';

import type { GitloreReport } from '@gitlore/core';

interface OwnershipSunburstProps {
  report: GitloreReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
}

interface SunburstNode {
  name: string;
  email?: string;
  file?: string;
  risk?: string;
  value?: number;
  children?: SunburstNode[];
}

function buildSunburstData(report: GitloreReport): SunburstNode {
  const authorMap = new Map<string, { files: { file: string; risk: string; loc: number }[] }>();

  for (const bf of report.busFactors.files) {
    if (!bf.dominantAuthor) continue;
    const loc = report.loc.files.find((f) => f.file === bf.file)?.lines ?? 1;
    if (!authorMap.has(bf.dominantAuthor)) {
      authorMap.set(bf.dominantAuthor, { files: [] });
    }
    authorMap.get(bf.dominantAuthor)!.files.push({ file: bf.file, risk: bf.risk, loc });
  }

  // Only include authors who own at least one file
  const children: SunburstNode[] = [];
  for (const [email, data] of authorMap) {
    if (data.files.length === 0) continue;
    const name = email.split('@')[0];
    children.push({
      name,
      email,
      children: data.files.map((f) => ({
        name: f.file.split('/').pop() ?? f.file,
        file: f.file,
        risk: f.risk,
        value: Math.max(f.loc, 1),
      })),
    });
  }

  return { name: 'root', children };
}

function riskColor(risk: string, opacity: number): string {
  switch (risk) {
    case 'critical': return `rgba(248, 81, 73, ${opacity})`;
    case 'high': return `rgba(210, 153, 34, ${opacity})`;
    case 'medium': return `rgba(88, 166, 255, ${opacity})`;
    default: return `rgba(63, 185, 80, ${opacity})`;
  }
}

export function OwnershipSunburst({
  report,
  selectedFile,
  selectedContributor,
  onSelectFile,
  onSelectContributor,
}: OwnershipSunburstProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const arcs = useMemo(() => {
    const data = buildSunburstData(report);
    const radius = Math.min(dims.width, dims.height) / 2;

    const root = hierarchy(data)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const partitionLayout = partition<SunburstNode>()
      .size([2 * Math.PI, radius]);

    partitionLayout(root);
    return { nodes: root.descendants().slice(1), radius }; // skip root
  }, [report, dims.width, dims.height]);

  const arcGenerator = d3Arc<{ x0: number; x1: number; y0: number; y1: number }>()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1)
    .padAngle(0.005)
    .padRadius(arcs.radius / 2);

  const cx = dims.width / 2;
  const cy = dims.height / 2;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${cx},${cy})`}>
          {arcs.nodes.map((node) => {
            const d = node.data;
            const depth = node.depth; // 1 = author, 2 = file
            const isAuthor = depth === 1;
            const isSelectedAuthor = isAuthor && d.email === selectedContributor;
            const isSelectedFile = !isAuthor && d.file === selectedFile;

            const fill = isAuthor
              ? authorColor(d.email ?? d.name)
              : riskColor(d.risk ?? 'low', 0.6);

            const stroke = isSelectedAuthor || isSelectedFile
              ? 'var(--accent-primary)'
              : 'rgba(0,0,0,0.3)';

            const path = arcGenerator({
              x0: (node as any).x0,
              x1: (node as any).x1,
              y0: (node as any).y0,
              y1: (node as any).y1,
            });

            if (!path) return null;

            return (
              <path
                key={`${d.email ?? ''}-${d.file ?? d.name}`}
                d={path}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelectedAuthor || isSelectedFile ? 2 : 0.5}
                onClick={() => {
                  if (isAuthor && d.email) onSelectContributor(d.email);
                  else if (d.file) onSelectFile(d.file);
                }}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const text = isAuthor
                      ? `${d.name} (${node.children?.length ?? 0} files)`
                      : `${d.file} — ${d.risk} risk`;
                    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </g>
      </svg>

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
            whiteSpace: 'nowrap',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into Shell — replace placeholder**

In `apps/web/src/components/layout/Shell.tsx`, add import:
```typescript
import { OwnershipSunburst } from '../hero/OwnershipSunburst';
```

Replace the ownership-sunburst placeholder:
```tsx
{selection.activeHeroViz === 'ownership-sunburst' && (
  <OwnershipSunburst
    report={report}
    selectedFile={selection.selectedFile}
    selectedContributor={selection.selectedContributor}
    onSelectFile={selection.selectFile}
    onSelectContributor={selection.selectContributor}
  />
)}
```

- [ ] **Step 3: Build and verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/hero/OwnershipSunburst.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add Ownership Sunburst hero visualization (KAN-75)"
```

---

### Task 8: Growth Timeline Hero Viz

**Files:**
- Create: `apps/web/src/components/hero/GrowthTimeline.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` (replace placeholder)

- [ ] **Step 1: Create GrowthTimeline component**

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear, scalePoint } from 'd3-scale';
import { area as d3Area, line as d3Line, curveMonotoneX } from 'd3-shape';

import type { GitloreReport, FileComplexityTrend } from '@gitlore/core';

interface GrowthTimelineProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const PADDING = { top: 20, right: 120, bottom: 40, left: 55 };
const SERIES_COLORS = [
  'rgba(248, 81, 73, 0.8)',
  'rgba(210, 153, 34, 0.8)',
  'rgba(88, 166, 255, 0.8)',
  'rgba(163, 113, 247, 0.8)',
  'rgba(63, 185, 80, 0.8)',
  'rgba(255, 159, 67, 0.8)',
  'rgba(255, 99, 132, 0.8)',
  'rgba(54, 162, 235, 0.8)',
  'rgba(255, 206, 86, 0.8)',
  'rgba(75, 192, 192, 0.8)',
];

export function GrowthTimeline({ report, selectedFile, onSelectFile }: GrowthTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; file: string; growth: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { series, months, yMax } = useMemo(() => {
    const topFiles = report.complexityTrend.growingFiles.slice(0, 10);
    if (topFiles.length === 0) return { series: [], months: [], yMax: 0 };

    // Collect all months across all files
    const monthSet = new Set<string>();
    for (const f of topFiles) {
      for (const b of f.buckets) monthSet.add(b.month);
    }
    const months = Array.from(monthSet).sort();

    // Compute max cumulative value
    let yMax = 0;
    for (const f of topFiles) {
      for (const b of f.buckets) {
        if (Math.abs(b.cumulative) > yMax) yMax = Math.abs(b.cumulative);
      }
    }

    return { series: topFiles, months, yMax: Math.max(yMax, 1) };
  }, [report]);

  const plotW = dims.width - PADDING.left - PADDING.right;
  const plotH = dims.height - PADDING.top - PADDING.bottom;

  const xScale = useMemo(
    () => scalePoint<string>().domain(months).range([0, plotW]),
    [months, plotW],
  );
  const yScale = useMemo(
    () => scaleLinear().domain([0, yMax]).range([plotH, 0]),
    [yMax, plotH],
  );

  const lineGen = d3Line<{ month: string; cumulative: number }>()
    .x((d) => xScale(d.month) ?? 0)
    .y((d) => yScale(d.cumulative))
    .curve(curveMonotoneX);

  const areaGen = d3Area<{ month: string; cumulative: number }>()
    .x((d) => xScale(d.month) ?? 0)
    .y0(plotH)
    .y1((d) => yScale(d.cumulative))
    .curve(curveMonotoneX);

  // Show tick labels for every Nth month to avoid crowding
  const tickInterval = Math.max(1, Math.ceil(months.length / 10));

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Y axis */}
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--border-primary)" />
          {yScale.ticks(5).map((tick) => (
            <g key={`y-${tick}`} transform={`translate(0,${yScale(tick)})`}>
              <line x1={-4} x2={0} stroke="var(--border-primary)" />
              <line x1={0} x2={plotW} stroke="var(--border-primary)" strokeOpacity={0.1} />
              <text x={-8} textAnchor="end" dominantBaseline="central" fontSize={8} fill="var(--text-tertiary)">
                {tick > 0 ? `+${tick}` : tick}
              </text>
            </g>
          ))}
          <text
            transform={`translate(-42,${plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Cumulative Net Lines
          </text>

          {/* X axis */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
          {months.map((month, i) => {
            if (i % tickInterval !== 0) return null;
            const x = xScale(month) ?? 0;
            return (
              <g key={month} transform={`translate(${x},${plotH})`}>
                <line y2={4} stroke="var(--border-primary)" />
                <text y={16} textAnchor="middle" fontSize={8} fill="var(--text-tertiary)">
                  {month}
                </text>
              </g>
            );
          })}

          {/* Area fills */}
          {series.map((file, i) => {
            const isHovered = hoveredSeries === file.file;
            const isSelected = selectedFile === file.file;
            const baseOpacity = isHovered || isSelected ? 0.25 : 0.1;
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            const fillColor = color.replace(/[\d.]+\)$/, `${baseOpacity})`);

            return (
              <path
                key={`area-${file.file}`}
                d={areaGen(file.buckets) ?? ''}
                fill={fillColor}
              />
            );
          })}

          {/* Lines */}
          {series.map((file, i) => {
            const isHovered = hoveredSeries === file.file;
            const isSelected = selectedFile === file.file;
            const color = SERIES_COLORS[i % SERIES_COLORS.length];

            return (
              <path
                key={`line-${file.file}`}
                d={lineGen(file.buckets) ?? ''}
                fill="none"
                stroke={color}
                strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
                strokeOpacity={hoveredSeries && !isHovered && !isSelected ? 0.2 : 1}
                onMouseEnter={(e) => {
                  setHoveredSeries(file.file);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      file: file.file,
                      growth: file.recentGrowthRate,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredSeries(null);
                  setTooltip(null);
                }}
                onClick={() => onSelectFile(file.file)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Legend */}
          {series.map((file, i) => {
            const shortName = file.file.split('/').pop() ?? file.file;
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            return (
              <g
                key={`legend-${file.file}`}
                transform={`translate(${plotW + 12},${i * 16 + 4})`}
                onClick={() => onSelectFile(file.file)}
                onMouseEnter={() => setHoveredSeries(file.file)}
                onMouseLeave={() => setHoveredSeries(null)}
                style={{ cursor: 'pointer' }}
              >
                <line x1={0} y1={0} x2={12} y2={0} stroke={color} strokeWidth={2} />
                <text x={16} dominantBaseline="central" fontSize={9} fill="var(--text-secondary)">
                  {shortName.length > 16 ? `${shortName.slice(0, 16)}…` : shortName}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

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
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.file}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Growth rate: {tooltip.growth > 0 ? '+' : ''}{tooltip.growth.toFixed(1)} lines/mo
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into Shell — replace placeholder**

In `apps/web/src/components/layout/Shell.tsx`, add import:
```typescript
import { GrowthTimeline } from '../hero/GrowthTimeline';
```

Replace the growth-timeline placeholder:
```tsx
{selection.activeHeroViz === 'growth-timeline' && (
  <GrowthTimeline
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

- [ ] **Step 3: Build and verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/hero/GrowthTimeline.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add Growth Timeline hero visualization (KAN-76)"
```

---

### Task 9: Debt Inventory Tab (Composite Table)

**Files:**
- Create: `apps/web/src/components/tabs/DebtInventoryTab.tsx`
- Modify: `apps/web/src/components/layout/BottomPanel.tsx`

- [ ] **Step 1: Create DebtInventoryTab**

```typescript
import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { BadgeVariant } from '../theme';
import type { GitloreReport } from '@gitlore/core';

interface DebtInventoryTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

interface DebtRow {
  file: string;
  ageDays: number;
  rewriteScore: number;
  growthRate: number;
  churnTrend: string;
  churnVelocityScore: number;
  shameScore: number;
  debtScore: number;
}

function formatAge(days: number): string {
  if (days >= 365) return `${(days / 365).toFixed(1)}y`;
  return `${days}d`;
}

function trendVariant(trend: string): BadgeVariant {
  switch (trend) {
    case 'accelerating': return 'critical';
    case 'stable': return 'moderate';
    case 'decelerating': return 'healthy';
    default: return 'stale';
  }
}

function buildDebtRows(report: GitloreReport): DebtRow[] {
  // Collect files that appear in any debt signal
  const debtFileSet = new Set<string>();
  for (const f of report.deadCode.candidates) debtFileSet.add(f.file);
  for (const f of report.complexityTrend.growingFiles) debtFileSet.add(f.file);
  for (const f of report.rewriteRatio.topRewriters) debtFileSet.add(f.file);
  for (const f of report.churnVelocity.acceleratingFiles) debtFileSet.add(f.file);

  // Build lookup maps
  const ageMap = new Map(report.ageMap.files.map((f) => [f.file, f.ageInDays]));
  const rewriteMap = new Map(report.rewriteRatio.files.map((f) => [f.file, f.rewriteScore]));
  const growthMap = new Map(report.complexityTrend.files.map((f) => [f.file, { rate: f.recentGrowthRate, trend: f.trend }]));
  const churnVelMap = new Map(report.churnVelocity.files.map((f) => [f.file, { trend: f.trend, score: f.velocityScore }]));
  const shameMap = new Map(report.forensics.files.map((f) => [f.file, f.shameScore]));

  // Normalization: find max growth rate for scaling
  const maxGrowthRate = Math.max(...report.complexityTrend.files.map((f) => Math.abs(f.recentGrowthRate)), 1);
  const repoAgeDays = Math.max(report.meta.ageInDays, 1);

  const rows: DebtRow[] = [];
  for (const file of debtFileSet) {
    const ageDays = ageMap.get(file) ?? 0;
    const rewriteScore = rewriteMap.get(file) ?? 0;
    const growth = growthMap.get(file);
    const growthRate = growth?.rate ?? 0;
    const churnVel = churnVelMap.get(file);
    const churnTrend = churnVel?.trend ?? 'stable';
    const churnVelocityScore = churnVel?.score ?? 0;
    const shameScore = shameMap.get(file) ?? 0;

    // Normalize and compute debt score
    const normalizedGrowth = Math.min((Math.abs(growthRate) / maxGrowthRate) * 100, 100);
    const normalizedAge = Math.min((ageDays / repoAgeDays) * 100, 100);

    const debtScore = Math.round(
      rewriteScore * 0.3 +
      normalizedGrowth * 0.25 +
      churnVelocityScore * 0.2 +
      shameScore * 0.15 +
      normalizedAge * 0.1
    );

    rows.push({
      file,
      ageDays,
      rewriteScore,
      growthRate,
      churnTrend,
      churnVelocityScore,
      shameScore,
      debtScore,
    });
  }

  return rows.sort((a, b) => b.debtScore - a.debtScore);
}

export function DebtInventoryTab({ report, onSelectFile }: DebtInventoryTabProps) {
  const rows = buildDebtRows(report);

  const columns: Column<DebtRow>[] = [
    {
      key: 'file',
      label: 'File',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>
          {fileName(r.file)}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
            {filePath(r.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'age',
      label: 'Age',
      width: '60px',
      align: 'right',
      sortValue: (r) => r.ageDays,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.ageDays > 365 ? 'var(--severity-critical)' : r.ageDays > 180 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {formatAge(r.ageDays)}
        </span>
      ),
    },
    {
      key: 'rewrite',
      label: 'Rewrite',
      width: '70px',
      align: 'center',
      sortValue: (r) => r.rewriteScore,
      render: (r) => (
        <Badge variant={r.rewriteScore > 70 ? 'critical' : r.rewriteScore > 40 ? 'warning' : 'healthy'}>
          {(r.rewriteScore / 100).toFixed(2)}
        </Badge>
      ),
    },
    {
      key: 'growth',
      label: 'Growth',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.growthRate,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.growthRate > 0 ? 'var(--severity-critical)' : 'var(--text-secondary)',
          }}
        >
          {r.growthRate > 0 ? '+' : ''}{r.growthRate.toFixed(0)}/mo
        </span>
      ),
    },
    {
      key: 'churnVel',
      label: 'Churn Vel.',
      width: '80px',
      align: 'center',
      sortValue: (r) => r.churnVelocityScore,
      render: (r) => <Badge variant={trendVariant(r.churnTrend)}>{r.churnTrend}</Badge>,
    },
    {
      key: 'shame',
      label: 'Shame',
      width: '55px',
      align: 'right',
      sortValue: (r) => r.shameScore,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.shameScore > 50 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {r.shameScore}
        </span>
      ),
    },
    {
      key: 'debtScore',
      label: 'Debt Score',
      width: '80px',
      align: 'right',
      sortValue: (r) => r.debtScore,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            color:
              r.debtScore > 70
                ? 'var(--severity-critical)'
                : r.debtScore > 40
                  ? 'var(--severity-warning)'
                  : 'var(--text-secondary)',
          }}
        >
          {r.debtScore}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.file}
      onRowClick={(r) => onSelectFile(r.file)}
    />
  );
}
```

- [ ] **Step 2: Register DebtInventoryTab in BottomPanel**

In `apps/web/src/components/layout/BottomPanel.tsx`:

Add import (after the RiskRegisterTab import):
```typescript
import { DebtInventoryTab } from '../tabs/DebtInventoryTab';
```

Add case in `TabContent` switch (after the `risk-register` case):
```typescript
    case 'debt-inventory':
      return <DebtInventoryTab report={report} onSelectFile={onSelectFile} />;
```

- [ ] **Step 3: Build and verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tabs/DebtInventoryTab.tsx apps/web/src/components/layout/BottomPanel.tsx
git commit -m "feat(web): add Debt Inventory composite table (KAN-76)"
```

---

### Task 10: Debt Scatter Hero Viz

**Files:**
- Create: `apps/web/src/components/hero/DebtScatter.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` (replace placeholder)

- [ ] **Step 1: Create DebtScatter component**

This follows the same pattern as `HotspotScatter.tsx` — SVG scatter with d3-scale, ResizeObserver, tooltip.

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import type { GitloreReport } from '@gitlore/core';

interface DebtScatterProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface DebtPoint {
  file: string;
  ageDays: number;
  rewriteScore: number;
  loc: number;
  churnTrend: string;
}

const PADDING = { top: 30, right: 20, bottom: 40, left: 55 };

function trendColor(trend: string, opacity: number): string {
  switch (trend) {
    case 'accelerating': return `rgba(248, 81, 73, ${opacity})`;
    case 'stable': return `rgba(210, 153, 34, ${opacity})`;
    case 'decelerating': return `rgba(63, 185, 80, ${opacity})`;
    default: return `rgba(88, 166, 255, ${opacity})`;
  }
}

function prepareDebtData(report: GitloreReport): DebtPoint[] {
  const ageMap = new Map(report.ageMap.files.map((f) => [f.file, f.ageInDays]));
  const locMap = new Map(report.loc.files.map((f) => [f.file, f.lines]));
  const churnVelMap = new Map(report.churnVelocity.files.map((f) => [f.file, f.trend]));

  const points: DebtPoint[] = [];
  for (const r of report.rewriteRatio.files) {
    const ageDays = ageMap.get(r.file);
    const loc = locMap.get(r.file);
    if (ageDays == null || loc == null) continue;

    points.push({
      file: r.file,
      ageDays,
      rewriteScore: r.rewriteScore,
      loc,
      churnTrend: churnVelMap.get(r.file) ?? 'stable',
    });
  }

  return points;
}

export function DebtScatter({ report, selectedFile, onSelectFile }: DebtScatterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DebtPoint } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => prepareDebtData(report), [report]);

  const { xScale, yScale, rScale, plotW, plotH } = useMemo(() => {
    const w = dims.width - PADDING.left - PADDING.right;
    const h = dims.height - PADDING.top - PADDING.bottom;
    const maxAge = Math.max(...points.map((p) => p.ageDays), 1);
    const maxRewrite = Math.max(...points.map((p) => p.rewriteScore), 1);
    const maxLoc = Math.max(...points.map((p) => p.loc), 1);

    return {
      xScale: scaleLinear().domain([0, maxAge]).range([0, w]),
      yScale: scaleLinear().domain([0, maxRewrite]).range([h, 0]),
      rScale: scaleLinear().domain([0, maxLoc]).range([3, 16]),
      plotW: w,
      plotH: h,
    };
  }, [points, dims.width, dims.height]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={dims.width} height={dims.height}>
        <g transform={`translate(${PADDING.left},${PADDING.top})`}>
          {/* Quadrant labels */}
          <text x={4} y={8} fontSize={9} fill="rgba(255,255,255,0.1)">Active Churn</text>
          <text x={plotW - 4} y={8} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.15)" fontWeight={600}>Legacy Debt</text>
          <text x={4} y={plotH - 4} fontSize={9} fill="rgba(255,255,255,0.1)">Healthy</text>
          <text x={plotW - 4} y={plotH - 4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.1)">Stable Legacy</text>

          {/* X axis */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
          <text x={plotW / 2} y={plotH + 30} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">
            File Age (days)
          </text>
          {xScale.ticks(5).map((tick) => (
            <g key={`x-${tick}`} transform={`translate(${xScale(tick)},${plotH})`}>
              <line y2={4} stroke="var(--border-primary)" />
              <text y={14} textAnchor="middle" fontSize={8} fill="var(--text-tertiary)">{tick}</text>
            </g>
          ))}

          {/* Y axis */}
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--border-primary)" />
          <text
            transform={`translate(-40,${plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-tertiary)"
          >
            Rewrite Score
          </text>
          {yScale.ticks(5).map((tick) => (
            <g key={`y-${tick}`} transform={`translate(0,${yScale(tick)})`}>
              <line x2={-4} stroke="var(--border-primary)" />
              <text x={-8} textAnchor="end" dominantBaseline="central" fontSize={8} fill="var(--text-tertiary)">{tick}</text>
            </g>
          ))}

          {/* Data points */}
          {points.map((p) => {
            const cx = xScale(p.ageDays);
            const cy = yScale(p.rewriteScore);
            const r = rScale(p.loc);
            const isSelected = selectedFile === p.file;

            return (
              <circle
                key={p.file}
                cx={cx}
                cy={cy}
                r={r}
                fill={trendColor(p.churnTrend, 0.4)}
                stroke={isSelected ? 'var(--accent-primary)' : trendColor(p.churnTrend, 0.7)}
                strokeWidth={isSelected ? 2.5 : 1}
                onClick={() => onSelectFile(p.file)}
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, point: p });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Legend */}
          <g transform={`translate(${plotW - 140},${plotH - 50})`}>
            {(['accelerating', 'stable', 'decelerating'] as const).map((trend, i) => (
              <g key={trend} transform={`translate(0,${i * 14})`}>
                <circle cx={5} cy={0} r={4} fill={trendColor(trend, 0.5)} stroke={trendColor(trend, 0.8)} />
                <text x={14} dominantBaseline="central" fontSize={9} fill="var(--text-tertiary)">{trend}</text>
              </g>
            ))}
          </g>
        </g>
      </svg>

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
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.point.file}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Age: {tooltip.point.ageDays}d · Rewrite: {tooltip.point.rewriteScore} · LOC: {tooltip.point.loc} · {tooltip.point.churnTrend}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into Shell — replace placeholder**

In `apps/web/src/components/layout/Shell.tsx`, add import:
```typescript
import { DebtScatter } from '../hero/DebtScatter';
```

Replace the debt-scatter placeholder:
```tsx
{selection.activeHeroViz === 'debt-scatter' && (
  <DebtScatter
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

- [ ] **Step 3: Build and verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/hero/DebtScatter.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add Debt Scatter hero visualization (KAN-76)"
```

---

### Task 11: Final Integration Build and Lint

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: All three packages build successfully.

- [ ] **Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors. Fix any lint issues that arise from new files.

- [ ] **Step 3: Run formatter**

Run: `pnpm format`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: lint and format new dashboard components"
```

- [ ] **Step 5: Verify in browser**

Run: `node apps/cli/dist/index.js --path /path/to/any-git-repo --web`

Open the web dashboard and verify:
1. Sidebar Dashboard item expands with Overview/Risk/Tech Debt sub-items
2. Clicking Risk switches metrics strip, hero viz (heatmap), and bottom panel (Risk Register)
3. Clicking Tech Debt switches to growth timeline + debt inventory
4. Hero viz switchers work within each mode
5. File selection from any viz/table populates the inspector panel
6. Clicking a non-Dashboard sidebar item collapses the tree
