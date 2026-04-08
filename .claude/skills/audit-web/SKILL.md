---
name: audit-web
description: Use when auditing apps/web for Node.js import violations, XSS in tabs/visualizations rendering commit data, report loading edge cases, or D3/SVG rendering bugs with user-controlled values.
---

# Audit: apps/web

The browser dashboard. The critical constraint: it must never import values from `@gitlore/core` — that would bundle Node.js modules (`execa`, `node:fs`, `node:http`) into the browser build and break Vite.

## Checklist

### 1. Import Discipline (Critical)

**Rule:** `apps/web` may only use `import type` from `@gitlore/core`. Any value import (functions, classes, constants) pulls in Node.js deps and breaks the browser build.

- Run: `grep -r "from '@gitlore/core'" apps/web/src` — every match must be `import type`
- Run: `grep -r "require('@gitlore/core')" apps/web/src` — must be zero
- If any scoring thresholds, category weights, or shared constants are needed in the browser, they should be duplicated into `apps/web/src/utils/` (like sickbay's `lib/constants.ts`), not imported from core
- Run `pnpm --filter @gitlore/web build` — a Node.js import violation fails Vite at build time with a cryptic "Module externalized" error

### 2. XSS Surface

The dashboard renders user-controlled data from git: file paths, commit messages, author names/emails, branch names. All of these can contain arbitrary unicode, angle brackets, or control characters. Review:

- **Commit messages in `ShameTab`, `ForensicsTab`, `CursedFilesTab`** — shame narratives include the raw commit message. React's default escaping handles this as text, but verify no raw-HTML injection props are used anywhere (grep for `dangerouslySetInnerHTML`)
- **File paths everywhere** — rendered in most tabs and hero visualizations. React escapes text nodes, but paths embedded in SVG `<text>` elements via D3 can bypass this if using `.html()` instead of `.text()`. Grep `apps/web/src` for `.html(` calls on D3 selections
- **Author names and emails** — `ContributorsTab`, `CoAuthorsTab`, `OwnershipSunburst`, `OwnershipBubble`. Same D3 caveat — check for any `.html()` usage
- **Tooltip content** — `components/shared/Tooltip.tsx` and any inline tooltip rendering. Verify they render user data as text, not HTML

### 3. D3 / SVG Rendering with User Data

The hero/ visualizations are the biggest XSS surface because they use D3 to build DOM nodes from commit data. For each of these, verify the text rendering path:

- `CommitDAG.tsx`, `CommitBranches.tsx`, `CommitGraph.tsx` — commit hashes and messages
- `ContributorSwimlanes.tsx` — author names as row labels
- `OwnershipBubble.tsx`, `OwnershipSunburst.tsx` — file paths and author names as labels
- `ChurnTreemap.tsx`, `HotspotScatter.tsx`, `DebtScatter.tsx`, `RiskHeatmap.tsx` — file paths as labels and tooltips
- `CouplingForceGraph.tsx`, `CouplingHeatmap.tsx` — pairs of file paths
- `Timeline.tsx`, `GrowthTimeline.tsx`, `CommitHeatmap.tsx` — dates and commit messages

For each: confirm text is set via React children or D3's `.text()` (safe), not `.html()` or direct `innerHTML` assignment (unsafe).

### 4. Report Loading (`apps/web/src/App.tsx`)

Currently very simple: `fetch('/gitlore-report.json')`, parse, pass to `Shell`. Review edge cases:

- 404 when dashboard is opened standalone (no CLI server) — current error message "No report found. Run gitlore --web to generate one." is fine
- Malformed JSON — `r.json()` rejects; does the catch handler surface a useful message or just the generic `SyntaxError`?
- **Structurally valid but missing fields** — e.g. a report missing `hotspotClusters` (older CLI version) will crash the corresponding tab. Does the dashboard gracefully skip missing sections or show "unavailable"?
- **No report validation at all** — the cast `as Promise<GitloreReport>` is a lie. Consider a minimal shape check before rendering

### 5. Large-Report Performance

Git repos can produce very large reports: thousands of files, tens of thousands of commits. Review:

- Tabs that render the full file list unvirtualized (`HotspotsTab`, `ContributorsTab`, `CursedFilesTab`) — do they paginate, virtualize, or cap?
- `CommitDAG`, `CommitBranches`, `Timeline` — do they downsample for >10k commits, or render every node?
- `CouplingForceGraph` — N² coupling pairs can explode; is there a top-N cutoff?
- `useSelection` hook — if state grows to include thousands of selected items, any O(n²) operations?

### 6. Theme and Accessibility

`theme.ts` and `index.css` define the visual system. Lower priority than the above, but:

- Does any tab hardcode colors instead of pulling from the theme?
- Do D3 visualizations respect the theme's background / text colors, or do they hardcode?
- SVG `<text>` elements need explicit `fill` — verify they're not inheriting from CSS in a way that breaks in some browsers

## Key Files

```
apps/web/src/
├── App.tsx                       # Report loading — edge cases
├── components/
│   ├── layout/Shell.tsx          # Top-level layout
│   ├── tabs/                     # 22 tabs — each renders commit/file data
│   ├── hero/                     # D3 visualizations — biggest XSS surface
│   │   ├── CommitDAG.tsx, CommitBranches.tsx, CommitGraph.tsx
│   │   ├── ContributorSwimlanes.tsx, OwnershipSunburst.tsx, OwnershipBubble.tsx
│   │   ├── ChurnTreemap.tsx, HotspotScatter.tsx, RiskHeatmap.tsx
│   │   └── CouplingForceGraph.tsx, CouplingHeatmap.tsx
│   ├── inspector/                # File/contributor/activity drill-downs
│   └── shared/Tooltip.tsx        # Generic tooltip — verify text-only
└── hooks/useSelection.ts         # Selection state — perf with large reports
```

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. Start with the import discipline grep (§1), then sweep `apps/web/src/components/hero/` for any `.html(` calls on D3 selections (§3), then review `App.tsx` report loading (§4). Skip visual/styling issues entirely.
