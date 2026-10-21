# Overview Fan Implementation Plan (RELIC-361)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overview lands on a Fan (repo → four view nodes headlined by their loudest lens → the open view's lenses on an arc, a lens click fanning out its top entities), with the existing Ring as its alternate form.

**Architecture:** A new entity kind `view:<group>` makes views selectable (and URL-addressable through `#s=`). A pure layout `layouts/fan.ts` builds the scene from `lensReadings`, `viewHeadline`/`loudestView` (new, `overview/viewHeadlines.ts`) and `lensTopEntities`; the parts the Ring and Fan share move to `layouts/overviewParts.ts`. Atlas's `nextFanFocus` accepts `view:` ids, and the inspector gets a `ViewCard`.

**Tech Stack:** TypeScript 6, Vitest, Svelte 5 (runes), `@testing-library/svelte`, pnpm, oxlint/oxfmt.

**Spec:** `docs/atlas-views.md` › Overview (the "Primary form — Fan" block, checkpoint boards D/E) and the 2026-10-20 decision-log entry.

**Branch:** work on `relic-361-overview-fan` in the main checkout (not a worktree), so the 7778 dev server Dan uses shows it.

---

## Decisions made while planning (deviations from board D)

1. **View cards are nodes, not boxes.** The Pixi stage draws nothing for `shape: 'card'` (`pixiStage.ts`: "cards by the DOM card overlay", which doesn't exist), and labels hide below alpha 0.5 (`labelLayer.ts` `MIN_ALPHA`), so a faint box can't carry its label. Each view is a dot sized and heated by its loudest lens's grade, labelled above with the view name over the loudest reading (`"8 files"`). The lens name goes in the tooltip and the inspector. Boxes would be a renderer feature of their own; out of scope.
2. **⌘K lists views and selects them** (it doesn't navigate). `palettePick` already selects anything that isn't an Atlas lens, so on Overview a picked view fans it, and elsewhere the inspector shows its `ViewCard`, which has an Open button.
3. **Nothing selected on Overview still shows `RepoMapCard`**, whose "loudest view" switches to `loudestView` so it names the same view the fan opens.

## File map

| File | Change | Responsibility |
|---|---|---|
| `packages/scene/src/ids.ts` | modify | `view` entity kind + `ids.view` |
| `packages/scene/src/entities.ts` | modify | index the four views (`kind: 'view'`) |
| `packages/scene/src/search/rank.ts` | modify | `view` in `KIND_ORDER` |
| `packages/scene/src/overview/viewHeadlines.ts` | create | `FAN_VIEWS`, `FanView`, `viewHeadline`, `loudestView`, `VIEW_BLURBS` |
| `packages/scene/src/layouts/overviewParts.ts` | create | grade ramp, `anchorFor`, `fanOut`, `labelledBounds` shared by both forms |
| `packages/scene/src/layouts/ring.ts` | modify | use `overviewParts`; sector labels take `view:` ids |
| `packages/scene/src/layouts/fan.ts` | create | `fanScene` |
| `packages/scene/src/views/overview.ts` | modify | `fanLayout`; `layouts: [fanLayout, ringLayout]` |
| `packages/scene/src/index.ts` | modify | exports |
| `apps/atlas/src/lib/views/fanFocus.ts` | modify | accept `view:` |
| `apps/atlas/src/lib/inspector/ViewCard.svelte` | create | the selected view |
| `apps/atlas/src/lib/shell/Inspector.svelte` | modify | route `view:` to `ViewCard`; `onMap` prop |
| `apps/atlas/src/lib/inspector/LensPreviewCard.svelte`, `RepoMapCard.svelte` | modify | form-neutral copy; `loudestView` |
| `apps/atlas/src/lib/shell/Shell.svelte` | modify | comment/variable naming only |
| `docs/atlas-views.md`, `CLAUDE.md` | modify | as built |

Test commands used throughout:

- Scene, one file: `pnpm --filter @gitrelic/scene exec vitest run <path relative to packages/scene>`
- Atlas, one file: `pnpm --filter @gitrelic/atlas exec vitest run <path relative to apps/atlas>`

---

### Task 0: Branch

- [ ] **Step 1:** `git checkout -b relic-361-overview-fan` (from an up-to-date `main`; the views-doc checkpoint edit and this plan are already in the working tree and ride along in Task 1's commit).

---

### Task 1: The `view:` entity kind

**Files:**
- Modify: `packages/scene/src/ids.ts`
- Test: `packages/scene/src/ids.test.ts`

- [ ] **Step 1: Write the failing test.** In `ids.test.ts`, add to the `cases` array in "builds and reads back every kind":

```ts
      [ids.view('code-health'), 'view', 'code-health'],
```

and add to the `parentOf` describe block:

```ts
  it('puts a view under the repo', () => {
    expect(parentOf(ids.view('structure'))).toBe(REPO_ID);
  });
```

- [ ] **Step 2: Run it, expect failure** (`ids.view is not a function`):
`pnpm --filter @gitrelic/scene exec vitest run src/ids.test.ts`

- [ ] **Step 3: Implement.** In `ids.ts`, add to the header comment after the `analyzer:` line:

```ts
//   view:<group id>            one of the five views (Overview fan's nodes)
```

add `'view',` to `ENTITY_KINDS` right after `'analyzer',`, and to `ids` after `analyzer`:

```ts
  view: (group: string): EntityId => `view:${group}`,
```

`parentOf` already sends every other kind to the repo; no change there.

- [ ] **Step 4: Run it, expect PASS.** Same command.

- [ ] **Step 5: Commit**

```bash
git add packages/scene/src/ids.ts packages/scene/src/ids.test.ts docs/atlas-views.md docs/superpowers/plans/2026-10-20-overview-fan.md
git commit -m "feat(scene): view entity kind for the Overview fan (RELIC-361)"
```

---

### Task 2: Index the views; rank them first

**Files:**
- Modify: `packages/scene/src/entities.ts`, `packages/scene/src/search/rank.ts`
- Test: `packages/scene/src/entities.test.ts`, `packages/scene/src/search/rank.test.ts`

- [ ] **Step 1: Write the failing tests.** In `entities.test.ts`, in "indexes analyzers, people, directories and files", after the `analyzer` count line add:

```ts
    expect(kinds.get('view')).toBe(4);
```

and add a test:

```ts
  it('indexes the four views the fan draws, not the Overview itself', () => {
    expect(index.get(ids.view('ownership-risk'))).toMatchObject({
      kind: 'view',
      label: 'Ownership & Risk',
      detail: 'View',
    });
    expect(index.get(ids.view('overview'))).toBeUndefined();
  });
```

(Use the file's existing `index`/`ids` names; if the file builds the index inside each test, do the same here with `buildEntityIndex(report)`.)

In `rank.test.ts`, add (the file has an `entry(id, kind, label, keywords?)` helper at the top):

```ts
  it('ranks a view ahead of an analyzer with the same label score', () => {
    const tied = [
      entry('analyzer:structure-x', 'analyzer', 'Structure'),
      entry('view:structure', 'view', 'Structure'),
    ];
    expect(rankEntities('structure', tied)[0].entry.kind).toBe('view');
  });
```

- [ ] **Step 2: Run, expect failure:**
`pnpm --filter @gitrelic/scene exec vitest run src/entities.test.ts src/search/rank.test.ts`
(the rank test also fails to type-check `'view'` until `SearchKind` has it; vitest still runs it.)

- [ ] **Step 3: Implement.** In `entities.ts`:

```ts
export type SearchKind = 'view' | 'analyzer' | 'person' | 'dir' | 'file';
```

update the header comment's list ("views, analyzers, files, directories and people"), and after the `CATALOG` loop add:

```ts
  // The views the Overview fan draws, selectable like a lens.
  for (const group of PRESET_GROUPS) {
    if (group.id === 'overview') continue;
    entries.push({
      id: ids.view(group.id),
      kind: 'view',
      label: group.label,
      detail: 'View',
      keywords: [group.id],
    });
  }
```

In `search/rank.ts`:

```ts
const KIND_ORDER: Record<SearchKind, number> = {
  view: 0,
  analyzer: 1,
  person: 2,
  dir: 3,
  file: 4,
};
```

and change the `rankEntities` doc comment's "Ties go to analyzers, then people, directories, files" to "Ties go to views, then analyzers, people, directories, files".

- [ ] **Step 4: Run, expect PASS.** Same command, then the whole scene suite: `pnpm --filter @gitrelic/scene test`.

- [ ] **Step 5: Commit**

```bash
git add packages/scene/src/entities.ts packages/scene/src/entities.test.ts packages/scene/src/search/rank.ts packages/scene/src/search/rank.test.ts
git commit -m "feat(scene): index views, so #s=view:… resolves and ⌘K finds them"
```

---

### Task 3: View headlines and the loudest view

**Files:**
- Create: `packages/scene/src/overview/viewHeadlines.ts`
- Test: `packages/scene/src/overview/viewHeadlines.test.ts`

- [ ] **Step 1: Write the failing test** `viewHeadlines.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { PRESET_GROUPS } from '../catalog';
import { lensReadings, type LensReading } from './readings';
import {
  FAN_VIEWS,
  loudestView,
  VIEW_BLURBS,
  viewHeadline,
} from './viewHeadlines';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const calm = lensReadings(report).map((r) => ({ ...r, grade: 0 as const }));
const grade = (
  readings: readonly LensReading[],
  grades: Record<string, LensReading['grade']>,
) => readings.map((r) => ({ ...r, grade: grades[r.preset] ?? r.grade }));

describe('FAN_VIEWS', () => {
  it('is every view but the Overview, in rail order', () => {
    expect(FAN_VIEWS).toEqual(
      PRESET_GROUPS.filter((g) => g.id !== 'overview').map((g) => g.id),
    );
    for (const v of FAN_VIEWS) expect(VIEW_BLURBS[v]).toBeTruthy();
  });
});

describe('viewHeadline', () => {
  it('is the loudest lens, ties going to lens-bar order', () => {
    const readings = grade(calm, { 'fix-rate': 2, 'cursed-files': 3, churn: 3 });
    // churn comes before cursed-files in the lens bar.
    expect(viewHeadline('code-health', readings)?.preset).toBe('churn');
  });

  it("is the view's first lens when every lens is calm", () => {
    const first = calm.find((r) => r.group === 'team-activity')!;
    expect(viewHeadline('team-activity', calm)?.preset).toBe(first.preset);
  });

  it('is undefined for a view with no lenses', () => {
    expect(viewHeadline('structure', [])).toBeUndefined();
  });
});

describe('loudestView', () => {
  it('opens the view with the highest top grade, ties going to rail order', () => {
    const readings = grade(calm, { 'bus-factor': 3, 'cursed-files': 3 });
    expect(loudestView(readings)).toBe('code-health');
    expect(loudestView(grade(calm, { 'test-coverage': 2 }))).toBe('structure');
  });

  it('opens the first view when everything is calm', () => {
    expect(loudestView(calm)).toBe('code-health');
  });
});
```

- [ ] **Step 2: Run, expect failure** (module not found):
`pnpm --filter @gitrelic/scene exec vitest run src/overview/viewHeadlines.test.ts`

- [ ] **Step 3: Implement** `viewHeadlines.ts`:

```ts
// What the Overview fan says about each view (docs/atlas-views.md ›
// Overview): its headline is its loudest lens, and the loudest view is the
// one the fan opens on.

import type { PresetGroup } from '../catalog';
import type { LensReading } from './readings';

/** A view the fan draws: every group but the Overview itself. */
export type FanView = Exclude<PresetGroup, 'overview'>;

/** In rail order (a test keeps it in step with `PRESET_GROUPS`). */
export const FAN_VIEWS: readonly FanView[] = [
  'code-health',
  'ownership-risk',
  'team-activity',
  'structure',
];

/** What each view covers, in a line (the inspector's view card). */
export const VIEW_BLURBS: Record<FanView, string> = {
  'code-health': 'Where the code itself is under strain: churn, risk, age and fixes.',
  'ownership-risk': 'Who knows the code, and what happens when they leave.',
  'team-activity': "How the team works: who's active, when, and with whom.",
  structure: 'What the repo is made of: languages, tests and renames.',
};

/**
 * A view's loudest lens: the highest grade, ties going to lens-bar order
 * (`readings` is in catalog order). When every lens is calm, its first.
 */
export function viewHeadline(
  view: FanView,
  readings: readonly LensReading[],
): LensReading | undefined {
  let best: LensReading | undefined;
  for (const r of readings)
    if (r.group === view && (!best || r.grade > best.grade)) best = r;
  return best;
}

/** The view the fan opens on: the highest top grade, ties going to rail order. */
export function loudestView(readings: readonly LensReading[]): FanView {
  let best = FAN_VIEWS[0];
  let top = -1;
  for (const view of FAN_VIEWS) {
    const grade = viewHeadline(view, readings)?.grade ?? -1;
    if (grade > top) {
      best = view;
      top = grade;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run, expect PASS.** Same command.

- [ ] **Step 5: Commit**

```bash
git add packages/scene/src/overview/viewHeadlines.ts packages/scene/src/overview/viewHeadlines.test.ts
git commit -m "feat(scene): view headlines and the loudest view for the Overview fan"
```

---

### Task 4: Extract what the Ring and Fan share (pure refactor)

**Files:**
- Create: `packages/scene/src/layouts/overviewParts.ts`
- Modify: `packages/scene/src/layouts/ring.ts`
- Test: `packages/scene/src/layouts/ring.test.ts` (existing; must stay green), `packages/scene/src/layouts/overviewParts.test.ts` (new)

- [ ] **Step 1: Write the failing test** `overviewParts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ids } from '../ids';
import { checkScene } from '../model';
import { fanOut, labelledBounds } from './overviewParts';

const entities = [
  { id: ids.file('src/a.ts'), label: 'a.ts', value: '12 commits' },
  { id: ids.person('ann@corp.com'), label: 'Ann', value: '80%' },
  { id: ids.dir('src'), label: 'src/', value: '3 files' },
];

describe('fanOut', () => {
  it("puts a lens's entities on an arc beyond it, parented to it", () => {
    const { marks, links } = fanOut('hotspots', 100, 100, 0, 200, entities);
    expect(marks.map((m) => m.id)).toEqual(entities.map((e) => e.id));
    for (const m of marks) {
      expect(m.parent).toBe(ids.analyzer('hotspots'));
      expect(Math.hypot(m.x - 100, m.y - 100)).toBeCloseTo(200);
      // Outward 0 is to the right: nothing fans back over the lens.
      expect(m.x).toBeGreaterThan(100);
    }
    expect(marks.map((m) => m.paint)).toEqual(['--file', '--person', '--dir']);
    expect(links.map((l) => l.source)).toEqual(
      entities.map(() => ids.analyzer('hotspots')),
    );
  });

  it('bounds every mark with room for its labels', () => {
    const lens = {
      id: ids.analyzer('hotspots'), shape: 'dot' as const, paint: '--risk-0' as const,
      x: 100, y: 100, r: 5, w: 0, h: 0, a0: 0, a1: 0, alpha: 1,
    };
    const fan = fanOut('hotspots', 100, 100, 0, 200, entities);
    const marks = [lens, ...fan.marks];
    const scene = { marks, links: fan.links, guides: [], bounds: labelledBounds(marks) };
    expect(checkScene(scene)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect failure** (module not found):
`pnpm --filter @gitrelic/scene exec vitest run src/layouts/overviewParts.test.ts`

- [ ] **Step 3: Create** `overviewParts.ts` by moving code out of `ring.ts` unchanged except where noted:

```ts
// What the Overview's two forms (fan.ts, ring.ts) share: how a lens looks for
// its outlier grade, how a lens fans its top entities out, and the room their
// labels need. A lens previews the same way in either form.

import { ids, type EntityId } from '../ids';
import type { Link, Mark, Paint } from '../model';
import type { FannedEntity } from '../overview/topEntities';

export const DOT_R = [5, 7, 10, 14] as const;
export const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
/** Lenses graded 2+ (the ones that badge) get a label the CSS can heat. */
export const LABEL_CLASS = [
  undefined,
  undefined,
  'atlas-label--hot',
  'atlas-label--hot',
] as const;
export const ZERO = { w: 0, h: 0, a0: 0, a1: 0 };

const FAN_DOT = 5;
/**
 * Room beside the outermost marks for their DOM labels, world units. Labels
 * are screen pixels, so at the ~0.65 zoom a 1440px window fits this world at,
 * a two-line label 20 characters wide needs about 220 units across and 55
 * down.
 */
const LABEL_ROOM = 240;
const LABEL_ROOM_Y = 64;
const MARGIN = 32;

/** Labels point away from the centre, so they never cross the ring. */
export function anchorFor(dx: number, dy: number): Mark['labelAnchor'] {
  // body moved verbatim from ring.ts
}

function entityPaint(id: EntityId): Paint {
  // body moved verbatim from ring.ts
}

/**
 * A lens's top entities on an arc of `radius` around the lens at (x, y),
 * centred on the `outward` angle (radians, 0 = right), each parented to the
 * lens so it grows out of it.
 */
export function fanOut(
  preset: string,
  x: number,
  y: number,
  outward: number,
  radius: number,
  entities: readonly FannedEntity[],
): { marks: Mark[]; links: Link[] } {
  const marks: Mark[] = [];
  const links: Link[] = [];
  const source = ids.analyzer(preset);
  const span = Math.min(Math.PI * 0.9, 0.32 * entities.length);
  entities.forEach((e, i) => {
    const t = entities.length === 1 ? 0 : i / (entities.length - 1) - 0.5;
    const a = outward + t * span;
    const fx = x + radius * Math.cos(a);
    const fy = y + radius * Math.sin(a);
    marks.push({
      id: e.id,
      shape: 'dot',
      paint: entityPaint(e.id),
      x: fx,
      y: fy,
      r: FAN_DOT,
      ...ZERO,
      alpha: 1,
      parent: source,
      // The name only: the inspector lists each one's value beside it.
      label: e.label,
      labelPriority: 40 - i,
      labelAnchor: anchorFor(fx - x, fy - y),
      z: 4,
      tip: [e.label, e.value],
    });
    links.push({
      id: `fan:${e.id}`,
      source,
      target: e.id,
      curve: 'arc',
      width: 1.2,
      paint: '--link-hot',
      alpha: 0.7,
    });
  });
  return { marks, links };
}

/** Every mark, plus margin and room for the labels drawn beside them. */
export function labelledBounds(marks: readonly Mark[]) {
  // body moved verbatim from ring.ts's boundsOf
}
```

Then in `ring.ts`:
- delete `DOT_R`, `RAMP`, `LABEL_CLASS`, `FAN_DOT`, `LABEL_ROOM`, `LABEL_ROOM_Y`, `MARGIN`, `zero`, `anchorFor`, `entityPaint`, `boundsOf` (keep `REPO_R`, `LEAN`, `SPOKE_CLEAR`, `leanFor`, `fannedLabel`, and the `LABEL_ROOM` doc comment goes with the constant);
- import them: `import { anchorFor, DOT_R, fanOut, LABEL_CLASS, labelledBounds, RAMP, ZERO } from './overviewParts';` and drop `Paint` / `EntityId` from the model/ids imports if now unused;
- replace every `...zero` with `...ZERO`;
- replace the fan block (from `// The fan: the focused lens's entities…` through its closing `}`) with:

```ts
  // The fan: the focused lens's entities on an arc beyond it, pointing away
  // from the centre, so they never cross the ring.
  if (focus && angleOf.has(focus.preset) && focus.entities.length > 0) {
    const [lx, ly] = at(angleOf.get(focus.preset)!, rx, ry);
    const fan = fanOut(
      focus.preset,
      lx,
      ly,
      Math.atan2(ly - cy, lx - cx),
      Math.min(viewport.width, viewport.height) * 0.26,
      focus.entities,
    );
    marks.push(...fan.marks);
    links.push(...fan.links);
  }

  return { marks, links, guides, bounds: labelledBounds(marks) };
```

- [ ] **Step 4: Run both, expect PASS** (the ring tests prove the refactor changed nothing):
`pnpm --filter @gitrelic/scene exec vitest run src/layouts/overviewParts.test.ts src/layouts/ring.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/scene/src/layouts/overviewParts.ts packages/scene/src/layouts/overviewParts.test.ts packages/scene/src/layouts/ring.ts
git commit -m "refactor(scene): share the Overview's lens ramp, fan-out and bounds"
```

---

### Task 5: The Ring's view names take `view:` ids

So switching forms morphs each fan node into its Ring sector label instead of cutting.

**Files:**
- Modify: `packages/scene/src/layouts/ring.ts:161-177`
- Test: `packages/scene/src/layouts/ring.test.ts`

- [ ] **Step 1: Write the failing test** in `ring.test.ts`:

```ts
  it("names each view with its view id, a label that can't be hit", () => {
    const scene = ringScene(repo, readings, null, viewport);
    const views = scene.marks.filter((m) => m.id.startsWith('view:'));
    expect(views.map((m) => m.id)).toEqual(
      [...new Set(readings.map((r) => r.group))].map((g) => ids.view(g)),
    );
    for (const m of views) expect([m.shape, m.r, m.w, m.h]).toEqual(['card', 0, 0, 0]);
  });
```

- [ ] **Step 2: Run, expect failure:** `pnpm --filter @gitrelic/scene exec vitest run src/layouts/ring.test.ts`

- [ ] **Step 3: Implement.** In `ring.ts` replace the view-name comment and id:

```ts
    // The view's name: a label-only mark (cards draw nothing on the canvas),
    // since the canvas draws no text and labels are DOM. It carries the
    // view's id, so the fan's view node travels to it when the form
    // changes; a 0×0 card can't be hit, so clicking near it selects nothing.
    marks.push({
      id: ids.view(group.id),
```

- [ ] **Step 4: Run, expect PASS.** Same command.

- [ ] **Step 5: Commit**

```bash
git add packages/scene/src/layouts/ring.ts packages/scene/src/layouts/ring.test.ts
git commit -m "feat(scene): the ring's view names carry view ids"
```

---

### Task 6: `fanScene`

**Files:**
- Create: `packages/scene/src/layouts/fan.ts`
- Test: `packages/scene/src/layouts/fan.test.ts`

- [ ] **Step 1: Write the failing test** `fan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { buildEntityIndex } from '../entities';
import { ids, REPO_ID } from '../ids';
import { checkScene } from '../model';
import { lensReadings, type LensReading } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { FAN_VIEWS } from '../overview/viewHeadlines';
import { fanScene } from './fan';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);
const viewport = { width: 1200, height: 800 };
const repo = { label: 'repo', sub: '3 files' };
// Risk loud, Fix rate badging, Bus Factor loudest in its view.
const readings: LensReading[] = lensReadings(report).map((r) => ({
  ...r,
  grade:
    ({ 'cursed-files': 3, 'fix-rate': 2, 'bus-factor': 3 } as const)[
      r.preset as 'cursed-files'
    ] ?? 0,
}));
const closed = { view: 'code-health' as const, lens: null };
const markOf = (scene: ReturnType<typeof fanScene>, id: string) =>
  scene.marks.find((m) => m.id === id)!;

// The sample repo is too small for most fans: use a lens it has entities for.
const preset = ['hotspots', 'churn', 'cursed-files', 'age-map'].find(
  (p) => lensTopEntities(p, report, index).length > 0,
)!;
const previewing = {
  view: 'code-health' as const,
  lens: { preset, entities: lensTopEntities(preset, report, index) },
};

describe('fanScene', () => {
  it('draws the repo, every view, and only the open view’s lenses, soundly', () => {
    const scene = fanScene(repo, readings, closed, viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(scene.marks[0]).toMatchObject({
      id: REPO_ID,
      shape: 'outline',
      label: 'repo',
      labelSub: '3 files',
    });
    expect(scene.marks.filter((m) => m.id.startsWith('view:')).map((m) => m.id))
      .toEqual(FAN_VIEWS.map((v) => ids.view(v)));
    expect(scene.marks.filter((m) => m.id.startsWith('analyzer:')).map((m) => m.id))
      .toEqual(
        readings.filter((r) => r.group === 'code-health').map((r) => ids.analyzer(r.preset)),
      );
    // A trunk to each view, a branch to each open lens.
    expect(scene.links.filter((l) => l.source === REPO_ID)).toHaveLength(4);
    expect(
      scene.links.filter((l) => l.source === ids.view('code-health')),
    ).toHaveLength(readings.filter((r) => r.group === 'code-health').length);
  });

  it('heads each view with its loudest lens, heated by its grade', () => {
    const scene = fanScene(repo, readings, closed, viewport);
    const health = markOf(scene, ids.view('code-health'));
    const cursed = readings.find((r) => r.preset === 'cursed-files')!;
    expect(health).toMatchObject({
      label: 'Code Health',
      labelSub: cursed.value,
      paint: '--risk-3',
      labelClass: 'atlas-label--hot',
    });
    const team = markOf(scene, ids.view('team-activity'));
    expect(team.paint).toBe('--risk-0');
    expect(team.labelClass).toBeUndefined();
    expect(health.r).toBeGreaterThan(team.r);
  });

  it('opens the view it is given, its lenses growing out of it', () => {
    const scene = fanScene(repo, readings, { view: 'ownership-risk', lens: null }, viewport);
    const lenses = scene.marks.filter((m) => m.id.startsWith('analyzer:'));
    expect(lenses.length).toBeGreaterThan(0);
    for (const m of lenses) {
      expect(m.parent).toBe(ids.view('ownership-risk'));
      expect(m.foldOnExit).toBe(true);
    }
  });

  it('previews a lens: slides left, dims the rest, fans its entities out of it', () => {
    const before = fanScene(repo, readings, closed, viewport);
    const scene = fanScene(repo, readings, previewing, viewport);
    expect(checkScene(scene)).toEqual([]);
    expect(markOf(scene, REPO_ID).x).toBeLessThan(markOf(before, REPO_ID).x);
    const lens = markOf(scene, ids.analyzer(preset));
    expect(lens.x).toBeLessThan(markOf(before, ids.analyzer(preset)).x);
    expect(lens.alpha).toBe(1);
    const other = scene.marks.find(
      (m) => m.id.startsWith('analyzer:') && m.id !== lens.id,
    )!;
    expect(other.alpha).toBeLessThan(0.5);
    const fanned = scene.marks.filter((m) => m.parent === lens.id);
    // Same ids as the ring's fan and the lens's own view.
    expect(fanned.map((m) => m.id)).toEqual(previewing.lens.entities.map((e) => e.id));
    for (const m of fanned) expect(m.x).toBeGreaterThan(lens.x);
  });

  it('ignores a previewed lens outside the open view', () => {
    const scene = fanScene(
      repo,
      readings,
      { view: 'structure', lens: previewing.lens },
      viewport,
    );
    expect(scene.marks.some((m) => m.parent === ids.analyzer(preset))).toBe(false);
  });

  it('gives views, lenses and fanned entities tooltips', () => {
    const scene = fanScene(repo, readings, previewing, viewport);
    expect(markOf(scene, ids.view('code-health')).tip?.[0]).toBe('Code Health');
    expect(markOf(scene, ids.analyzer(preset)).tip?.length).toBeGreaterThan(1);
    for (const e of previewing.lens.entities)
      expect(markOf(scene, e.id).tip).toEqual([e.label, e.value]);
  });

  it('is deterministic', () => {
    expect(fanScene(repo, readings, previewing, viewport)).toEqual(
      fanScene(repo, readings, previewing, viewport),
    );
  });
});
```

- [ ] **Step 2: Run, expect failure** (module not found):
`pnpm --filter @gitrelic/scene exec vitest run src/layouts/fan.test.ts`

- [ ] **Step 3: Implement** `fan.ts`:

```ts
// The Overview fan (docs/atlas-views.md › Overview), the view's landing form:
// the repo, the four other views as nodes headed by their loudest lens, and
// the open view's lenses on an arc. Previewing a lens slides the picture left
// and fans that lens's top entities out of it, exactly as the ring does and
// with the same ids, so either form previews a lens the same way.

import { PRESET_GROUPS } from '../catalog';
import { ids, REPO_ID } from '../ids';
import type { Link, Mark, Scene, Viewport } from '../model';
import type { LensReading, RepoReading } from '../overview/readings';
import type { FannedEntity } from '../overview/topEntities';
import { FAN_VIEWS, viewHeadline, type FanView } from '../overview/viewHeadlines';
import {
  DOT_R,
  fanOut,
  LABEL_CLASS,
  labelledBounds,
  RAMP,
  ZERO,
} from './overviewParts';

export interface FanFocus {
  /** The view whose lenses are on the arc. */
  view: FanView;
  /** The lens being previewed and what it fans out, or null. */
  lens: { preset: string; entities: readonly FannedEntity[] } | null;
}

/** Smaller than the ring's centre: here the repo is a root, not a hub. */
const REPO_R = 72;
/** The repo while a lens is previewed: smaller, at the edge. */
const REPO_R_TUCKED = 44;
/** How far the open view's node outgrows the others. */
const OPEN_R = 3;
/** Lenses not previewed: below the labels' cutoff, as on the ring. */
const DIM_LENS = 0.3;
/** Other views while a lens is previewed: still labelled. */
const DIM_VIEW = 0.5;
const MAX_SPAN = (140 * Math.PI) / 180;
const SPAN_PER_LENS = (26 * Math.PI) / 180;

const labelOf = (view: FanView) =>
  PRESET_GROUPS.find((g) => g.id === view)?.label ?? view;

export function fanScene(
  repo: RepoReading,
  readings: readonly LensReading[],
  focus: FanFocus,
  viewport: Viewport,
): Scene {
  const { width: w, height: h } = viewport;
  const cy = h / 2;
  const marks: Mark[] = [];
  const links: Link[] = [];
  const lenses = readings.filter((r) => r.group === focus.view);
  const previewed = focus.lens
    ? lenses.find((r) => r.preset === focus.lens!.preset)
    : undefined;
  // Previewing slides everything left to make room for the lens's fan.
  const shift = previewed ? -w * 0.17 : 0;

  marks.push({
    id: REPO_ID,
    shape: 'outline',
    paint: '--accent',
    x: previewed ? w * 0.06 : w * 0.11,
    y: cy,
    r: previewed ? REPO_R_TUCKED : REPO_R,
    ...ZERO,
    alpha: previewed ? 0.5 : 1,
    label: repo.label,
    labelSub: repo.sub,
    labelClass: 'atlas-label--repo',
    labelPriority: 100,
    labelAnchor: 'center',
    z: 1,
  });

  // The views in rail order, a column; each headed by its loudest lens.
  const viewX = w * 0.36 + shift;
  const gap = h * 0.15;
  FAN_VIEWS.forEach((view, i) => {
    const id = ids.view(view);
    const head = viewHeadline(view, readings);
    const grade = head?.grade ?? 0;
    const open = view === focus.view;
    marks.push({
      id,
      shape: 'dot',
      paint: RAMP[grade],
      x: viewX,
      y: cy + (i - (FAN_VIEWS.length - 1) / 2) * gap,
      r: DOT_R[grade] + (open ? OPEN_R : 0),
      ...ZERO,
      alpha: previewed && !open ? DIM_VIEW : 1,
      label: labelOf(view),
      labelSub: head?.value,
      labelClass: LABEL_CLASS[grade],
      labelPriority: 60 + grade,
      // Above: trunks arrive from the left and branches leave to the right.
      labelAnchor: 'above',
      z: 2,
      tip: [
        labelOf(view),
        ...(head ? [`${head.label}: ${head.value}`] : []),
        ...(head?.reason ? [head.reason] : []),
      ],
    });
    links.push({
      id: `trunk:${view}`,
      source: REPO_ID,
      target: id,
      curve: 'straight',
      width: open ? 1.5 : 1,
      paint: open ? '--link-hot' : '--link',
      alpha: open ? 0.6 : 0.35,
    });
  });

  // The open view's lenses on an arc to its right, centred on the stage's
  // middle rather than on the view, so a view at the bottom keeps its lenses
  // on screen.
  const source = ids.view(focus.view);
  const radius = h * 0.36;
  const span = Math.min(MAX_SPAN, SPAN_PER_LENS * Math.max(lenses.length - 1, 0));
  lenses.forEach((lens, i) => {
    const t = lenses.length === 1 ? 0 : i / (lenses.length - 1) - 0.5;
    const x = viewX + radius * Math.cos(t * span);
    const y = cy + radius * Math.sin(t * span);
    const id = ids.analyzer(lens.preset);
    const isPreviewed = lens === previewed;
    const dim = previewed && !isPreviewed ? DIM_LENS : 1;
    marks.push({
      id,
      shape: 'dot',
      paint: RAMP[lens.grade],
      x,
      y,
      r: DOT_R[lens.grade],
      ...ZERO,
      alpha: dim,
      // Grows out of its view, and folds back into it when another opens.
      parent: source,
      foldOnExit: true,
      label: lens.label,
      labelSub: lens.value,
      labelClass: LABEL_CLASS[lens.grade],
      labelPriority: lens.grade * 10 + (isPreviewed ? 50 : 0),
      // The previewed lens's fan spreads to the right; its label goes under.
      labelAnchor: isPreviewed ? 'below' : 'right',
      z: lens.grade,
      tip: [lens.label, lens.value, ...(lens.reason ? [lens.reason] : [])],
    });
    links.push({
      id: `branch:${lens.preset}`,
      source,
      target: id,
      curve: 'arc',
      width: lens.grade >= 2 ? 1.5 : 1,
      paint: lens.grade >= 2 ? '--link-hot' : '--link',
      alpha: (lens.grade >= 2 ? 0.6 : 0.35) * dim,
    });
    if (isPreviewed && focus.lens!.entities.length > 0) {
      const fan = fanOut(lens.preset, x, y, 0, h * 0.26, focus.lens!.entities);
      marks.push(...fan.marks);
      links.push(...fan.links);
    }
  });

  return { marks, links, guides: [], bounds: labelledBounds(marks) };
}
```

- [ ] **Step 4: Run, expect PASS.** Same command. If `checkScene` reports a mark outside bounds, the label room is fine but check that `labelledBounds` is used, not a hand-rolled box.

- [ ] **Step 5: Commit**

```bash
git add packages/scene/src/layouts/fan.ts packages/scene/src/layouts/fan.test.ts
git commit -m "feat(scene): the Overview fan layout"
```

---

### Task 7: Fan becomes Overview's primary form

**Files:**
- Modify: `packages/scene/src/views/overview.ts`, `packages/scene/src/index.ts`
- Test: `packages/scene/src/views/views.test.ts`

- [ ] **Step 1: Write the failing tests.** In `views.test.ts`, change the `overview ring` block's first line to find the ring by id (it is no longer `layouts[0]`):

```ts
  const ring = VIEWS.get('overview')!.layouts.find((l) => l.id === 'ring')!;
```

and add a block after it:

```ts
describe('overview fan', () => {
  const overview = VIEWS.get('overview')!;
  const fan = overview.layouts[0];
  const index = buildEntityIndex(report);
  const build = (focus: string | null) =>
    fan.build({ report, commits: null, focus, index }, viewport);
  const openLenses = (scene: ReturnType<typeof build>) =>
    scene.marks.filter((m) => m.id.startsWith('analyzer:')).map((m) => m.id);

  it('is the primary form, with the ring as its alternate', () => {
    expect(overview.layouts.map((l) => l.id)).toEqual(['fan', 'ring']);
    expect(fan.focusKinds).toContain('view');
  });

  it('opens the loudest view by default, or the one named by focus', () => {
    const readings = lensReadings(report);
    const loudest = loudestView(readings);
    const ofView = (v: string) =>
      readings.filter((r) => r.group === v).map((r) => ids.analyzer(r.preset));
    expect(openLenses(build(null))).toEqual(ofView(loudest));
    expect(openLenses(build(ids.view('structure')))).toEqual(ofView('structure'));
    // A lens opens its own view.
    expect(openLenses(build(ids.analyzer('bus-factor')))).toEqual(
      ofView('ownership-risk'),
    );
  });

  it('falls back to the loudest view for a focus it does not draw', () => {
    const loudest = build(null);
    expect(openLenses(build(ids.view('overview')))).toEqual(openLenses(loudest));
    expect(openLenses(build(ids.file('src/api.ts')))).toEqual(openLenses(loudest));
  });

  it('previews a focused lens with its fan', () => {
    const scene = build(ids.analyzer('hotspots'));
    expect(scene.marks.some((m) => m.parent === ids.analyzer('hotspots'))).toBe(
      lensTopEntities('hotspots', report, index).length > 0,
    );
  });
});
```

Add the imports the block needs at the top of `views.test.ts` (whichever aren't there): `lensReadings` from `'../overview/readings'`, `lensTopEntities` from `'../overview/topEntities'`, `loudestView` from `'../overview/viewHeadlines'`.

- [ ] **Step 2: Run, expect failure** (`['ring']` vs `['fan','ring']`):
`pnpm --filter @gitrelic/scene exec vitest run src/views/views.test.ts`

- [ ] **Step 3: Implement** `views/overview.ts` (whole file):

```ts
// The Overview view: one lens (Repo map) drawn as the fan (primary) or the
// ring. Both are driven by `input.focus`, which the shell keeps: a `view:` id
// opens that view's fan, an `analyzer:` id previews that lens (and, on the
// fan, opens its view), and the shell keeps it while one of the previewed
// lens's own entities is selected.

import { isPresetGroup } from '../catalog';
import { buildEntityIndex } from '../entities';
import { entityKey, entityKind, type EntityKind } from '../ids';
import { fanScene } from '../layouts/fan';
import { ringScene } from '../layouts/ring';
import { lensReadings, repoReading, type LensReading } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { FAN_VIEWS, loudestView, type FanView } from '../overview/viewHeadlines';
import type { AnalyzerView, Layout, ViewInput } from '../model';

const FOCUS_KINDS: readonly EntityKind[] = ['view', 'analyzer', 'file', 'dir', 'person'];

/** The lens `focus` previews, with what it fans out, if it names one. */
function previewOf(input: ViewInput, readings: readonly LensReading[]) {
  const focus = input.focus;
  if (!focus || entityKind(focus) !== 'analyzer') return null;
  const reading = readings.find((r) => r.preset === entityKey(focus));
  if (!reading) return null;
  return {
    reading,
    entities: lensTopEntities(
      reading.preset,
      input.report,
      input.index ?? buildEntityIndex(input.report),
    ),
  };
}

const isFanView = (id: string): id is FanView =>
  isPresetGroup(id) && (FAN_VIEWS as readonly string[]).includes(id);

export const fanLayout: Layout = {
  id: 'fan',
  label: 'Fan',
  // The shell's fan focus: a view, a lens, and the entities it fans out.
  focusKinds: FOCUS_KINDS,
  needsCommits: false,
  build: (input, viewport) => {
    const readings = lensReadings(input.report);
    const preview = previewOf(input, readings);
    const named =
      input.focus && entityKind(input.focus) === 'view'
        ? entityKey(input.focus)
        : (preview?.reading.group ?? '');
    const view = isFanView(named) ? named : loudestView(readings);
    return fanScene(
      repoReading(input.report),
      readings,
      {
        view,
        lens: preview
          ? { preset: preview.reading.preset, entities: preview.entities }
          : null,
      },
      viewport,
    );
  },
};

export const ringLayout: Layout = {
  id: 'ring',
  label: 'Ring',
  focusKinds: FOCUS_KINDS,
  needsCommits: false,
  build: (input, viewport) => {
    const readings = lensReadings(input.report);
    const preview = previewOf(input, readings);
    return ringScene(
      repoReading(input.report),
      readings,
      preview
        ? { preset: preview.reading.preset, entities: preview.entities }
        : null,
      viewport,
    );
  },
};

export const overviewView: AnalyzerView = {
  id: 'overview',
  layouts: [fanLayout, ringLayout],
  findings: () => [],
};
```

In `index.ts`, replace

```ts
export { overviewView, ringLayout } from './views/overview';
```

with

```ts
export { fanLayout, overviewView, ringLayout } from './views/overview';
export {
  FAN_VIEWS,
  loudestView,
  VIEW_BLURBS,
  viewHeadline,
  type FanView,
} from './overview/viewHeadlines';
```

- [ ] **Step 4: Run, expect PASS**, then the whole scene suite, typecheck and lint:

```bash
pnpm --filter @gitrelic/scene exec vitest run src/views/views.test.ts
pnpm --filter @gitrelic/scene test
pnpm --filter @gitrelic/scene exec tsc --noEmit
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add packages/scene/src/views/overview.ts packages/scene/src/views/views.test.ts packages/scene/src/index.ts
git commit -m "feat(scene): Overview lands on the fan; the ring becomes its alternate"
```

---

### Task 8: The shell's fan focus accepts views

**Files:**
- Modify: `apps/atlas/src/lib/views/fanFocus.ts`, `apps/atlas/src/lib/shell/Shell.svelte:112-121`
- Test: `apps/atlas/src/lib/views/fanFocus.test.ts`, `apps/atlas/src/lib/views/palettePick.test.ts`

- [ ] **Step 1: Write the failing tests.** In `fanFocus.test.ts` add:

```ts
  it('opens a selected view, and moves between views and lenses', () => {
    const structure = ids.view('structure');
    expect(nextFanFocus(null, structure, report, index)).toBe(structure);
    expect(nextFanFocus(structure, hotspots, report, index)).toBe(hotspots);
    expect(nextFanFocus(hotspots, structure, report, index)).toBe(structure);
  });

  it('closes a view for an entity, which only a lens fan can hold', () => {
    const [first] = lensTopEntities('hotspots', report, index);
    expect(
      nextFanFocus(ids.view('code-health'), first.id, report, index),
    ).toBeNull();
  });
```

In `palettePick.test.ts` add to "selects files and people" (or a new `it`):

```ts
    // A view is selected: on Overview the fan opens it.
    expect(palettePick(ids.view('structure'))).toBeNull();
```

- [ ] **Step 2: Run, expect failure** (the view cases return null):
`pnpm --filter @gitrelic/atlas exec vitest run src/lib/views/fanFocus.test.ts src/lib/views/palettePick.test.ts`
(`palettePick` already passes; that test pins the behaviour.)

- [ ] **Step 3: Implement** `fanFocus.ts` (whole file):

```ts
// What the Overview fans. Selecting a view opens its fan; selecting a lens
// previews it (on the fan, inside its own view); selecting one of the
// previewed lens's entities keeps that preview (so the inspector can describe
// the file without the fan collapsing under it); anything else closes it,
// back to the loudest view.

import {
  entityKind,
  lensTopEntities,
  entityKey,
  type EntityId,
  type EntityIndex,
} from '@gitrelic/scene';

import type { GitrelicReport } from '@gitrelic/core';

export function nextFanFocus(
  previous: EntityId | null,
  selection: EntityId | null,
  report: GitrelicReport,
  index: EntityIndex,
): EntityId | null {
  if (!selection) return null;
  const kind = entityKind(selection);
  if (kind === 'analyzer' || kind === 'view') return selection;
  if (!previous || entityKind(previous) !== 'analyzer') return null;
  const fanned = lensTopEntities(entityKey(previous), report, index);
  return fanned.some((e) => e.id === selection) ? previous : null;
}
```

In `Shell.svelte`, rename the local `onRing` to `onOverview` and its comment to "Only while the Overview is open; a lens picked elsewhere doesn't leave a fan waiting for the next visit." Also change the `layoutFocus` comment's first line from "The ring fans its focused lens;" to "The Overview fans its focus (a view or a lens);".

- [ ] **Step 4: Run, expect PASS.** Same command, then `pnpm --filter @gitrelic/atlas typecheck`.

- [ ] **Step 5: Commit**

```bash
git add apps/atlas/src/lib/views/fanFocus.ts apps/atlas/src/lib/views/fanFocus.test.ts apps/atlas/src/lib/views/palettePick.test.ts apps/atlas/src/lib/shell/Shell.svelte
git commit -m "feat(atlas): the Overview's fan focus opens views"
```

---

### Task 9: The inspector's view card

**Files:**
- Create: `apps/atlas/src/lib/inspector/ViewCard.svelte`
- Modify: `apps/atlas/src/lib/shell/Inspector.svelte`
- Test: `apps/atlas/src/lib/shell/Inspector.test.ts`

- [ ] **Step 1: Write the failing test** in `Inspector.test.ts`:

```ts
  it('describes a selected view: its headline, its lenses loudest first, and a way in', async () => {
    const onselect = vi.fn();
    const onopen = vi.fn();
    render(Inspector, {
      ...base,
      lens: 'overview',
      selection: ids.view('code-health'),
      onselect,
      onopen,
    });
    expect(screen.getByRole('heading', { name: 'Code Health' })).toBeTruthy();
    expect(screen.getByText(/under strain/)).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Lenses, loudest first' }),
    ).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /^Hotspots/ }));
    expect(onselect).toHaveBeenCalledWith('analyzer:hotspots');
    await fireEvent.click(
      screen.getByRole('button', { name: 'Open Code Health' }),
    );
    expect(onopen).toHaveBeenCalledWith('hotspots');
  });
```

(Card eyebrows render as headings: the existing "On the ring" assertion relies on that.)

- [ ] **Step 2: Run, expect failure:**
`pnpm --filter @gitrelic/atlas exec vitest run src/lib/shell/Inspector.test.ts`

- [ ] **Step 3: Implement** `ViewCard.svelte`:

```svelte
<script lang="ts">
  import {
    defaultLens,
    ids,
    lensReadings,
    PRESET_GROUPS,
    VIEW_BLURBS,
    viewHeadline,
    type EntityId,
    type FanView,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    view,
    report,
    onselect,
    onopen,
  }: {
    view: FanView;
    report: GitrelicReport;
    /** Selecting a lens previews it on the Overview. */
    onselect?: (id: EntityId) => void;
    /** Opens a lens that has an Atlas view. */
    onopen?: (lens: string) => void;
  } = $props();

  let label = $derived(PRESET_GROUPS.find((g) => g.id === view)?.label ?? view);
  let readings = $derived(lensReadings(report).filter((r) => r.group === view));
  let headline = $derived(viewHeadline(view, readings));
  // Loudest first; the sort is stable, so equals keep lens-bar order.
  let ranked = $derived([...readings].sort((a, b) => b.grade - a.grade));
  let lens = $derived(defaultLens(view));
</script>

<Card eyebrow={label}>
  {#if headline}
    <div class="flex items-baseline gap-2.5">
      <span
        class="text-[22px] font-semibold {headline.grade >= 2
          ? 'text-accent'
          : ''}">{headline.value}</span
      >
      <span class="text-[14px] text-soft">{headline.label}</span>
    </div>
  {/if}
  <p class="m-0 text-[15px] leading-relaxed">{VIEW_BLURBS[view]}</p>
  {#if lens}
    <button
      type="button"
      onclick={() => onopen?.(lens)}
      class="h-10 cursor-pointer rounded-chip border border-accent bg-transparent font-[inherit] text-[14px] text-accent"
      >Open {label}</button
    >
  {/if}
</Card>

<Card eyebrow="Lenses, loudest first">
  <ul class="m-0 flex list-none flex-col p-0">
    {#each ranked as r (r.preset)}
      <li class="border-t border-panel-border first:border-t-0">
        <button
          type="button"
          title={r.reason}
          onclick={() => onselect?.(ids.analyzer(r.preset))}
          class="grid w-full cursor-pointer grid-cols-[1fr_auto] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
        >
          <span>{r.label}</span>
          <span
            class="font-mono text-[13px] {r.grade >= 2
              ? 'text-risk-3'
              : 'text-soft'}">{r.value}</span
          >
        </button>
      </li>
    {/each}
  </ul>
</Card>
```

In `Inspector.svelte`:
- add `isPresetGroup` to the `@gitrelic/scene` import (and `FAN_VIEWS`), and `import ViewCard from '../inspector/ViewCard.svelte';` in alphabetical position after `RiskCard`;
- add a derived after `analyzer`:

```ts
  let selectedView = $derived(
    kind === 'view' && (FAN_VIEWS as readonly string[]).includes(key)
      ? (key as (typeof FAN_VIEWS)[number])
      : undefined,
  );
```

(drop `isPresetGroup` from the import if this form doesn't need it);
- add a branch right before `{:else if analyzer}`:

```svelte
  {:else if selectedView}
    <ViewCard view={selectedView} {report} {onselect} {onopen} />
```

- [ ] **Step 4: Run, expect PASS.** Same command.

- [ ] **Step 5: Commit**

```bash
git add apps/atlas/src/lib/inspector/ViewCard.svelte apps/atlas/src/lib/shell/Inspector.svelte apps/atlas/src/lib/shell/Inspector.test.ts
git commit -m "feat(atlas): the inspector describes a selected view"
```

---

### Task 10: Form-neutral copy; one notion of "loudest view"

**Files:**
- Modify: `apps/atlas/src/lib/inspector/LensPreviewCard.svelte`, `apps/atlas/src/lib/inspector/RepoMapCard.svelte`, `apps/atlas/src/lib/shell/Inspector.svelte:261`
- Test: `apps/atlas/src/lib/shell/Inspector.test.ts`

- [ ] **Step 1: Update the tests first.** In `Inspector.test.ts`, the lens preview test: change `'On the ring'` to `'On the map'`. Add to the "nothing selected on Overview" test that already checks `'Loudest signals'` (the one ending with the Ghost Files click), before its click:

```ts
    expect(screen.getByText(/Click a view or a lens/)).toBeTruthy();
```

(If that test renders a report where no lens is loud, assert `/Click any view or lens/` instead; read the test's setup.)

- [ ] **Step 2: Run, expect failure:** `pnpm --filter @gitrelic/atlas exec vitest run src/lib/shell/Inspector.test.ts`

- [ ] **Step 3: Implement.**

`LensPreviewCard.svelte`: rename the prop `onRing` → `onMap` (declaration, type, doc comment "The Overview is showing, so a second click on the lens opens it."), the eyebrow `"On the ring"` → `"On the map"`, the `{#if onRing && entry.atlas}` → `{#if onMap && entry.atlas}`, and the hint text to `Or click the lens again.`

`Inspector.svelte:261`: `onRing={lens === 'overview'}` → `onMap={lens === 'overview'}`.

`RepoMapCard.svelte`: import `loudestView` from `@gitrelic/scene`, replace the `loudestView` derived block with

```ts
  // The view the fan opens on, named only when something is loud.
  let loudestLabel = $derived.by(() => {
    if (loud.length === 0) return undefined;
    const view = loudestView(readings);
    return PRESET_GROUPS.find((g) => g.id === view)?.label;
  });
```

rename its uses in the markup to `loudestLabel`, change the prop doc to "Selecting a lens previews it on the Overview.", and the two sentences to:

```svelte
      The loudest view is <span class="text-accent">{loudestLabel}</span>.
      Click a view or a lens to see what it points at.
```

```svelte
      No lens reads outside normal for a repo this size. Click any view or
      lens to see what it points at.
```

- [ ] **Step 4: Run, expect PASS**, then the atlas suite: `pnpm --filter @gitrelic/atlas test`.

- [ ] **Step 5: Commit**

```bash
git add apps/atlas/src/lib/inspector/LensPreviewCard.svelte apps/atlas/src/lib/inspector/RepoMapCard.svelte apps/atlas/src/lib/shell/Inspector.svelte apps/atlas/src/lib/shell/Inspector.test.ts
git commit -m "feat(atlas): Overview inspector copy fits both forms"
```

---

### Task 11: See it on React

No test: this is the visual check the checkpoint asks for. One screenshot per visual change (the context-economy rule).

- [ ] **Step 1:** `pnpm build` (core must be built for a live dev analysis; wrap in the watchdog if tsdown hangs: `perl -e 'alarm shift; exec @ARGV' 600 pnpm build`).
- [ ] **Step 2:** `GITRELIC_DEV_REPO=~/Documents/code/react pnpm --filter @gitrelic/atlas dev` (port 7778; if Dan's server is already running from the main checkout on this branch, use his).
- [ ] **Step 3:** Check, at 1440×900: landing opens Code Health with Risk/Fix rate hot; clicking Ownership & Risk re-fans; clicking Bus Factor slides left and fans its files; clicking it again opens Bus Factor; Back returns to the preview, then the fan; the corner toggle morphs Fan ↔ Ring (view nodes travel into the Ring's sector labels); `#s=view:structure` reloads onto Structure; Team & Activity's node is grey.
- [ ] **Step 4:** Take one screenshot of the landing and one of a preview; fix overlaps by adjusting `fan.ts` constants (`gap`, `radius`, shift), re-running `src/layouts/fan.test.ts` after each change.
- [ ] **Step 5:** Commit any tuning: `git commit -am "fix(scene): fan spacing on a real repo"`.

---

### Task 12: Docs as built

**Files:**
- Modify: `docs/atlas-views.md` (Overview section), `CLAUDE.md` (scene model + lens table)

- [ ] **Step 1:** In `docs/atlas-views.md` › Overview › Primary form — Fan, change the **View cards** bullet to describe what shipped: "**View nodes** (`view:<group>` marks…): a dot sized and heated by the view's loudest lens, labelled above with the view's name over that lens's reading; the lens's name is in the tooltip and the inspector. (Board D drew boxes; the canvas draws no card bodies, so a box is a renderer feature of its own.)" Then add an **As built (RELIC-361)** list after the Fan block:
  - `layouts/fan.ts` `fanScene`; `overview/viewHeadlines.ts` (`viewHeadline`, `loudestView`, `VIEW_BLURBS`); the shared lens ramp, fan-out and bounds in `layouts/overviewParts.ts`.
  - Views are indexed (`kind: 'view'`), rank first in ⌘K, and picking one selects it.
  - `nextFanFocus` keeps a `view:` or `analyzer:` focus; an entity keeps only a lens preview.
  - The inspector's `ViewCard`: headline, blurb, Open (the view's default lens), lenses loudest first.
  - `RepoMapCard` names the loudest view by `loudestView`, the same one the fan opens.
- [ ] **Step 2:** In `CLAUDE.md`: add `` `view:` `` to the scene model's entity-id list (after `` `analyzer:` ``), and change the lens table's Repo map row to `| Repo map | \`views/overview.ts\` | \`fan\`, \`ring\` | \`overview/readings.ts\`, \`overview/topEntities.ts\`, \`overview/viewHeadlines.ts\` |`.
- [ ] **Step 3:** `pnpm format:check` (fix with `pnpm format`), then the full `pnpm test`.
- [ ] **Step 4: Commit**

```bash
git add docs/atlas-views.md CLAUDE.md
git commit -m "docs: Overview's fan as built (RELIC-361)"
```

- [ ] **Step 5:** Run the **monorepo-architect** agent over the branch (it touches scene and atlas), then hand to Dan for the PR.
