# Hotspot Health Sentiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add health sentiment to the hotspot UI — a narrative verdict, per-entry green/amber/red coloring, and an "all clear" state — so hotspots read as a diagnostic rather than a uniform warning list.

**Architecture:** Pure rendering-layer changes in CLI and web. No new types, analyzers, or core logic. Narrative verdict logic is inlined in both `HotspotPanel` (CLI) and `ChurnTab` (web) — two call sites doesn't warrant extraction. Color helper functions shift `moderate`/`low` from cyan/gray to green.

**Tech Stack:** Ink (React TUI) for CLI, React + Tailwind for web. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-22-hotspot-health-sentiment-design.md`

---

### Task 1: Update CLI color helpers

**Files:**
- Modify: `apps/cli/src/components/App.tsx:531-538` (`getHotspotColor`)

- [ ] **Step 1: Update `getHotspotColor` to shift moderate/low to green**

Change the function at line 531:

```typescript
function getHotspotColor(category: string): string {
  switch (category) {
    case 'critical': return 'red';
    case 'warning': return 'yellow';
    case 'moderate': return 'green';
    default: return 'green';
  }
}
```

- [ ] **Step 2: Build CLI to verify no errors**

Run: `pnpm --filter @gitlore/cli build`
Expected: Clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/components/App.tsx
git commit -m "feat(cli): shift hotspot moderate/low colors to green sentiment"
```

---

### Task 2: Add CLI health narrative and all-clear state

**Files:**
- Modify: `apps/cli/src/components/App.tsx:207-228` (`HotspotPanel`)

- [ ] **Step 1: Rewrite `HotspotPanel` with narrative and all-clear logic**

Replace the `HotspotPanel` function (lines 207-228) with:

```tsx
function HotspotPanel({ report }: { report: GitloreReport }) {
  const { hotspots } = report;
  if (hotspots.files.length === 0) return null;

  const criticalCount = hotspots.topHotspots.filter(f => f.category === 'critical').length;
  const warningCount = hotspots.topHotspots.filter(f => f.category === 'warning').length;
  const hasConcerning = criticalCount > 0 || warningCount > 0;

  let verdictText: string;
  let verdictColor: string;
  if (criticalCount >= 4) {
    verdictText = `Complexity is concentrating where you work most — ${criticalCount} of your top hotspots are critical.`;
    verdictColor = 'red';
  } else if (criticalCount >= 1 || warningCount >= 3) {
    verdictText = 'A few hotspots show high churn combined with high complexity — worth investigating.';
    verdictColor = 'yellow';
  } else {
    verdictText = 'Your most-changed files have manageable complexity — active code is well-structured.';
    verdictColor = 'green';
  }

  return (
    <Box flexDirection="column">
      <Text color="red" bold>
        {'── Hotspots (churn × complexity) ───────────────────────────'}
      </Text>
      <Text color="gray" dimColor>{hotspots.summary}</Text>
      {hasConcerning ? (
        <>
          <Text color={verdictColor}>{verdictText}</Text>
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
        </>
      ) : (
        <Text color="green">✓ No concerning hotspots — your active code is well-structured</Text>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Build CLI to verify**

Run: `pnpm --filter @gitlore/cli build`
Expected: Clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/src/components/App.tsx
git commit -m "feat(cli): add hotspot health narrative and all-clear state"
```

---

### Task 3: Update web color helpers

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx:512-537` (`hotspotDot`, `hotspotBar`, `hotspotBadge`)

- [ ] **Step 1: Update `hotspotDot` to shift moderate/low to green**

```typescript
function hotspotDot(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-500';
    case 'warning': return 'bg-yellow-500';
    case 'moderate': return 'bg-green-500';
    default: return 'bg-green-500';
  }
}
```

- [ ] **Step 2: Update `hotspotBar` to shift moderate/low to green**

```typescript
function hotspotBar(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-600';
    case 'warning': return 'bg-yellow-600';
    case 'moderate': return 'bg-green-700';
    default: return 'bg-green-700';
  }
}
```

- [ ] **Step 3: Update `hotspotBadge` to shift moderate/low to green**

```typescript
function hotspotBadge(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-950 text-red-400';
    case 'warning': return 'bg-yellow-950 text-yellow-400';
    case 'moderate': return 'bg-green-950 text-green-400';
    default: return 'bg-green-950 text-green-400';
  }
}
```

- [ ] **Step 4: Build web to verify**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Dashboard.tsx
git commit -m "feat(dashboard): shift hotspot moderate/low colors to green sentiment"
```

---

### Task 4: Add web health narrative and all-clear state

**Files:**
- Modify: `apps/web/src/components/Dashboard.tsx:130-148` (`ChurnTab`)

- [ ] **Step 1: Rewrite `ChurnTab` with narrative and all-clear logic**

Replace the `ChurnTab` function (lines 130-148) with:

```tsx
function ChurnTab({ report }: { report: GitloreReport }) {
  const criticalCount = report.hotspots.topHotspots.filter(f => f.category === 'critical').length;
  const warningCount = report.hotspots.topHotspots.filter(f => f.category === 'warning').length;
  const hasConcerning = criticalCount > 0 || warningCount > 0;

  let verdictText: string;
  let verdictColor: string;
  if (criticalCount >= 4) {
    verdictText = `Complexity is concentrating where you work most — ${criticalCount} of your top hotspots are critical.`;
    verdictColor = 'text-red-400';
  } else if (criticalCount >= 1 || warningCount >= 3) {
    verdictText = 'A few hotspots show high churn combined with high complexity — worth investigating.';
    verdictColor = 'text-yellow-400';
  } else {
    verdictText = 'Your most-changed files have manageable complexity — active code is well-structured.';
    verdictColor = 'text-green-400';
  }

  if (!hasConcerning) {
    return (
      <div>
        <div className="text-center py-20">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-green-400 text-lg">No concerning hotspots detected</p>
          <p className="text-gray-500 text-sm mt-2">Your active code is well-structured — no files show dangerous churn × complexity</p>
        </div>
        <HotspotClusters data={report.hotspotClusters} />
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-400 mb-2 text-sm">{report.hotspots.summary}</p>
      <p className={`${verdictColor} text-sm mb-4`}>{verdictText}</p>
      <div className="space-y-1">
        {report.hotspots.files.slice(0, 50).map(f => (
          <div key={f.file} className="flex items-center gap-3 py-1 hover:bg-gray-900 rounded-sm px-2">
            <div className={`h-3 rounded-sm ${hotspotBar(f.category)}`} style={{ width: `${f.hotspotScore * 2}px`, minWidth: '4px' }} />
            <span className="text-gray-300 text-sm font-mono flex-1">{f.file}</span>
            <span className="text-gray-500 text-xs">{f.loc} LOC</span>
            <span className="text-gray-500 text-xs">{f.churnScore} churn</span>
            <span className={`text-xs px-2 py-0.5 rounded-sm ${hotspotBadge(f.category)}`}>{f.category}</span>
          </div>
        ))}
      </div>
      <HotspotClusters data={report.hotspotClusters} />
    </div>
  );
}
```

- [ ] **Step 2: Build web to verify**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Dashboard.tsx
git commit -m "feat(dashboard): add hotspot health narrative and all-clear state"
```

---

### Task 5: Full build verification

- [ ] **Step 1: Build all packages**

Run: `pnpm build`
Expected: All three packages build clean.

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All 175 tests pass — no regressions.

- [ ] **Step 3: Update kanban**

Move "Hotspot health sentiment" from Backlog to Done in `.claude/kanban.md`. Add a summary entry describing the three changes (narrative, entry sentiment, all-clear state).
