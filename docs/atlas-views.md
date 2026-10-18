# Atlas Views

> **Scope:** design decisions for the Atlas dashboard (`apps/atlas` + `packages/scene`). Each view's design checkpoint records its outcome here *before* it is built. `docs/polish-pattern.md` is input to those checkpoints — what each analyzer must communicate — not a spec for Atlas.

## How to use this doc

- **Read it before building or changing any Atlas view.** The navigation shape and the alternate-forms rules below apply to every view.
- **A design checkpoint ends with an entry here.** Add a section under [Views](#views) with what was decided and why, then build. When the build proves a decision wrong, fix this doc first.
- **The [decision log](#decision-log) is append-only.** Reversing a decision means a new entry that says so, not editing the old one.

---

## Navigation: five group views, one row of lenses

Classic has one page per analyzer and a sidebar listing all 23 of them. Atlas doesn't copy that. Its navigation has three levels, and only one of them is tabs.

| Level | What it is | Where it lives |
|---|---|---|
| **View** | One of five groups: Overview, Code Health, Ownership & Risk, Team & Activity, Structure | The rail: five icons, always 56px, every icon a destination |
| **Lens** | One analyzer within the view (Hotspots, Churn, Cursed Files…) | A single lens bar across the top of the stage |
| **Form** | An alternate picture of the same lens (flow vs swimlanes) | A small toggle in the stage's corner, **only** when a checkpoint decided the lens needs one |

**Why lenses and not pages:** switching lens re-lays out the *same* entities — the same files, the same people — so marks morph from one lens to the next instead of the page reloading. That's what the scene model's entity ids and the transition planner exist for.

**Rules:**

- **One row of tabs, ever.** The lens bar is the only tab row. Alternate forms are never a second tab row (see [Alternate forms](#alternate-forms)).
- **Nothing becomes unreachable.** A lens without an Atlas view yet still appears in the lens bar, marked ↗, and opens classic at `/classic/#preset=<id>`.
- **Other ways in stay:** the Overview canvas (analyzer cards), ⌘K (an empty query lists every analyzer), and the inspector's "Flagged by" links. The rail and lens bar are the discoverable path, not the only one.
- **Badges roll up.** A lens shows its outlier badge in the lens bar; its view's rail icon shows a dot when any of its lenses has one (`computeOutlierBadges`, thresholds in scene `badges.ts` `RULES`).

**Which analyzers are lenses of which view** starts as the catalog's groups (scene `catalog.ts` `PRESET_GROUPS`). A checkpoint may move an analyzer, merge two into one lens, or retire one; record it here and update the catalog.

## Alternate forms

Classic gives many analyzers extra hero tabs — *sunburst*, *trend*, *distribution*, *leaderboard*. Almost all of them answer one of three questions. Atlas answers those in shared places that every lens has, instead of per-analyzer tabs:

| Classic alt tab | The question | Atlas answer |
|---|---|---|
| Trend, by month, growth timeline, stress trend, AI adoption | *When?* | The **time strip** along the bottom of the stage: one control for every lens; scrubbing it updates the marks |
| Distribution, histogram, tier mix | *How many, and how spread?* | A distribution chart in the **inspector**, for the active lens |
| Leaderboard, top-N, sortable list | *Exactly which ones?* | The **detail table** (collapsed, sortable) under the inspector |

What's left is the occasional genuinely different picture of the same data — Contributors as a flow versus as swimlanes. That is a **form**.

### The forms pattern

Keep it available; use it sparingly.

- **Model:** an `AnalyzerView` (scene `model.ts`) has `layouts: [primary, ...alternates]`. Each `Layout` is a pure `build(input, viewport) → Scene`. A lens with one layout has no toggle.
- **UI:** with two or more layouts, a compact toggle sits in a corner of the stage (icon buttons with labels, `aria-pressed`), like a map's map/satellite switch. It is never a tab row, and it never moves the lens bar.
- **Motion:** forms share entity ids, so switching form morphs marks between the two layouts like switching lens does. Cross-layout id stability is part of every layout's tests.
- **URL:** the form is in the hash (below), so a shared link reopens it.
- **The checkpoint test:** before adding a form, ask whether the time strip, inspector chart or detail table already answers its question. Add the form only if it shows something none of them can — usually a different *structure* (flow vs lanes, radial vs linear), not a different *aggregation*.

## URL state

The hash holds what a shared link should reopen. Every field is validated on read (`Nav`, `nav.svelte.ts`): anything unknown is dropped, never rendered.

| Key | Meaning | Example |
|---|---|---|
| `v` | View (group) | `code-health` |
| `l` | Lens (analyzer) within the view | `hotspots` |
| `f` | Form, when the lens has alternates | `swimlanes` |
| `s` | Selected entity id, resolved through the entity index | `file:src/api.ts` |
| `t` | Time-strip position or range | `2026-03` |

Theme is a viewer preference and stays in localStorage, not the URL.

> As built in PR 3.1, `v` holds an analyzer id and `l` a layout. Moving to view/lens/form is part of the navigation change below.

## What this changes in the build

- **Rail** (`Rail.svelte`): from the 23-item catalog list to five view destinations with badge dots. The expanded 240px state goes away.
- **Lens bar** (new): the active view's analyzers, with badges and classic ↗ for those without a lens yet.
- **Time strip** (new, shared): shell work that lands with the first views (PR 3.2), not inside each view.
- **Inspector:** gains the active lens's distribution chart; the detail table is already built.
- **Catalog:** gains the view → lens mapping if a checkpoint diverges from `PRESET_GROUPS`.
- **Kept as is:** catalog, badges, entity index, ⌘K palette, inspector cards, `AnalyzerView` / `Layout` model.

---

## Views

One section per view, added at its design checkpoint. Each records:

- the lenses it holds, in order;
- for each lens: what it must communicate (from `docs/polish-pattern.md`), the chosen form, and any alternate forms with the reason they passed the checkpoint test;
- its findings (the one-line takeaways the inspector shows);
- what classic showed that Atlas deliberately drops, and why.

*None yet. The first checkpoint (PR 3.2) covers Overview and the first Code Health lenses.*

---

## Decision log

- **2026-10-17 — Navigation is five views with one lens row.** The rail lists five group views, each view has a single lens bar of its analyzers, and alternate pictures are corner-toggle forms rather than a second tab row. Replaces classic's 23-item sidebar, which PR 3.1 had ported as-is. *Why:* a 23-item list duplicates the Overview canvas and ⌘K, costs 240px, and its collapsed state navigated nowhere; lenses let marks morph between analyzers of the same entities.
- **2026-10-17 — Trend, distribution and leaderboard are shared, not per-analyzer.** The time strip, the inspector's distribution chart and the detail table answer them for every lens. An alternate form must show something none of those can.
- **2026-10-17 — The forms pattern stays available.** `AnalyzerView.layouts` and the corner toggle are supported for lenses that need a second structure (e.g. Contributors flow vs swimlanes), used sparingly.
