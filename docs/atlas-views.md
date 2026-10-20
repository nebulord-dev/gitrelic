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
- **Other ways in stay:** the Overview canvas (analyzer cards), ⌘K (an empty query lists every analyzer; picking one with an Atlas view opens its lens), and the inspector's "Flagged by" links. The rail and lens bar are the discoverable path, not the only one.
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
- **UI:** with two or more layouts, a compact toggle sits in a corner of the stage (`FormToggle`: labelled buttons, `aria-pressed`), like a map's map/satellite switch. It is never a tab row, and it never moves the lens bar. Each layout's `caption` sits along the bottom of the stage with the lens's **Docs ↗**.
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
- **What to do, as built** (`advice/whatToDo.ts`, agreed with the maintainer 2026-10-18). Rules in priority order, at most three per file; every file, whatever the lens, except generated ones (`fileClasses`), which get none: nobody edits them by hand. The card (`WhatToDoCard`) sits under the file card, and each action's evidence links to its section when that section renders.

  | Rule | When | Action | Evidence (section) |
  |---|---|---|---|
  | new-owner | its main author has gone quiet (ghost file) | Find it a new owner. | who wrote how much, and how long they've been quiet (People) |
  | pair | hot (50+), bus factor critical, owner still active | Pair on it, or split it, before only one person can change it. | commits, and the top author's share (People) |
  | read-log | shame 40+ | Read its commit log before the code. | how many commits say its top shame words (Activity) |
  | split | 1,000+ lines and accelerating | Split it before it grows further. | lines, recent commits of all (Flagged by) |
  | add-tests | hot source file, no test beside it and none in its folder or its `__tests__` | Add tests before the next change. | no tests in its folder, commits (Flagged by) |
  | change-together | a partner shares 50%+ of the rarer file's commits, 3+ shared | Change it with X open. | shared commits (Changes with) |
  | settle-design | rewrite score 70+ | Settle the design first: code here doesn't stick. | lines deleted for lines added (Flagged by) |

  The folder check on add-tests is stricter than test coverage's sibling check on purpose: React tests `ReactFizzServer.js` from react-dom's `__tests__`, which the sibling check misses. Wording is cheap to change; the thresholds are named constants beside the rules.
- **Explaining every lens is a pattern, not per-view work.** Each lens has:
  - a one-line caption on the stage, with *How to read* and **Docs ↗** in a corner;
  - the measure sentence and *how to read it* note in lens mode;
  - an entry in the Guide.
  A lens doesn't ship without its docs page.
