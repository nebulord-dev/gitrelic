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
| Leaderboard, top-N, sortable list | *Exactly which ones?* | The **detail table**: a sortable, full-width drawer over the stage (`T`) |

What's left is the occasional genuinely different picture of the same data — Contributors as a flow versus as swimlanes. That is a **form**.

### The forms pattern

Keep it available; use it sparingly.

- **Model:** an `AnalyzerView` (scene `model.ts`) has `layouts: [primary, ...alternates]`. Each `Layout` is a pure `build(input, viewport) → Scene`. A lens with one layout has no toggle.
- **UI:** with two or more layouts, a compact toggle sits in a corner of the stage (icon buttons with labels, `aria-pressed`), like a map's map/satellite switch. It is never a tab row, and it never moves the lens bar.
- **Motion:** forms share entity ids, so switching form morphs marks between the two layouts like switching lens does. Cross-layout id stability is part of every layout's tests.
- **URL:** the form is in the hash (below), so a shared link reopens it.
- **The checkpoint test:** before adding a form, ask whether the time strip, inspector chart or detail table already answers its question. Add the form only if it shows something none of them can — usually a different *structure* (flow vs lanes, radial vs linear), not a different *aggregation*.

## The inspector (right sidebar)

Decided at the 3.2 checkpoint (2026-10-18). It is one scrolling column, never a second row of tabs: classic's Inspector / Contributors / Activity tabs become sections with jump links at the top.

- **Two modes.**
  - **Nothing selected (lens mode)** describes the open lens. It shows what the lens measures (one sentence), an expandable *how to read it* note, **Docs ↗** and **Classic ↗**, then the headline number with its finding, the distribution chart, the top five and *Open the table*.
  - **Something selected** describes that entity:
    - identity, chips and score;
    - **What to do**;
    - **Flagged by**: every lens that sees it, with its value there; each row opens that lens with the entity still selected;
    - People;
    - Activity: the weeks it changed, recent commits and shame;
    - Changes with;
    - Docs and classic links.
- **What to do** comes from rules on the signals, not a model. It is a scene table, like the badge rules, with each action keyed to signal combinations from the analyzers' docs (`cursed-files.md` "What action it suggests" is the seed). Every action states the evidence behind it and links to the section that shows it. At most a few actions, and the section is absent when no rule applies.
- **Explaining every lens is a pattern, not per-view work.** Each lens has:
  - a one-line caption on the stage, with *How to read* and **Docs ↗** in a corner;
  - the measure sentence and *how to read it* note in lens mode;
  - an entry in the Guide.
  A lens doesn't ship without its docs page.
- **The Guide** is a sheet on demand (`?`), not a permanent panel. The current lens is pinned at the top with how to read it and its caveats; below it every analyzer is grouped by view, with search and a Docs link each. It reads the catalog's `explain` text, so the Guide, the inspector and ⌘K say the same thing.
- **The detail table** is a full-width drawer over the bottom of the stage (`T`), not a card in the inspector. It has a filter, tier toggles and sortable columns. Hovering a row lights its mark and clicking selects it; the stage stays live above.
- **Width and collapse.** 400px docked (the extra width is for long names). `I` collapses it to a 52px strip that keeps the selection's score in view, with icons that reopen it at a section. The choice is remembered per viewer in the browser. Below 1200px it stays a drawer.
- **Long names wrap; the inspector never truncates.**
  - File names break at hyphens and dots.
  - Folder paths break only after a slash.
  - People's names wrap at spaces.
  - Only dense lists (the table, the top five) cut with an ellipsis, and they show the full name on hover.
- **Hover never changes the inspector.** Hovering a mark shows a small tooltip by the mark; the inspector changes only on select.
- **Not carried over:** classic's Narrative tab (the Finding card covers it), and the mock's "Ask about this repo" box (that's ⌘K).

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

> Defaults stay out of the URL: the Overview view and a view's default lens are omitted, so a fresh load has no hash. `t` is parsed and validated (`2026-03` or `2026-01..2026-03`) but nothing narrows to it yet; the first lens that reads a window wires up the strip's brush.

## What this changes in the build

Shipped in the navigation shell PR (the first of 3.2's three):

- **Rail** (`Rail.svelte`): five view destinations with badge dots that roll up their lenses'. The 23-item list and its 240px expanded state are gone.
- **Lens bar** (`LensBar.svelte`): the open view's analyzers, with badges and classic ↗ for those without an Atlas view. One row, scrolling sideways with a faded edge when it can't fit.
- **Time strip** (`TimeStrip.svelte`): commits per week across the window. It lights the selection's weeks.
- **Inspector:** lens mode and selection mode, Flagged by (scene `fileFacts` rows, each naming its lens), Activity, Changes with, the collapse strip (`I`), 400px and wrapped names (see [The inspector](#the-inspector-right-sidebar)).
- **Guide** (`GuideSheet.svelte`, `?`).

Still to come, with the first lens that fills them (the Hotspots PR): **What to do** (rules in scene) and the **table drawer** (`T`).
- **Catalog:** gains the view → lens mapping if a checkpoint diverges from `PRESET_GROUPS`.
- **Kept as is:** catalog, badges, entity index, ⌘K palette, inspector cards, `AnalyzerView` / `Layout` model.

### Open items for the views that need them

- **Selecting `cell:`, `week:` and `commit:` marks.** `Nav.select` drops any id the entity index doesn't hold, so today a click on one of those marks clears the selection. The first view that draws them (Commit Timing's clock, Contributors' strips) either adds them to the index or gets its own selection path, with an inspector card for the kind.
- **Palette cost on huge repos.** `rankEntities` scores every entry and keyword (full paths included) on each keystroke. Fine at this repo's size; if a large monorepo stutters, filter the previous results when the query extends the last one, or debounce.

---

## Views

One section per view, added at its design checkpoint.

**How a checkpoint runs, per analyzer:**
1. Review the classic version: its hero and alternates, its bottom-panel tab, its metrics, run on a real repo (React is the reference).
2. Read its docs page (`apps/docs/analyzers/<id>.md`) to understand what it computes and what it is meant to teach.
3. Discuss how to bring it into Atlas, using options on a design canvas (several directions, real data, the Flat theme; a Glow board is optional, since Glow is otherwise checked in the running app).
4. Record the outcome here, then build.

Each section records:

- the analyzer's docs page (`apps/docs/analyzers/<id>.md`) as input — and, once built, the page updated for the Atlas view, or written if it doesn't exist yet (only some analyzers have one);
- the lenses it holds, in order;
- for each lens: what it must communicate (from `docs/polish-pattern.md`), the chosen form, and any alternate forms with the reason they passed the checkpoint test;
- its findings (the one-line takeaways the inspector shows);
- what classic showed that Atlas deliberately drops, and why.

### Overview — Repo map (checkpoint 2026-10-18, PR 3.2)

**Input:** no docs page (dashboard-tier presets have none); `polish-pattern.md` has no Overview section. The original mock's fan (`Gitrelic UI Refactor/Claude's Demo/mockup 1.html`) and the 3.2 checkpoint canvas (six boards on React's last 12 months) were the reference.

**Lenses:** Repo map (new; the view's default), then Risk ↗ and Tech debt ↗ until they get checkpoints.

**Primary form — Ring.** The repo at the centre; every analyzer lens on an outer ellipse, grouped into the four other views (sector order: Code Health, Ownership & Risk, Team & Activity, Structure), sized and heated by how far its reading sits outside normal for a repo this size (the same outlier rules as the badges, graded 0–3). Outliers carry their number and name; quiet lenses stay small and grey. It answers "where is this repo unusual?" in one look and doubles as navigation to all ~20 lenses.

**The fan-out (the ring's click behaviour, not a form).** Clicking a lens dims the others and fans its top entities out of its dot on an arc, each labelled (e.g. Bus Factor's most at-risk files with their owners). A second click or Enter opens the lens: the view moves to it and those same marks fly to their places in the lens's layout, because they keep their entity ids. Back reverses it. The preview is the first frame of the real view. This replaces the mock's fan as a separate picture.

**Alternate form — Briefing.** A short list of findings across lenses; picking one re-forms the canvas around the files and people it names (e.g. the ten people who edited all seven `ReactFeatureFlags` forks, four of them ghosts). *Passes the checkpoint test:* it shows how findings connect across lenses and which entities they share — a different structure (finding → entities graph), which neither the ring, the time strip, the inspector chart nor the detail table can show.

**Findings** (inspector): the loudest outlier stated in plain language, naming entities as chips. Ring: the loudest group ("who owns the code: 63% of files lean on one author, 39 of 77 contributors went quiet"). Briefing: one card per finding, across lenses.

**Dropped from classic:** the treemap hero and its six alternate heroes (ownership, coupling, commit-graph, scatter, timeline, swimlanes) — each is, or will be, a lens of its own; the metrics strip, whose five numbers the ring shows in context; the overview's bottom tabs, which open their own lenses.

**Open:** the 0–3 grading needs a scene function shared with `computeOutlierBadges` (one rule table, two outputs). The Stale Files rule fires on mature repos where most files simply didn't change in the window (66% of React) — tune before the ring makes it loud.

### Code Health › Hotspots (checkpoint 2026-10-18, PR 3.2)

**Input:** no docs page yet (`cursed-files.md` already links to `/analyzers/hotspots`) — 3.2 writes it. `polish-pattern.md`: "strong scatter hero, signals chips earn the table's space."

**What it must communicate:** which files are both busy and big (score = churn × log₂ size, scaled so the top file is 100; critical ≥75, warning ≥50, moderate ≥25), and why a given file is hot.

**Primary form — Field.** Commits (x) against lines (y), both log scale. Dashed equal-score curves at 25 / 50 / 75 with the critical region tinted, so position reads as score. Files scoring 25+ are dots on the risk ramp; the long tail of low scorers is drawn as density, not thousands of dots. The top files get labels in a column with leader lines (they crowd the top-right corner). On React it separates two kinds of heat: 4,500+-line engine files that keep changing, and sub-300-line feature-flag files hot on churn alone.

**Selecting a file (behaviour, not a form).** The file travels to a root position and fans out its facets — churn, size, owners, what it changes with, trend, blast radius, rewrite ratio, root-cause clusters, last touched — the mock's file → facets fan. The time strip lights the weeks it changed.

**Alternate form — By package.** Each package (top-level directory outside `packages/`) is a circle sized by file count; its files are dots in a sunflower with the hottest at the centre. *Passes the checkpoint test:* a different structure (containment), and it answers "where does heat concentrate" — on React, `shared/` (22 files, 7 at 25+) versus `compiler/` (1,369 files and the most commits, nothing at 50+), which the field and the detail table can't show at a glance.

**Inspector:** headline (file, score, commits × lines), finding, distribution by tier (log-scale bars), detail table of every hotspot collapsed beneath.

**Dropped from classic:** the treemap and risk-heatmap alternates (by-package replaces the treemap's question; the risk heatmap belongs to Risk); the signals chips move into the selected file's facets.

*Scope (confirmed 2026-10-18): PR 3.2 builds Overview and Hotspots plus the shared shell (five-view rail, lens bar, time strip, inspector). Churn and Cursed Files get their own checkpoints next.*

---

## Decision log

- **2026-10-17 — Navigation is five views with one lens row.** The rail lists five group views, each view has a single lens bar of its analyzers, and alternate pictures are corner-toggle forms rather than a second tab row. Replaces classic's 23-item sidebar, which PR 3.1 had ported as-is. *Why:* a 23-item list duplicates the Overview canvas and ⌘K, costs 240px, and its collapsed state navigated nowhere; lenses let marks morph between analyzers of the same entities.
- **2026-10-17 — Trend, distribution and leaderboard are shared, not per-analyzer.** The time strip, the inspector's distribution chart and the detail table answer them for every lens. An alternate form must show something none of those can.
- **2026-10-17 — The forms pattern stays available.** `AnalyzerView.layouts` and the corner toggle are supported for lenses that need a second structure (e.g. Contributors flow vs swimlanes), used sparingly.
- **2026-10-18 — Overview is a ring of every lens, with Briefing as its one alternate.** Clicking a lens fans out its top entities as a preview, and opening it carries those marks into the lens. *Why:* all lenses visible at once beats the mock's one-view-at-a-time fan; the fan survives as the click motion, so it doesn't need to be a form.
- **2026-10-18 — Hotspots is a churn × size field, with By package as its one alternate.** Selecting a file fans out its facets. *Why:* the field shows every file's score by position; containment answers "where" without a second chart in the inspector.
- **2026-10-18 — The inspector is one column with two modes.** Lens mode explains the lens; selection mode explains the entity, leading with rule-based What to do and a Flagged by list that navigates across lenses. The table becomes a full-width drawer, the Guide an on-demand sheet. The inspector is 400px, collapses to a strip, and wraps long names rather than truncating them. *Why:* classic's nested tabs hid most of this behind clicks, and a sortable table can't live in a 360px column.