- **The Guide** is a sheet on demand (`?`), not a permanent panel. The current lens is pinned at the top with how to read it and its caveats; below it every analyzer is grouped by view, with search and a Docs link each. It reads the catalog's `explain` text, so the Guide, the inspector and ⌘K say the same thing.
- **The detail table** is a full-width drawer over the bottom of the stage (`T`, or the stage's Table button, or the lens card's link), not a card in the inspector. It has a filter, tier toggles and sortable columns. Hovering a row lights its mark and shows its tooltip (a file the form doesn't draw lights what holds it — its density cell, or its package's disc — through scene `Scene.standIns`), and clicking selects it; the pointer on a stage mark outranks a focused row; the stage stays live above. Escape clears its filter first, then closes it, before it ever clears the selection. A lens opts in with `AnalyzerView.table` (scene `LensTable`: columns, rows keyed by entity id with a tier, the lens's tier names and default sort); the drawer draws at most 300 rows and asks for a filter past that. *Open:* the drawer covers the bottom of the stage, so a hovered row's mark can sit behind it; framing the stage above the open drawer would fix that.
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

> Defaults stay out of the URL: the Overview view and a view's default lens are omitted, so a fresh load has no hash. `t` is reserved: `hash.ts` parses it and `isTimeWindow` validates it (`2026-03` or `2026-01..2026-03`), but `Nav` drops it until the first lens narrows to a window. That lens wires up the strip's brush, so a shared link never promises a filter nothing applies.

## What this changes in the build

Shipped in the navigation shell PR (the first of 3.2's three):

- **Rail** (`Rail.svelte`): five view destinations with badge dots that roll up their lenses'. The 23-item list and its 240px expanded state are gone.
- **Lens bar** (`LensBar.svelte`): the open view's analyzers, with badges and classic ↗ for those without an Atlas view. One row, scrolling sideways with a faded edge when it can't fit.
- **Time strip** (`TimeStrip.svelte`): commits per week across the window. It lights the selection's weeks.
- **Inspector:** lens mode and selection mode, Flagged by (scene `fileFacts` rows, each naming its lens), Activity, Changes with, the collapse strip (`I`), 400px and wrapped names (see [The inspector](#the-inspector-right-sidebar)).
- **Guide** (`GuideSheet.svelte`, `?`).

Both shipped with Hotspots (RELIC-348): the **table drawer** (`T`) and **What to do** (rules in scene, see [The inspector](#the-inspector-right-sidebar)).
- **Catalog:** gains the view → lens mapping if a checkpoint diverges from `PRESET_GROUPS`.
- **Kept as is:** catalog, badges, entity index, ⌘K palette, inspector cards, `AnalyzerView` / `Layout` model.

### Open items for the views that need them

- **Selecting `cell:`, `week:` and `commit:` marks.** `Nav.select` drops any id the entity index doesn't hold, so today a click on one of those marks clears the selection. The first view that draws them (Commit Timing's clock, Contributors' strips) either adds them to the index or gets its own selection path, with an inspector card for the kind.
- **Two answers to "what does it change with?"** The file card's *Flagged by* row (`fileFacts`) names coupling's `topPartner`, the strongest partner by percentage; its *Changes with* section and the Hotspots facet (`coupledWith`) name the partner with the most shared commits. On `ReactFizzServer.js` that's `ReactDOMBrowser.js (76%)` against `ReactDOMFizzServer-test.js · 14×`. Pick one rule (or show both, labelled) when the file card next changes.
- **Palette cost on huge repos.** `rankEntities` scores every entry and keyword (full paths included) on each keystroke. Fine at this repo's size; if a large monorepo stutters, filter the previous results when the query extends the last one, or debounce.

## Lens inventory (2026-10-18)

Classic had 23 presets over 22 analyzers. Checked against React's real report, several pairs measure the same thing twice, a few don't measure what they claim, and a few valuable questions go unasked. Atlas carries about 15 sharper lenses instead. Each lens still gets its own design checkpoint before it's built; this table decides **what the lenses are**, and the checkpoint decides **how each one looks**. Figures come from `gitrelic --json` on React at `eb8feb7109` (2026-08-14) with the CLI's 12-month default window. Rows name catalog preset ids in `code` where one exists; Churn Velocity and Hotspot Clustering are analyzers with no preset of their own.

### Merges (duplicates)

| Merge | Evidence on React (12 months) | Result |
|---|---|---|
| Bus Factor + Knowledge Silos (`bus-factor`, `knowledge-silos`) | 811 vs 813 of 1,291 files; Silos is computed from bus factor's data | **Ownership**; Silos' 63% single-author share becomes a secondary stat under the Truck factor headline |
| Ghost Files (`ghost-files`) → Ownership | all 100 ghost files are bus-factor critical | a highlight in Ownership: single-owner files whose owner left |
| Cursed Files + Hotspot Clustering + the Risk and Tech Debt dashboards (`cursed-files`, `risk`, `tech-debt`) | all 8 cursed files are among the 20 multi-signal files | **Risk**: one composite that says *why* per file (needs per-reason points, RELIC-343) |
| Stale Files (`dead-code`) → Age Map (`age-map`) | "stale" is every file untouched in the window (4,644); Age Map already tiers ages | **Age** |
| Churn Velocity → Churn | velocity is churn over time; the time strip owns "when?" | **Churn**'s Rhythm form shows speeding up and slowing down as weekly bars; the velocity score stays out (see the Churn checkpoint) |
| Rewrite Ratio (`rewrite-ratio`) → Churn | the insertion/deletion balance is how a file churns | **Churn**'s added/deleted bar and character tag (tweaking, rewriting, growing) |
| Blast Radius (`blast-radius`) → Coupling | blast radius is co-change breadth | node size in **Coupling** |

### Fix or retire

- **Test Coverage (`test-coverage`) — fix (RELIC-360).** The proximity proxy is wrong: 40 of React's 311 "untested" directories have a `__tests__` folder full of tests. Replace it with *test co-change*: how often a source change ships with a test change.
- **Shame (`shame`) — rebuild as Fix rate (RELIC-359).** 144 of the 173 files scoring 70+ have three commits or fewer, so the score is mostly small-sample noise. Ask the real question: how often a change to a file is followed by a fix or revert, with commit keywords as one input and a minimum sample.
- **Renames (`renames`) — retire as a lens.** Rename history is plumbing; it stays as a row in the file inspector.
- **Commit Timing (`commit-timing`) — keep.** Frame it around the code ("this module changes at 2am"), not around people. Its checkpoint takes care with that.

### New

- **Truck factor** — how many people would have to leave before most of the code has nobody who knows it, for the repo and each directory. The **Ownership** headline (RELIC-357).
- **Cross-owner coupling (Conway's law)** — files that change together but belong to different people: coordination cost. A highlight in **Coupling** (RELIC-358).
- **Release cadence** — how changes cluster around tagged releases (RELIC-265).

Fix rate, test co-change, truck factor and cross-owner coupling are new core work, each following *Adding a new analyzer* in `CLAUDE.md` (types, runner fallback, `normalizeReport` backfill, fixture regen).

### The lenses

| View | Lenses |
|---|---|
| Overview | Repo map (form: Briefing) |
| Code Health | Hotspots · Churn · Risk · Age · Fix rate · *Complexity growth (own lens or a Hotspots facet: decided at its checkpoint)* |
| Ownership & Risk *(name revisited when Risk moves; see below)* | Ownership · Coupling |
| Team & Activity | Contributors · Parallel Dev · Commit Timing · AI & Co-authors · *Release cadence* |
| Structure | Languages · Tests · *Repo health (git-sizer, RELIC-297)* |

That is 14 confirmed lenses plus three in italics still to be decided. Once Risk moves to Code Health, the Ownership & Risk view holds no Risk lens; its name is settled in the catalog PR that moves it.

The catalog changes as each view's lenses ship, not all at once, so classic stays reachable for everything until its Atlas replacement exists.

**Catalog parity as lenses ship.** `catalogParity.test.ts` requires scene's `CATALOG` to hold exactly classic's preset ids, each in classic's group; today its only escape hatch is `ATLAS_RENAMES`. The first catalog PR that merges, moves or adds a lens extends the test with three tables instead of loosening it:

- `ATLAS_MERGES` — a classic preset id → the Atlas lens that absorbs it (`ghost-files → ownership`). The merged id leaves the catalog, and the target must exist in it.
- `ATLAS_MOVES` — a preset id → its new group (`cursed-files → code-health`). It skips the group check for that id only.
- `ATLAS_ONLY` — lens ids with no classic preset (`ownership`, `fix-rate`, `truck-factor`, `release-cadence`). They're allowed in the catalog, and they must not appear in classic's registry.

Every classic preset must then be in the catalog, in `ATLAS_MERGES`, or retired in an explicit list, so nothing becomes unreachable by accident.

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

**Primary form — Ring.** The repo at the centre; every analyzer lens on an outer ellipse, grouped into the four other views (sector order: Code Health, Ownership & Risk, Team & Activity, Structure), sized and heated by how far its reading sits outside normal for a repo this size (the same outlier rules as the badges, graded 0–3). Outliers carry their number and name; quiet lenses stay small and grey. It answers "where is this repo unusual?" in one look and doubles as navigation to every lens (about 15; see *Lens inventory*).

**The fan-out (the ring's click behaviour, not a form).** Clicking a lens dims the others and fans its top entities out of its dot on an arc, each labelled (e.g. Bus Factor's most at-risk files with their owners). A second click or Enter opens the lens: the view moves to it and those same marks fly to their places in the lens's layout, because they keep their entity ids. Back reverses it. The preview is the first frame of the real view. This replaces the mock's fan as a separate picture.

**Alternate form — Briefing.** A short list of findings across lenses; picking one re-forms the canvas around the files and people it names (e.g. the ten people who edited all seven `ReactFeatureFlags` forks, four of them ghosts). *Passes the checkpoint test:* it shows how findings connect across lenses and which entities they share — a different structure (finding → entities graph), which neither the ring, the time strip, the inspector chart nor the detail table can show.

**Findings** (inspector): the loudest outlier stated in plain language, naming entities as chips. Ring: the loudest group ("who owns the code: 63% of files lean on one author, 39 of 77 contributors went quiet"). Briefing: one card per finding, across lenses.

**Tooltips** (added with the drawer PR): a lens dot shows its name, reading and the reason it's graded; a fanned entity shows its name and its value in that lens.

**Dropped from classic:** the treemap hero and its six alternate heroes (ownership, coupling, commit-graph, scatter, timeline, swimlanes) — each is, or will be, a lens of its own; the metrics strip, whose five numbers the ring shows in context; the overview's bottom tabs, which open their own lenses.

**As built (3.2b):**
- **Grading:** scene `outlierGrades` grades every badge rule from 0 to 3. A badge is grade 2 and up, so the rail and the ring can't disagree.
- **Readings:** `lensReadings` gives each lens its short reading.
- **Fan-out data:** `lensTopEntities` returns the fanned entities, only ones the index resolves.
- **Layout:** `layouts/ring.ts`:
  - labels point away from the centre: the lens name over its reading (`labelSub`), the reading in accent when the lens badges (`labelClass`);
  - side labels lean away from the horizontal axis near the top and bottom (`labelLean`), where the ellipse stacks lenses closer than a two-line label is tall; a fanned lens's label turns inward, off its fan, and lifts clear of its own spoke (at the very top or bottom, where the spoke is vertical, it goes to the outer side, dropped below the fan);
  - the centre is a thin `outline` (a vector circle, sharp at any size) holding the repo's name over its file and line counts (`repoReading`; no branch, which wouldn't fit). It wraps inside the circle and shrinks with it as the stage zooms out, dropping the counts only once they'd shrink below 70%;
  - view names are label-only marks;
  - fanned marks are parented to their lens, so they grow out of it.
- **Clicks:** a second click on a lens opens it, in Atlas if it has a view, otherwise in classic.
- **Camera:** when a scene's extent changes (a fan opens) and the viewer hasn't panned or zoomed, the stage glides to frame it, alongside the marks.

Stale Files has no outlier rule: its count is every file untouched in the window, which measures the window, not decay. Its checkpoint defines a real one.

**Next:** Briefing, the alternate form, ships in its own PR with its findings engine.

### Code Health › Hotspots (checkpoint 2026-10-18, PR 3.2)

**Input:** no docs page yet (`cursed-files.md` already links to `/analyzers/hotspots`) — 3.2 writes it. `polish-pattern.md`: "strong scatter hero, signals chips earn the table's space."

**What it must communicate:** which files are both busy and big (score = churn × log₂ size, scaled so the top file is 100; critical ≥75, warning ≥50, moderate ≥25), and why a given file is hot.

**Primary form — Field.** Commits (x) against lines (y), both log scale. Dashed equal-score curves at 25 / 50 / 75 with the critical region tinted, so position reads as score. Files scoring 25+ are dots on the risk ramp; the long tail of low scorers is drawn as density, not thousands of dots. The top files get labels in a column with leader lines (they crowd the top-right corner). On React it separates two kinds of heat: 4,500+-line engine files that keep changing, and sub-300-line feature-flag files hot on churn alone.

**Selecting a file (behaviour, not a form).** The file travels to a root position and fans out its facets — churn, size, owners, what it changes with, trend, blast radius, rewrite ratio, root-cause clusters, last touched — the mock's file → facets fan. The time strip lights the weeks it changed.

**Alternate form — By package.** Each package (top-level directory outside `packages/`) is a circle sized by file count; its files are dots in a sunflower with the hottest at the centre. *Passes the checkpoint test:* a different structure (containment), and it answers "where does heat concentrate" — on React, `shared/` (22 files, 7 at 25+) versus `compiler/` (1,369 files and the most commits, nothing at 50+), which the field and the detail table can't show at a glance.

**Inspector:** headline (file, score, commits × lines), finding, distribution by tier (log-scale bars), detail table of every hotspot collapsed beneath.

**Dropped from classic:** the treemap and risk-heatmap alternates (by-package replaces the treemap's question; the risk heatmap belongs to Risk); the signals chips move into the selected file's facets.

*Scope (confirmed 2026-10-18): PR 3.2 builds Overview and Hotspots plus the shared shell (five-view rail, lens bar, time strip, inspector). Churn and Cursed Files get their own checkpoints next.*

**As built (first Hotspots PR, RELIC-348):**

- **Field.** Commits × lines, log–log. The 25 / 50 / 75 curves come from core's formula (score ≈ commits × log₂(lines) / k, so each curve is commits = S·k / log₂(lines); `hotspotScale` recovers k from the report), so they're exact on any repo up to core's rounding. Files at 25+ are dots (capped at 400, hottest first), the rest density bins; the selected file is drawn as a dot even when it's cool. The top eight are named in a column right of the plot with leaders, ordered by height. The critical region is *not* tinted: the renderer draws no filled shapes, and the 75 curve carries it.
- **By package.** Packages are faint discs (a ring's stroke scales with its radius); files in a sunflower, hottest at the centre. *Reworked 2026-10-18 after comparing with the mock (Hotspots C):* the ten biggest packages are drawn, plus any smaller one with three or more files at 25+ (so `shared/` always shows) or with a critical file (so React's root, holding `package.json`, the repo's hottest file, shows); the rest stand together as one empty ghost circle heading the last column (above where the table drawer opens), the size of the smallest drawn circle (sized by its files it outgrew most packages) and headed like a package ("+35 more packages / 740 files · in the table (T)"); their files stay in the table. Those files stand in on the ghost (RELIC-363), so hovering one's table row brings up its tooltip, which names the hidden packages. It began as a line of text under the picture, where the table drawer covered it the one time anyone hovers those rows; centred above the columns it read as a package without a circle. An outline circle says "the rest, bundled" in the picture's own terms. Circles stand in columns, biggest first, each under a two-line heading (the name, bold, then "N files · K at 25+", saying "none" too). Each column is as wide as its widest heading, allowing for the stage zooming out to 0.6, so headings never collide; `packSiblings` packed everything into one round blob, where pixel-sized names couldn't fit and were culled. Only the stage's shape steers the columns. A selected package is outlined by a hairline accent circle (a guide: a ring mark's stroke grows with its radius). Two-line labels are `Mark.labelSub`, which the label layer draws as a heading. Only files at 25+ claim label space.
- **Inspector (lens mode):** About, then the Hotspots card (critical and warning counts, up to three findings, tiers on log bars, top five).
- **Findings** (on React): the hottest file (`ReactFizzServer.js`, 33 commits across 6,656 lines); two kinds of heat among files at 25+ (24 large, 7 under 300 lines hot on churn alone); and the package with the largest share of its own files at 25+, set against the biggest package when that runs much cooler (`packages/shared/`: 7 of 22; `compiler/`: 7 of 1,369).
- **Tooltips:** a file (in either form) shows its name, score and tier, commits and lines, and its folder; a density cell shows how many files it holds and their range of commits and lines; a package shows its file count, how many are at 25+, and its hottest file. Ticks, callouts and names say nothing.
- **Table:** every scored file: path, score, commits, lines, package; hottest first.
- **Selecting a file (second Hotspots PR).** The field squeezes into the left 36% of the stage (every dot tweens there) and drops the callout column; the file travels to a root right of it, with a faint ring and leader back to where it sits in the plot, and its facets (`hotspots/facets.ts` `fileFacets`) fan out on an arc to the right, growing from the root. Other dots stay clickable, so picking another file sends the old root home and the new one out. The spokes run from an invisible hub at the root (`facet-hub`), not from the file, so the fan stays put through the swap and only its readings change; tied to the file, every spoke jumped to the new file's dot and rode out with it. Hot facets (thresholds in the docs page) are accent dots with hot links. Facet and ring ids (`facet:`, `home:`) aren't entity kinds, so clicking one selects nothing. By package doesn't fan.
- **What to do (third Hotspots PR).** The inspector's rule-based actions (see The inspector). On `ReactFizzServer.js`: split it (6,656 lines, 21 of 33 commits recent), change it with `ReactDOMFizzServer-test.js` open (14 shared commits), and settle the design first (847 lines deleted for 1,084 added).

### Code Health › Churn (checkpoint 2026-10-18)

**Input:** `apps/docs/analyzers/churn.md` (its lesson: file rank and directory rank answer different questions; it links to `churn-velocity` and `hotspots` pages that don't exist yet, fixed when this lens ships), classic's churn bar and Churn tab, the Velocity preset this lens absorbs. Canvas: three boards on React's last 12 months.

**What it must communicate:** where change concentrates (by file and by directory at once) and how each file churns: steady tweaks, rewrites or growth, speeding up or slowing down.

**Primary form — Swarm.** One row per directory, one dot per file, placed on a log scale of commits; a grey band holds files with one or two commits. The same total can hide opposite shapes, and the swarm shows both at once: on React, `compiler/` (855 changes) is a wide low cloud with no file past 18, while `shared/` is seven dots stacked near the top (the feature-flag forks). *Carried over from the sunburst board:* each row carries its directory's total as a heat bar behind the dots, and with nothing selected the inspector leads with the hardest-churning directory (changes per file), so the lens still reads at a glance like a landing page.

**Alternate form — Rhythm.** The top files as rows of week-by-week bars, with an added/deleted bar and a character tag (tweaking, rewriting, growing); files that change in lockstep are marked. *Passes the checkpoint test:* it shows each file's shape over time and the add/delete balance, which the shared time strip (one selection at a time) and the detail table (totals) can't. This is where Velocity lives: speeding up and slowing down are read off the bars, not a score.

**Tooltips:** a dot shows the file name, commits, lines added/deleted and its character; a row label shows directory total, file count and files with one or two commits.

**Findings:** the directory that leads on total versus the one that churns hardest per file; lockstep groups ("seven files changing week for week: one change, made seven times").

**Dropped from classic:** the churn bar (a leaderboard, which the detail table covers); Velocity's accelerating/decelerating score. 259 of the 325 files it flags on React have three commits or fewer, so it stays out until core requires a minimum sample. Tests stay out of the swarm, as in classic's source Churn tab; its tests mode (`ChurnTab mode="tests"`) moves to the Tests lens.

**As built (first Churn PR, RELIC-362):**

- **Swarm.** Rows are packages (`packageOf`, the same grouping as Hotspots' By package; root files share the repo's row), the twelve with the most changes, with a "+N more in the table" note. Commits are whole numbers, so each dot is spread across [c, c + 1) and up and down its row by a hash of its path (stable across builds). Files with one or two commits are ghost-grey left of the band's edge line; the rest take the risk ramp by core's churn category. The heat bar is the row itself: a full-width bar shaded from `--cell-base` toward the accent by its total (at most 7%, since the blend is in linear RGB, which reads strong). The row is the package's `dir:` mark, so hovering anywhere on it shows its tooltip and a click selects it. Row names drop `packages/`. Each row names its busiest file.
- **Character** (tooltip and table): rewriting (rewrite score ≥ 70), growing (added ≥ 3× deleted), shrinking (deleted ≥ 3× added; added because a file that's mostly deletions isn't "tweaking"), tweaking (anything else).
- **Lockstep** comes from coupling pairs, not weekly bars: source pairs sharing ≥ 90% of *both* files' commits (core's strength divides by the quieter file, so a small file riding along with a busy hub would score 100) over ≥ 5 shared commits, joined into groups of three or more. That's stricter than "week for week", and it needs no commit history. On React: five feature-flag files (`ReactFeatureFlags.js` and four forks; the two `*-dynamic` forks drop out: with 12 and 17 commits against about 30, they sit out most flag changes).
- **Inspector (lens mode):** About, then the Churn card. It leads with the hardest-churning package (changes per file, among packages with five or more files; on React, `packages/shared/` at 12.9), then the findings and the five busiest packages.
- **Table:** every source file: path, commits, added, deleted, character, package; most commits first, tiered by churn category.

**As built (second Churn PR, RELIC-362):**

- **Rhythm.** The 16 source files with the most commits, one row each, with their commits week by week over the time strip's weeks (Monday-start UTC, first commit to last, so a row lines up with the strip). Bars share one height scale and stand on the row's floor. A line splits the weeks in half, which is how Velocity is read now: no score, only the bars on either side of the line. Files are matched by current path, so weeks before a rename are empty, as in churn's own count. It needs the commit history, so it waits for `/gitrelic-commits.json` like the time strip does. *Long windows (follow-up, 2026-10-18):* past 104 weeks (a `--since all` run) the bins are calendar months, ticks mark each January and the header says "commits per month". Ten years of weeks would be 520 one-pixel bars a row and about 8,000 marks, past the bench's 5,000.
- **Right of the weeks:** lines deleted (muted, leftward) against added (accent, rightward) on one axis, on a square-root scale. Then the character tag, the same rules as the swarm's tooltip.
- **Lockstep marks:** a ring in the left margin for each file in a lockstep group (the swarm's rule), with the group's rings tied by a line. Only groups with two or more members among the rows are drawn. On React it ties five of the feature-flag rows; `ReactFeatureFlags.www.js` and `test-renderer.native-fb.js` sit just under the 90% bar.
- **Constancy:** each file keeps its `file:` dot at the start of its row, so switching from the swarm, the busiest files travel into the column. Shapes swap without tweening, so the row itself (`row:`) is a separate bar. It carries the file's tooltip so the whole row hovers, but clicking it selects nothing; the dot selects the file. Week bars grow out of their file.
- **Tooltips:** a row or dot shows the name, commits and how many fell in the recent half, lines added and deleted, and the character. A week bar shows its commits and the week.

### Code Health › Risk (checkpoint 2026-10-18)

**Input:** `apps/docs/analyzers/cursed-files.md` (numbers are stale; refreshed when this lens ships), classic's Cursed Files, Hotspot Clustering, and the Risk and Tech Debt dashboards this lens absorbs. Canvas: three boards on React's last 12 months.

**What it must communicate:** which files are risky, *why* (one score is several reasons added up), and what sits upstream of them.

**Primary form — Score stacks.** One row per file: its score split by reason (churn, ownership or many authors, abandoned hot file, fix commits, parallel edits) as a stacked bar, with the cursed line at 50 drawn in so near misses show. On React all eight cursed files are cursed for the same three reasons, and the two biggest engine files (`ReactFizzServer.js`, `ReactFiberConfigDOM.js`) miss the line by 5. Signals the score doesn't count (hotspot 50+, accelerating) are marked beside the bar. Ownership and many authors are two branches of one check in `cursed-files.ts`, so a file shows one or the other, never both.

**Alternate form — Root causes.** Coupling hubs on the left, the risky files they change with on the right. *Passes the checkpoint test:* a different structure (hub → files) that joins coupling and risk, which classic keeps on separate tabs; on React, `ReactTypes.js` changes with nine of the top hotspots, and the two `*-dynamic` flag files each pull along all seven flag files.

**Tooltips:** a bar segment shows the reason, its points and the measurement behind it (e.g. "Many authors · 10 pts · 11 authors"); a hub shows the files it changes with and how often.

**Findings:** the shared reason across the cursed set; near misses and why; the hub with the most risky files downstream.

**Dropped from classic:** the risk heatmap and ownership-sunburst heroes; Tech Debt's growth timeline (Complexity growth decides its own place). The signal constellation (radviz) board was rejected: where a file lands depends on the order of the anchors around the ring, a hidden choice that changes the picture's meaning.

**Before building (core, RELIC-343) — done.** Each `CursedFile` carries `breakdown` (`{ kind, label, points }` per reason, in `reasons` order; `kind` is `churn`, `ownership`, `authors`, `abandoned`, `fixes` or `parallel`). The points sum to the uncapped score, so `curseScore` is that sum capped at 100. `CursedFilesReport` adds `threshold` (50) and `nearMisses`: files scoring 40–49, highest first, at most 20, bot-driven ones dropped. Near misses come from the same candidate set as cursed files (top churn, critical bus factor, shame leaderboard, parallel hot files), so a file outside those never appears. On React's last 12 months that's three: `ReactFizzServer.js` and `ReactFiberConfigDOM.js` at 45 (churn 35 + many authors 10) and `ValidateExhaustiveDependencies.ts` at 45 (churn 15 + ownership 30). `cursedFiles` is 7.2 KB of a 9 MB report.

**Size and acceleration stay out of the score (decided 2026-10-18).** Size is already Hotspots' axis (churn × size), so adding it would count churn twice and turn Risk into a second hotspot ranking; files that are top hotspots just under the line are named in the finding instead. Acceleration as a bonus is noise (see Churn). If recency should count, it comes in as time-weighted churn with a minimum sample, not as a separate bonus.

**As built (first Risk PR, RELIC-349):**

- **Lens.** The `cursed-files` preset, now an Atlas lens labelled **Risk** (`ATLAS_RENAMES` in `catalogParity.test.ts`). Classic's Risk dashboard merged into it (below); Tech Debt stays a classic link until its place is decided (see Overview's bar).
- **Score stacks.** Every cursed file, highest first, then, under a "near misses, under 50" rule, the near misses. Each bar is the file's `breakdown` stacked in scoring order, with a 1.5px gap between segments. The axis runs 0 to 100, or to the longest bar when one passes 100 (the score caps at 100, the bar doesn't), with ticks every 25 and the cursed line at the report's `threshold`. Beside each bar: its score, then a hotspot score of 50+ and "accelerating". The row is the file's `file:` mark (a faint track across the axis), so the file travels in from Hotspots and Churn; segments (`seg:<file>:<kind>`) select their file through `Mark.selects`, which `AtlasStage` honours on click.
- **Colours (decided 2026-10-20: existing roles, no new tokens), with a legend above the stacks.** Churn takes the accent, ownership the person colour, and many authors the person colour at half strength, since it's the other branch of the same check. Abandoned is ghost and parallel edits the dir colour. Fix commits is `--risk-1`, not `--risk-3`: the ramp's hot end *is* the accent in both themes, so it would match churn. In Flat, `--risk-1` is brick and parallel edits light grey; in Glow they're khaki and lavender.
- **Near misses are thinner, not faded** (the bar at 55% height, 0.8 alpha). Fading them made a near miss's ownership read as many authors and its churn as fix commits.
- **Old reports.** A file without a breakdown is one ghost segment of its score, whose tooltip says the split isn't in the report.
- **Empty.** With no file at 40+, the stage says "No file scores 40 or more" and why healthy repos show none.
- **Tooltips.**
  - A segment shows the reason and its points, then core's measurement ("Many authors · 10 pts" / "11 different authors — high coordination overhead").
  - A row shows the file, its score (cursed, or how many points short), each reason with its points, the uncapped sum when it passes 100, and the signals the score leaves out.
- **Findings.**
  - The reasons the whole cursed set shares. With nothing shared, the worst file instead.
  - The near misses, with the closest one's reasons and how far short it falls.
  - Near misses that are hotspots of 50+.
- **Inspector (lens mode).** About, then the Risk card: the cursed count and near misses, the findings, and the five highest scores, each with a small split bar.
- **Overview's Risk tab is retired.** Classic's `risk` preset merges into this lens (`ATLAS_MERGES` in `catalogParity.test.ts`, the first entry), so Atlas has one Risk, in Code Health. Overview's bar is Repo map · Tech Debt ↗ until Complexity growth's checkpoint; classic still serves the old dashboard at `/classic/#preset=risk`.
- **Signals the score leaves out** (hotspot 50+, accelerating) sit in their own column right of the axis, under "Not in the score", not beside the score: "50 hotspot 56" read as one number.
- **Table.** Cursed files and near misses, with these columns: score, the points for churn / "Ownership / authors" (one column: a file scores one or the other) / abandoned / fixes / parallel, hotspot, and status ("cursed" or "near miss (N short)"). Tiers are Near miss, Cursed, and Cursed 60+.
- **React (last 12 months).**
  - Eight cursed files, all churn 35 + many authors 10 + parallel 5 or 10: seven `ReactFeatureFlags` forks and `ReactFlightClient.js`.
  - Three near misses at 45: `ReactFizzServer.js` (hotspot 100, accelerating) and `ReactFiberConfigDOM.js` (hotspot 94) on churn + many authors, and `ValidateExhaustiveDependencies.ts` on churn 15 + ownership 30.

**Root causes checkpoint (2026-10-20, second RELIC-349 PR).** Probed on React's last 12 months. The 11 risky files reach 37 hubs. The top eight hubs (`ReactTypes.js`, the two `*-dynamic` flag files, `ReactSymbols.js`, `ReactFiberHooks.js`, `ReactFiberCommitWork.js`…) all reach the same seven `ReactFeatureFlags` forks, often over 3–5 shared commits (one flag flip touches every fork plus the code behind it), and a test file (`useEffectEvent-test.js`) is among them. Decided:

- **Right side: cursed files + near misses**, the score stacks' set, so a file travels between the two forms.
- **Families are one node.** Risky files that share ≥ 75% of the *busier* file's commits over ≥ 5 commits are joined (Churn's lockstep rule with a looser bar; at 90% lockstep splits React's forks 5 + 2). On React that's exactly the seven forks (85–96%, 22+ commits), and no other risky pair couples. The node is its highest-scoring member's `file:` mark, labelled with the shared name and count (`ReactFeatureFlags.* (7)`), its tooltip listing the members. Without it, the hubs' reach just counts the family's size.
- **Hubs are source files** (no tests, fixtures or generated files) coupled to a risky node, ranked by risky nodes reached, then shared commits; the top 8 are drawn. Link width is shared commits (a family's link takes its strongest member), so a 3-commit link reads thin.

**As built (Root causes, second RELIC-349 PR):**

- **Form.** `root-causes`, the Risk lens's one alternate (`FormToggle`: Score stacks · Root causes). Data is `risk/rootCauses.ts` (`rootCausesOf`, memoised per report), layout `layouts/rootCauses.ts`. Hubs sit in a column at a third of the width, best first, top down; risky nodes at two thirds, ordered by the weighted mean position of the hubs that reach them, so ribbons rarely cross. Columns are evenly spaced (at most 64 apart) and share a middle; the headings "Change with them" and "Risky files" sit over their names.
- **Marks.** Every node is a `file:` mark, so files travel to and from the stacks. A family is its highest-scoring member's mark, labelled `ReactFeatureFlags.* (7)` (the members' shared basename prefix, trimmed to a word; with under 4 characters shared, the top member's name and "+N"); the other members are `standIns` on it, so their table rows light it. Risky nodes take the risk ramp (cursed `--risk-3`, near misses `--risk-2`), sized by score and a family's size; hubs are `--soft`, sized by reach, so the risk colours stay on the right. A risky node no drawn hub reaches stays, faint (0.55: the label layer hides names under 0.5), with "no hub" under its score. Links are ribbons from hub to node, 1–8 wide by shared commits.
- **Tooltips.** A hub: its name, how many risky nodes it changes with, then each one with "N of its M commits". A family: its name, "7 files that change together in nearly every commit", each member with its score and status, then how many hubs reach it. A single file: its score and how many hubs reach it.
- **Empty.** No risky file: "No file scores 40 or more". Risky files but no hub: the risky column alone, with "No source file changes with them often" where the hubs would be (the fixture shows this: its one coupled pair is two risky files).
- **Finding** (the lens's, so the inspector's Risk card shows it under either form): the top hub, when it reaches two or more risky nodes: "ReactTypes.js changes with 8 risky files: ReactFeatureFlags.* (7) and ReactFizzServer.js. No other source file reaches as many." A family's files all count; ties are said.
- **Table.** The lens's table (cursed files and near misses) under both forms: a table belongs to the lens, not the form.
- **React (last 12 months).** Five risky nodes: the seven flag forks as one family, `ReactFlightClient.js`, and the three near misses. 21 source hubs; the eight drawn are `ReactTypes.js` (the family and `ReactFizzServer.js`, 4 commits each), the two `*-dynamic` flag files (16 and 12 commits into the family), the compiler's `DropManualMemoization.ts`, `HIR.ts` and `CompilerError.ts` into `ValidateExhaustiveDependencies.ts`, `ReactFlightServer.js` into `ReactFlightClient.js` (6), and `ReactFiberCommitWork.js` into the family. `ReactFiberConfigDOM.js` has no hub. `useEffectEvent-test.js`, a top hub when tests counted, is gone.

### Code Health › Fix rate (RELIC-359)

**Before building (core) — done.** `analyzers/fix-rate.ts` and `report.fixRate`, method settled with the maintainer on 2026-10-20 from a probe of React's history:

- **Attribution is line blame, not the file.** For each file a fix commit touched, `blameFixedLines` (`utils/git.ts`) runs `git diff -U0` against the parent and `git blame -w` on the removed or changed lines. The ticket's file-level rule ("a fix touched the file within N days") named the right change 15% of the time on 150 sampled React fixes, and 11% on busy files; only the latest change before the fix, 26%. Blame costs about 2 s for React's last 12 months at six at once, and 15 s for its whole history.
- **Fixes:** subject words `fix(es|ed|ing)`, `bug(s|fix)`, `hotfix`, `regression`, `oops`, `broke(n)`, and subjects starting `Revert`. Shame's `hack`, `workaround`, `temp` and `cleanup` are dropped: compromises, not fixes. React squash-merges, so 21 of its 29 reverts in three years lack the "This reverts commit" body line; the subject catches all of them. Bots are out as fixes and as changes.
- **Sweeping fixes** (more than 20 files) aren't traced: one compiler fix touched 175 fixtures and alone made a month read 43%. The median fix touches 2 files and 95% touch 12 or fewer.
- **Window 30 days.** The median gap from a blamed change to its fix is 15 days, three quarters land within 44. Only changes at least 30 days old are rated.
- **Minimum 8 rated changes** for a file's rate (99 files on React's year at the probe, 55 with fixtures out and the CLI's window), else `unratedFiles`. At 5, one fix reads 20%.
- **Size:** 11 KB on React's 12 months, 278 KB on its whole history.
- **What the picture has to work with:** a quiet distribution. React's repo rate is 1.2% over the year (2.2% all time), most rated files sit at 0%, and a handful exceed 20%. The lens checkpoint decides the picture, the Shame merge (`ATLAS_MERGES`) and what the inspector's Activity card says instead of shame.

**Checkpoint (2026-10-20).** On React's last 12 months, 55 files are rated (8–28 changes, median 12): 43 at 0%, 9 with exactly one fix, and 3 whose count chance can't explain at the 1.2% repo rate: `snap/src/runner.ts` 3 of 8, `Entrypoint/Pipeline.ts` 4 of 18, `HIR/BuildHIR.ts` 2 of 11. A ranked list would set `ReactFeatureFlags.www.js` (1 of 25) beside them as if they meant the same. The picture's job is to tell "above chance" from "had a fix".

- **Above chance** is the lens's one threshold: a file's fixed-after count has under a 2.5% chance (binomial upper tail) at the repo rate for its number of changes. It adapts to each repo, where a fixed cut (25%) would flag everything in a sloppy repo and nothing in a careful one. It drives the badge, the fact's warning tier and What to do.
- **Picture: a funnel field.** x = rated changes, y = fix rate. A shaded band is what chance alone gives at the repo rate (the binomial upper limit for each size), narrowing as changes grow. Rated files are dots; the 0% files settle on a quiet floor; files above the band take the accent and are labelled, the rest stay unlabelled until hovered. Unrated files aren't drawn: the caption says how many there are and why ("1,169 files have fewer than 8 changes old enough to rate").
- **Selection: its fix chain.** The field narrows (as Hotspots does for facets) and the file's lane opens beside it: its commits over time as dots (changes too recent to rate drawn faint), with an arc from each listed fix back to the changes it repaired (`fixes[].causes`). Needs commits (`loadCommits`), like Rhythm. The lane is the selection's picture, not a form: no FormToggle.
- **Tooltips.** A dot: the file, "3 of 8 changes fixed within 30 days", "chance allows up to 1 at this size", its latest fix's message. The band: "What chance gives at a 1.2% repo rate". An arc: the fix's subject and date, and which change it repaired.
- **Finding** (lens mode): "3 files are fixed more often than chance: runner.ts (3 of 8), Pipeline.ts (4 of 18), BuildHIR.ts (2 of 11). Repo-wide, 1.2% of changes needed a fix within 30 days." With none above chance, it says so and gives the repo rate.
- **Table:** rated files — file, changes, fixed-after, rate, above chance, latest fix.
- **Empty.** A report from before fix rate (`windowDays` 0): "This report predates fix rate; re-run gitrelic." No rated file: "No file has 8 changes older than 30 days yet."
- **Shame retires** (`ATLAS_MERGES`: `shame` → `fix-rate`, a new Atlas-only catalog id). Everything in scene that read `forensics` moves: the badge rule (files above chance), the Overview reading and fan entries, `fileFacts` ("Fix rate 38% (3 of 8)", warning tier when above chance, lens `fix-rate`), What to do's `read-log` rule (above chance: "Review its changes closely", evidence "3 of 8 changes needed a fix within 30 days; 1.2% repo-wide", section Activity), and the Activity card lists the file's fixes instead of shame words. Core's Risk score still takes its "fix commits" reason from forensics: a core follow-up, not this PR.

**As built (2026-10-20).**

- **Data** is `fixRate/points.ts`: `fixRateOf` (memoised per report) turns core's rated files into `FixPoint`s with `allowed` (the most fixed-after changes chance explains at that size, `chanceAllows`) and `aboveChance`, sorted above chance first, then by rate. Tiers: 0 no fix, 1 one fix, 2 several within chance, 3 above chance (`FIX_TIER_NAMES`, the table's toggles). `available` is false for a report from before fix rate (`windowDays` 0).
- **Layout** is `layouts/funnel.ts`. x is log scale from the smallest rated size; y is the rate up to the next 10% above the highest dot or the band. The band is one `bar` mark per size (sampled past 80 sizes) up to `allowed / n`, with its edge drawn as steps: the boundary is a whole number of fixes, so it jumps where chance allows one more (on React, at 24 changes). Dots take the risk ramp by tier; above-chance files are named. The floor packs files with no fix into small columns under the axis. The unrated count is a note under the axis title (not the caption, which is static text). Bounds are fitted to what's drawn.
- **Fix chain.** Selecting a rated file narrows the plot to 40% and draws its commits on a lane over the repo's window: fixes as accent rings, the changes they repaired on `--risk-3`, others `--soft`, changes too recent to rate at 0.35, and an arc from each listed fix (core lists at most five) to each cause it shares the lane with. Commits are matched by 12-character hash: `CommitLike` gained an optional `hash`. Links carry no tooltip in the scene model, so the arc's text is on the fix's ring instead (its subject, date and the changes it repaired). `needsCommits` is true, so the lens waits for the commit index like Rhythm.
- **Inspector.** Lens mode is `FixRateCard`: the count above chance of those rated, the finding, the five most-fixed files, and the table link. A selected rated file's Activity card says how many of its changes needed a fix and lists its fixes (date, revert tag, subject, as text).
- **React (last 12 months):** 55 rated, the three above chance named; the band steps from 12.5% at 8 changes down to 5% by 23, then back up to 8% (two fixes allowed) at 24.

---

## Decision log

- **2026-10-17 — Navigation is five views with one lens row.** The rail lists five group views, each view has a single lens bar of its analyzers, and alternate pictures are corner-toggle forms rather than a second tab row. Replaces classic's 23-item sidebar, which PR 3.1 had ported as-is. *Why:* a 23-item list duplicates the Overview canvas and ⌘K, costs 240px, and its collapsed state navigated nowhere; lenses let marks morph between analyzers of the same entities.
- **2026-10-17 — Trend, distribution and leaderboard are shared, not per-analyzer.** The time strip, the inspector's distribution chart and the detail table answer them for every lens. An alternate form must show something none of those can.
- **2026-10-17 — The forms pattern stays available.** `AnalyzerView.layouts` and the corner toggle are supported for lenses that need a second structure (e.g. Contributors flow vs swimlanes), used sparingly.
- **2026-10-18 — Overview is a ring of every lens, with Briefing as its one alternate.** Clicking a lens fans out its top entities as a preview, and opening it carries those marks into the lens. *Why:* all lenses visible at once beats the mock's one-view-at-a-time fan; the fan survives as the click motion, so it doesn't need to be a form.
- **2026-10-18 — Hotspots is a churn × size field, with By package as its one alternate.** Selecting a file fans out its facets. *Why:* the field shows every file's score by position; containment answers "where" without a second chart in the inspector.
- **2026-10-18 — The inspector is one column with two modes.** Lens mode explains the lens; selection mode explains the entity, leading with rule-based What to do and a Flagged by list that navigates across lenses. The table becomes a full-width drawer, the Guide an on-demand sheet. The inspector is 400px, collapses to a strip, and wraps long names rather than truncating them. *Why:* classic's nested tabs hid most of this behind clicks, and a sortable table can't live in a 360px column.
- **2026-10-18 — About 15 lenses instead of 23 presets.** Duplicates merge, as listed in *Lens inventory*:
  - Ownership absorbs Silos and Ghost Files.
  - Risk absorbs Cursed, Clustering and the Risk and Tech Debt dashboards.
  - Age absorbs Stale.
  - Churn absorbs Velocity and Rewrite Ratio.
  - Coupling absorbs Blast Radius.

  Test Coverage is rebuilt on test co-change, Shame becomes Fix rate, and Renames leaves the lens bar. Truck factor, cross-owner coupling and release cadence are added. *Why:* measured on React, the merged pairs overlap almost entirely, and the fixed ones were measuring noise or the wrong thing.
- **2026-10-18 — Churn is a per-directory swarm, with Rhythm as its one alternate.** *Why:* the swarm shows file and directory rank in one picture, which is the churn docs' main lesson; Rhythm is the honest home for velocity, whose score is mostly noise.
- **2026-10-18 — Risk is score stacks, with Root causes as its one alternate.** *Why:* a risk score is only useful when it explains itself; the hubs show what to fix upstream. Needs per-reason points from core (RELIC-343) first.
- **2026-10-18 — Every lens names its tooltip content at its checkpoint.** Hover shows a small tooltip by the mark (never changing the inspector), and the checkpoint records what it says.
- **2026-10-20 — Risk's reasons take existing theme roles, near misses are thinner rather than faded.** *Why:* six new tokens per theme weren't worth it for one lens; and since many authors is told from ownership by strength, a faded near miss would have changed what its colours mean. Fix commits takes `--risk-1` because `--risk-3` is the accent.
- **2026-10-20 — Root causes draws a family of risky files as one node, and only source files as hubs.** *Why:* on React every top hub reached the same seven flag forks, so "risky files reached" measured the family's size, not the hub; and a test changing with risky code is a symptom of the change, not its cause.
- **2026-10-20 — Fix rate traces each fix to its cause with line blame, over a 30-day window, from 8 changes.** *Why:* the file-level rule blamed innocent changes 85% of the time on React, and blame is cheap enough (2 s a year) to do properly.
- **2026-10-20 — Fix rate draws a funnel against chance, and retires Shame.** *Why:* on React only 3 of the 12 rated files with a fix are beyond what a 1.2% repo rate explains; a ranked list would have put the other nine beside them.
