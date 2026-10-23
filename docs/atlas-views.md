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
- **Other ways in stay:** the Overview canvas (analyzer cards), ⌘K (an empty query lists every analyzer; picking one with an Atlas view opens its lens; picking a view opens the Overview with that view's fan open), and the inspector's "Flagged by" links. The rail and lens bar are the discoverable path, not the only one.
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
| Overview | Repo map (forms: Dashboard, Fan; Briefing planned) |
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

**Primary form — Dashboard** (2026-10-21, RELIC-368; board H of the forms bake-off, the bento. Board F, every lens a tile by view, was built first and dropped: twenty-odd tiles of one weight left the eye nowhere to land). A vitals strip (files, lines, commits, active contributors, AI share, main language; scene `repoVitals`), plain cards since they're context, not findings. Below it the **lead**: the loudest lens (highest grade, ties in lens-bar order), its number set large over the reason it's outside normal, then its `lensTopEntities` as rows (name and reading, a bar of each one's weight under it, weighted by the number in its reading), on a frame tinted by its grade. Beside it, the other outliers in a column, loudest first, each with its reason. Below, the calm lenses behind a full-width switch ("Within normal · 15 lenses", closed by default, so the outliers are the page): opened, every one as a chip (name and reading), flowing in lens-bar order. The switch is a `Mark.toggles` mark: clicking it flips a key in the shell's open-panel set (`ViewInput.open`, view state kept out of the URL) and selects nothing. Clicking a tile or chip puts that lens in the lead, in place: the lead and the column's cards are keyed by place (`lead`, `outlier:<i>`), each selecting its lens (`selects`, with `Scene.standIns` so the stage marks the selected one), so the lead's contents are replaced where they are rather than a card sliding across, and the loudest drops into the picked card's slot (the end of the column, for a picked chip). Only the rows move, morphing through their `fan:<i>` slots. A second click folds back to the loudest; a row picks its entity (the fan's ids and `fan:<i>` slots), and the inspector's Open opens the lens, as on the Fan.

**Alternate form — Fan** (the primary from 2026-10-20, RELIC-361, until the Dashboard took the landing). The way to explore view by view. It is the mock's fan, mapped to the five views: the repo, then the four other views as cards, then the open view's lenses on an arc.
- **View cards** (`view:<group>` marks, a new entity kind). They are `card` marks with a size (260×84 world units), drawn by the label layer as the box itself: the canvas draws nothing for a card, and its DOM label is sized to the card and scaled with the view (text and all, further when the text would outgrow it), so it covers the card exactly at any zoom; at no size (a card morphing into a mark without one) it is a plain label. A card's headline is its loudest lens: the highest grade, ties going to lens-bar order. Its number is set large on the left (`labelLead`, split off the reading's front), the view's name on the right over the lens's name and the rest of the reading (React: Code Health, "9" beside "Risk · files"; Ownership & Risk, "811" beside "Bus Factor · single-owner"), so the number says where it comes from; a reading without a leading number follows the lens's name whole. The label layer scales a card's text down, box and all, when a long caption outgrows it. The open view's card is filled with the accent; a loud one (grade 2 and up) not open has its number in accent; a calm one stays grey. The selected card gets an accent outline (and Glow's selected glow) unless it is the open one, whose fill already marks it, and while a lens is previewed the other cards dim with their marks. When every lens in the view is grade 0 the card shows its first lens's reading (React: Team & Activity, "40" beside "Contributors · ghosts of 77").
- **Links** are S-curves between ports (invisible `port:` marks, outside the entity kinds, so they can't be hit): trunks from the repo's right edge to each card's left edge, branches from the open card's right edge to its lenses, so no link crosses a card. A faint dashed orbit (`orbit:repo`, a dashed circle guide) rings the repo and follows it when it tucks.
- **Which view is open.** The loudest view (the highest top grade, ties going to rail order; React: Code Health, tied with Ownership & Risk at 3). Clicking a card fans its lenses instead. The open view is the selection: `s=view:ownership-risk`, or `s=analyzer:<preset>` for one of its lenses, whose group says which view is open. The loudest view is the default and stays out of the URL.
- **Lenses** sit on an arc right of the open card's edge (centred on the stage's middle, so a view at the bottom keeps its lenses on screen) in lens-bar order, sized and heated by grade (the risk ramp; labels name over reading, the reading in accent when the lens badges).
- **Clicking a lens is the fan-out grammar every lens uses.** The other lenses and views dim and its `lensTopEntities` fan out of its dot on an arc pointing away from the lens arc's center, with the ids the lens's own view uses. The tree slides left (and, near the arc's ends, up or down, so the lens's fan stays on screen) and the repo tucks to the edge to make room, placed from the shifted cards' left edge (64 units from its own edge) so its orbit clears every card and the trunks still curve into them. A second click folds it back (to its view; a fanned file folds to its lens). The inspector's Open opens the lens and carries those marks into it; Back reverses each step. Switching lens, or view, morphs rather than folding and regrowing: fanned entities (`fan:<i>`), the open view's lenses (`lens:<i>`), their branches and the card's port out are slots, so the new fan or arc takes the old one's places on screen and glides to its own (extras grow or fold), and the open card's fill crossfades to the new card.
- **Inspector.** View mode: the view's name, its headline, a line on what the view covers, and its lenses loudest first. Lens mode: the reading, its reason, what it measures, the fanned list, and Open.
- *Why not the Tree* (board E: all four views open, quiet lenses folded into "+N quiet"): it had the better feel, but with every view open it crowded the stage. The Fan keeps one view in focus.

Checkpoint boards: D and E on the checkpoint canvas, on React's last 12 months through scene's own `lensReadings` and `lensTopEntities`.

**Dropped form — Ring** (the primary from 2026-10-18 until RELIC-361, then the alternate; removed 2026-10-21, RELIC-368). Every lens on an ellipse round the repo, grouped by view, sized and heated by grade. It was the only picture of every lens at once, but too much for a home page: twenty dots, most of them grey, to answer one question the Dashboard answers in its lead.

**The fan-out (the Fan's click behavior; the Dashboard's lead is its equivalent).** Clicking a lens dims the others and fans its top entities out of its dot on an arc, each labeled (e.g. Bus Factor's most at-risk files with their owners). A second click folds it again (RELIC-367). The inspector's Open opens the lens: the view moves to it and those same marks fly to their places in the lens's layout, because they keep their entity ids. Back reverses it. The preview is the first frame of the real view. This replaces the mock's fan as a separate picture.

**Planned alternate — Briefing** (not built; a third form only if it still earns one at its PR). A short list of findings across lenses; picking one re-forms the canvas around the files and people it names (e.g. the ten people who edited all seven `ReactFeatureFlags` forks, four of them ghosts). *Passes the checkpoint test:* it shows how findings connect across lenses and which entities they share — a different structure (finding → entities graph), which neither the Dashboard, the time strip, the inspector chart nor the detail table can show.

**Findings** (inspector): the loudest outlier stated in plain language, naming entities as chips. Dashboard and Fan: the loudest view (the one the Fan opens on: highest top grade, ties to rail order) stated in plain language ("who owns the code: 63% of files lean on one author, 39 of 77 contributors went quiet"). Briefing: one card per finding, across lenses.

**Tooltips** (added with the drawer PR): a lens dot shows its name, reading and the reason it's graded; a fanned entity shows its name and its value in that lens.

**Dropped from classic:** the treemap hero and its six alternate heroes (ownership, coupling, commit-graph, scatter, timeline, swimlanes) — each is, or will be, a lens of its own; the metrics strip, whose numbers come back as the Dashboard's vitals, as context rather than findings; the overview's bottom tabs, which open their own lenses.

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
- **Clicks:** a second click on the selected mark folds it, in every lens (RELIC-367; until then a second click on a lens opened it). Opening is the inspector's Open, in Atlas if the lens has a view, otherwise in classic.
- **Camera:** when a scene's extent changes (a fan opens) and the viewer hasn't panned or zoomed, the stage glides to frame it, alongside the marks.

Stale Files has no outlier rule: its count is every file untouched in the window, which measures the window, not decay. Its checkpoint defines a real one.

**Next:** Briefing, the planned alternate, ships in its own PR with its findings engine (if it still earns a form; see the forms comparison planned after RELIC-361).

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

**Before building (core, RELIC-343) — done.** Each `CursedFile` carries `breakdown` (`{ kind, label, points }` per reason, in `reasons` order; `kind` is `churn`, `ownership`, `authors`, `abandoned`, `fixes` or `parallel`). The points sum to the uncapped score, so `curseScore` is that sum capped at 100. `CursedFilesReport` adds `threshold` (50) and `nearMisses`: files scoring 40–49, highest first, at most 20, bot-driven ones dropped. Near misses come from the same candidate set as cursed files (top churn, critical bus factor, files fixed more often than chance — Shame's leaderboard until RELIC-359 — and parallel hot files), so a file outside those never appears. On React's last 12 months that's three: `ReactFizzServer.js` and `ReactFiberConfigDOM.js` at 45 (churn 35 + many authors 10) and `ValidateExhaustiveDependencies.ts` at 45 (churn 15 + ownership 30). `cursedFiles` is 7.2 KB of a 9 MB report.

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
- **Layout** is `layouts/funnel.ts`. x is log scale from the smallest rated size; y is the rate up to the next 10% above the highest dot or the band. The band is one `bar` mark per size (sampled past 80 sizes) up to `allowed / n`, with its edge drawn as steps: the boundary is a whole number of fixes, so it jumps where chance allows one more (on React, at 24 changes). Dots take the risk ramp by tier; above-chance files are named. The floor packs files with no fix into small columns under the axis. The unrated count is the x axis title's second line (`labelSub`), centred with it (not the caption, which is static text); the y axis title starts at the plot's left edge. Both were loose notes at first and read as randomly placed. Bounds are fitted to what's drawn.
- **Fix chain.** Selecting a rated file narrows the plot to 40% and draws its commits on a lane over the repo's window: fixes as accent rings, the changes they repaired on `--risk-3`, others `--soft`, changes too recent to rate at 0.35, and an arc from each listed fix (core lists at most five) to each cause it shares the lane with. Commits are matched by 12-character hash: `CommitLike` gained an optional `hash`. Links carry no tooltip in the scene model, so the arc's text is on the fix's ring instead (its subject, date and the changes it repaired). `needsCommits` is true, so the lens waits for the commit index like Rhythm.
- **Inspector.** Lens mode is `FixRateCard`: the count above chance of those rated, the finding, the five most-fixed files, and the table link. A selected rated file's Activity card says how many of its changes needed a fix and lists its fixes (date, revert tag, subject, as text).
- **React (last 12 months):** 55 rated, the three above chance named; the band steps from 12.5% at 8 changes down to 5% by 23, then back up to 8% (two fixes allowed) at 24.

### Team & Activity › Contributors (checkpoint 2026-10-21, RELIC-351)

**Input:** `apps/docs/analyzers/contributors.md` (its three questions: who is still active, where velocity concentrates, whether the team is renewing), classic's Swimlanes hero, Ownership bubble alternate and roster table, React run in classic. Canvas: three boards on React's last 12 months (A Flow, B Lanes, C Field).

**What it must communicate:** who does the work and in which code; who arrived, who left, and what they left behind.

**What React shows** (534 commits, 77 people): a long tail (41 people made one commit; the top 10 made 74% of commits); teams visible as islands (Savona, lauren and Cabiedes work almost only in `compiler/*`; Lesiutin and Silbermann carry devtools; Silbermann is the generalist, 56 packages); departures with dates (Markbåge stops in January, Hanlon in March, Savona in February; Sophie Alpert is one month in July). The canvas boards were drawn before statuses were measured from the analyzed commit (below), so they show 11 active and 40 gone where the lens will show 34 and 22.

**Primary form — Flow.** The 14 people with the most commits on the left, the 11 packages (`packageOf`) with the most commits on the right, and an "N others" node on each side for the rest. One ribbon per person and package, as wide as that person's commits touching it (a commit touching two packages counts once in each). Ribbons take the person's status: active `--soft`, quiet `--risk-1`, gone `--risk-2`, the others' node `--ghost`. Each package names its commits and people, and, when at least half its commits came from people no longer active, that share in the risk colour. *Selecting a person:* their ribbons take the accent, the rest fade, packages they never touched dim, the others show that person's count, and the time strip lights their weeks (as it already does for any selection). *Selecting a package:* its ribbons light, and the people who touch it stay lit.

**Alternate form — Lanes.** The same people as rows (plus the others' row), their commits week by week over the time strip's weeks, on one square-root height scale, coloured by status. Two guides mark the cutoffs: "active" (a last commit right of it keeps someone active) and "gone" (a last commit left of it makes them gone). The right column says the status and when the last commit was. Past 104 weeks the bins are months, as in Churn's Rhythm. *Passes the checkpoint test:* the time strip shows one selection's weeks; the lanes show everyone's at once, which is where arrivals, departures and handoffs read. Needs commits (`needsCommits`), like Rhythm.

**Constancy:** each person is the same `person:<email>` mark in both forms (the left node in Flow, the start of the row in Lanes), so switching form morphs people into rows.

**Tooltips:**
- Person: name, commits, status and last commit ("quiet · last commit 66 days ago"), top three packages with counts, files owned.
- Package: commits, people, how its commits split across active, quiet and gone people, its top person.
- Ribbon: "Joseph Savona → compiler/packages · 53 commits". Links carry no tooltip in the scene model yet (Fix rate put its arc's text on the ring); this lens adds an optional `Link.tip`, since the hit test already picks links.
- Week bar (Lanes): the week, the commits, and the package most of them touched ("Week of 2 Mar · 5 commits · mostly react-reconciler"). Clicking a bar selects its person (`selects`), so the lens needs no `week:` selection; that open item stays with Commit Timing.

**Findings** (lens mode): departed carriers ("2 of the top 10 are gone: Markbåge and Cabiedes; 53 commits, 30 files still theirs"); packages left behind (at least half the window's commits by people no longer active; none on React, where the most is `react-native-renderer` at 37%); the long tail and top-3 share; newcomers in 90 days.

**Status is measured from the analyzed commit** (core change, before the lens). Contributors, Ghost Files, Age Map and Cursed Files take "now" from `Date.now()`, so a report on an older commit (React's checkout ends 2026-08-14) judges every date against the day it ran: classic's React run near that date said 14 active and 39 ghosts, a run on 2026-10-21 of the same commits says 11 and 40, and measured from the analyzed commit it is 34 and 22 (ghost files 97 → 41). The inspector's `personFacts` already measures from the last commit (`reportNow`), so the two disagree. All four move to the analyzed commit's date (the runner's `lastCommit`), which makes a report reproducible. A repo nobody has touched in a year now reads as such through its last-commit date instead of every person turning ghost. Cursed Files drops its idle-days correction, which existed only to undo Age Map's clock. Classic's roster dates "Last active" from `reportNow` to match. *Not changed:* the CLI's default `--since "12 months ago"` is still counted from today, so an old checkout's window narrows as the calendar moves (a separate ticket).

**Table:** every contributor: name, status, commits, files owned, lines changed, first and last commit, top packages; most commits first, tiered by status.

**Dropped from classic:** a colour per person (status carries the meaning instead); a dot per commit (weekly bars and their tooltips are enough); the Ownership bubble chart (Flow answers who works where; ownership per file is the Ownership lens); the KPI strip (its numbers go to the lens-mode card, and active contributors already sit in the Overview's vitals). Board C, the field (commits against time since last commit), isn't built: its insight, carriers who left, is the first finding.

**As built (Flow, RELIC-351):**

- **Data** is `contributors/flow.ts`: `contributorFlowOf` (memoised per report and commit list) counts each person's commits per package (`packageOf`), keeps the top 14 people (`FLOW_PEOPLE`, the report's order) and 11 packages (`FLOW_PACKAGES`), and folds the rest into the others' nodes so both sides carry the same total. A package's `byStatus` splits its commits by the author's status; `LEFT_BEHIND_SHARE` (0.5) flags it. Needs the commit history (`needsCommits`), like Rhythm.
- **Bands, not ribbons.** Links gained `ends` (each end's offset from its mark's centre) and a `band` curve: an s-curve whose width is measured vertically, so bands stacked along a node meet edge to edge through the bend. The tapered ribbon (Root causes) would have pointed every band at a node's middle. Each node's bands stack in the other side's order. The link hit test follows the drawn curve now (it measured to the chord, which an S-shaped band never touches).
- **Link tooltips.** `Link.tip` shows by the pointer when the pointer is on a link and no mark; links still select nothing.
- **Hover lights a node's bands** (review with the maintainer: "beautiful, but with so many lines it's hard to follow who did what"). A scene sets `hoverLinks`; while the pointer is on a mark, the stage draws its links at 0.75 or more and the rest at 15% of their alpha (`FOCUS_LIT`, `FOCUS_FADE` in `linkGeometry.ts`). A drawing change only: the scene isn't rebuilt per hover.
- **Names are clickable, in every lens.** The label layer takes no pointer events, so a click on a name fell through to the empty canvas and cleared the selection; only the 8-unit bar took it. The stage now asks `LabelLayer.hit` after the marks, so hovering or clicking a shown label is its mark.
- **Packages are ordered by their people:** the commit-weighted mean place of the drawn people committing to them (Root causes' barycenter), the others' node last. On React it moves devtools up beside Lesiutin and Silbermann and shortens Savona's band to `compiler`, but Silbermann commits to nearly every package, so his bands still cross the picture: hover is what reads them.
- **"Gone"** is the status's name everywhere (the person card said "Gone quiet", too close to "Quiet", a different status).

**As built (Lanes, RELIC-351):**

- **Data** is `contributors/lanes.ts`: the Flow's people (`contributorFlowOf`) as rows plus one row for everyone else, their commits per bin, and per bin the package most of them touched (for the tooltip). Bins are `time/bins.ts` `timeBins`, pulled out of Rhythm so both forms share them: Monday-start UTC weeks, months past 104. `statusCutoffs` mirrors core's windows (a quarter and a half of the history's span, at least 90 and 180 days, back from the last commit); keep the two in step.
- **Layout** is `layouts/lanes.ts`. Each person keeps their `person:` mark, a bar at the start of the row (the Flow's left node), so switching form moves people into rows; the others' row keeps `flow-others:people`. Rows (`lane-row:`) and week bars (`lane:`) select their person, so a click anywhere on a row picks them, and no `week:` selection was needed. A status column at the right (`lane-status:`) says the status and last commit, the gone ones in the `atlas-label--hot` role. The cutoffs are guides with their names under the rows, drawn only inside the window. The picture is about twice as wide as it is tall (`WIDE`), wider than the world when it has to be, with bounds hugging it, so a fit fills the stage as the Flow does.
- **Legibility follow-up** (review with the maintainer: two global lines read as if they said something about each person, where classic marked each ghost's row at their last commit). The lines became a **zone ruler** under the rows (`lanes-zone:`: gone, quiet, active, each named with its dates, the gone zone in the `atlas-label--hot` role) with faint guides carrying its edges up; anyone not active gets an **end mark** at their last commit (`lane-end:`, selecting them, its tooltip the date and why they're gone or quiet), and their row's background stops there.
- **React (last 12 months):** Markbåge's row stops in January, left of "gone"; Hanlon's in March, between the lines (quiet); Savona's thins out after February but a June commit keeps him right of "active"; Sophie Alpert is a burst in July.
- **Layout** is `layouts/flow.ts`: columns at 17% and 83% of the world (at a third and two thirds the picture was nearly square, so a fit on the wide stage left its sides empty), nodes as `bar` marks (`person:`, `dir:`, `repo` for the root; `flow-others:people` and `flow-others:packages` are layout-only). Each node gets a slot of at least 40 world units, its bar centred in it, so two-line labels aren't culled on thin nodes (on React they were, for the five smallest people at 30). One scale `k` for both sides is settled after the slots take their room. Bands of people no longer active are drawn stronger than active people's. A selection dims what it doesn't reach to 0.55, over the label floor, so dimmed nodes keep their names. A flagged package's second line uses the `atlas-label--hot` role.
- **Inspector (lens mode):** `ContributorsCard`: the active count of all, the findings (the packages-left-behind one once the history has loaded: the inspector now takes `commits`), the five people with the most commits and their status, and the table link.
- **Table:** focus areas (the report's, two directories deep) instead of top packages, since the table is built without the history. Tiers: active, quiet, gone, gone but still owning files.
- **React (last 12 months, statuses from the analyzed commit):** 34 of 77 active. Silbermann spreads across nearly every package; Savona's band runs almost entirely into `compiler`; Markbåge's and Cabiedes' orange bands run into the reconciler and the compiler. No package reaches the left-behind bar.

### Team & Activity › Parallel Dev (checkpoint 2026-10-22, RELIC-371)

**Input:** `apps/docs/analyzers/parallel-dev.md` (files where two or more people commit in the same week; Meneely & Williams link concurrent work to defects), classic's Distribution histogram and monthly Trend, React run in classic. Canvas: three boards on React's last 12 months (A Pairs, B Collision lanes, C Matrix).

**What React showed: the score was mostly sweeping commits.** Of 426 raw (file, week) collisions, 327 came from commits touching more than 20 files: December's spike is a 175-file compiler fix, its revert by someone else and its re-land; June's is the 461-file Rust port and a 330-file Flow bump. Classic's top files had 3 active weeks (the floor) with 1 or 2 shared: `Cargo.lock` and test fixtures. Without sweeping commits, bots and non-source files, 99 collisions on 53 files remain, 37 of them single overlaps; what's left is real: the feature-flag forks (Churn's lockstep family), `ReactFiberWorkLoop.js`, `ReactFlightClient.js`, and pairs of people who keep landing on the same files.

**Core first (RELIC-371, its own PR).** `analyzeParallelDev` leaves out commits over `SWEEPING_COMMIT_FILES` (20, Fix rate's rule), bot commits (`classifyAuthor`) and non-source files (the runner's file classes), and reports how many commits it left out (`leftOut`). A file needs `MIN_COLLISION_WEEKS` (2) collision weeks to be listed, replacing the score floor of 20. `parallelScore` keeps its formula on the cleaned data, so classic and Risk keep working. New: `pairs` (two people, the distinct **weeks** they shared a file, not file-weeks, and the files they shared most) and each file's `windows` (every collision week, oldest first). On React: 16 files, none at 70+; Liebau + Silbermann lead with 4 weeks; Lesiutin + Hanlon fall from 15 file-weeks to 2 weeks (one flag change across eight forks counted eight times). Risk gains `ReactFiberConfigDOM.js` (its two real collisions now score 20+, worth Risk's 5 points: 50, cursed).

**Primary form — Pairs.** People around a circle (`person:` marks, so people travel from Contributors), a chord between two people as wide as the weeks they collided, people sized by their collision weeks and coloured by status. Hovering a person lights their chords (`Scene.hoverLinks`); selecting one keeps them lit and lists who they collide with and on which files. Answers who has to coordinate with whom.

**Alternate form — Collision lanes.** The files people collided on most as rows (a lockstep family as one row: "ReactFeatureFlags (8 files)"), weeks across on the time strip's weeks, each collision week a stack of dots, one per person, in their status colour. Answers where and when. *Passes the checkpoint test:* the time strip shows one selection's weeks and the table lists totals; neither shows which people met on which file in which week.

**Dropped:** classic's score histogram (a distribution, the inspector's job, and of a score that was mostly noise) and its monthly Trend (the time strip); board C, the matrix (exact, but a table: the detail table covers it).

**As built (Pairs, RELIC-371):**

- **Data** is `parallel/pairs.ts` (`parallelPairsOf`, memoised per report), read from core's `parallelDev.pairs`: no commit history needed, so the lens draws with the lite report. Up to 24 people (`PAIR_PEOPLE`) by the sum of their pairs' weeks (a size, not a count of weeks: a week shared with two partners counts twice), and only pairs between them; anyone left without a pair there is dropped, so no dot is drawn without a chord (on React, "dan", whose only partner fell outside the cut: 23 people). When the cut would split every pair (many separate one-week pairs), whole pairs are seated instead, most weeks first, so the circle is never empty while pairs exist (from the bot's review of #151). Circle order is greedy: the most-colliding person, then each time the person tied most strongly to those placed, so partners sit together.
- **Layout** is `layouts/pairs.ts`. An **ellipse**, 1.45 times wider than tall, with people spaced **evenly by height** down the right half and back up the left. A circle with even angles bunched people near the top and bottom, and on React four names were culled there. Names sit beside their dots (right half right, left half left). Chords are `arc` links bowed toward the centre (`bow` signed by which side of the chord the centre is), as wide as the pair's weeks, with `Link.tip`; the scene sets `hoverLinks`. A selected person's chords take the accent, people they never met dim to 0.55 (over the label floor), and each partner's second line says their weeks together.
- **Tooltips:** a person: partners and status, then their top three partners with weeks. A chord: the two people, their weeks, the files they shared most.
- **Pairs aren't selectable.** A chord selects nothing (links never do); the inspector's pair list makes each name a chip that selects that person.
- **Inspector (lens mode):** `ParallelDevCard`: the number of pairs, the findings (top pair and files; the file with the most weeks of 2+ people and its lockstep family; what was left out), the six pairs who meet most, and the table link.
- **Table:** the files with two or more collision weeks, most weeks first, tiered by core's score tiers. A **People** column (asked for at review: "what files are they, and who?") names who met on each file from its `windows`, most collision weeks first, three by name then "+N"; the filter matches every name, so a person's files are one word away. On React the flag forks read "Ruslan Lesiutin, Jack Pope, Rick Hanlon +4".
- **React (last 12 months):** 45 pairs. Silbermann has 13 partners; the right half holds the group around him (Liebau, Lesiutin, Pope, Hanlon, Markbåge, Story); the gone people and one-off pairs sit on the left.

**As built (Collision lanes, RELIC-371):**

- **Data** is `parallel/collisions.ts` (`collisionsOf`, memoised per report), read from each listed file's `windows`: no commit history needed. Bins are the time strip's (`timeBins` over the history's first and last commit). Files that nearly always change together share a row: union-find over coupling pairs among the listed files with Root causes' family rule (`FAMILY_STRENGTH` 75% of the busier file's commits, over `FAMILY_COMMITS`, via its now-exported `together`), drawn as the member with the most collision weeks and named with `familyName`. Churn's stricter lockstep rule left three flag forks as rows of their own on React. Each bin stacks everyone across the row's files, most involved first. 14 rows (`COLLISION_ROWS`), the rest counted for a "+N more in the table" note.
- **Layout** is `layouts/collisions.ts`, shaped like Contributors' Lanes (about twice as wide as tall, quarter ticks). A row is its file's `file:` mark (family members stand in on it, so table rows light it) with a row bar that selects the file; each person in a collision is a layout-only dot that selects them (`selects`). A selected person's dots take the accent everywhere and the rest fade to 0.3; a selected file keeps its row at full strength.
- **Tooltips:** a dot: the person, the week and their status, and who else was on the row then. A row: its name, its package (a family: its files, one per line, up to eight then "and N more": asked for at review, since `ReactFeatureFlags.*` said how many files but not which), its collision weeks.
- **The hot-file finding** now counts the family members in the lanes ("one of 7 files that change together"), so the inspector and the stage agree.
- **React (last 12 months):** 10 rows. `ReactFeatureFlags.*` (7 files, 7 weeks) leads, with its collisions bunched in January and February; `ReactFiberWorkLoop.js` is spread across the year; `ReactFeatureFlags.www-dynamic.js` stays a row of its own (the dynamic forks sit out most flag changes, as Churn found); gone people's dots sit early (Markbåge's, Cabiedes').

### Team & Activity › Commit Timing (checkpoint 2026-10-22, RELIC-352)

**Input:** `apps/docs/analyzers/commit-timing.md` (when does this team work, and is anyone grinding), classic's Punch Card and monthly Trend, its "stressed contributors" panel, React run in classic. Canvas: three boards on React's last 12 months, author's local time (A Week clock, B Punch card, C Packages against chance). The lens inventory had already asked for the code framing ("this module changes at 2am"), not people.

**What React showed.** A healthy team: 10.2% of commits off-hours (late night 11pm–5am, or weekend), two thirds on weekdays 9am–7pm, busiest at Monday noon and 4pm, across 17 UTC offsets (mostly Europe and the US; 29 commits carry a bare UTC offset, which may not be the author's real local time). Classic's per-file stress was noise: every top "stressed" file had 3 or 4 commits, mostly tests; its people panel led with someone at 7 commits. Asked of packages against the repo's rate (Fix rate's test), it has an answer: `react-server` changes off-hours more than chance explains (17 of 76, 22%; 14 of those 17 on weekends), `react-dom` just does (17 of 93), the compiler is the most regular (5 of 112), the rest are within chance.

**Core first (RELIC-352, its own PR).** `commitTiming.offHours`: the repo's off-hours rate and, for each package with 10+ commits (`MIN_PACKAGE_COMMITS`), its off-hours commits, what chance allows (`chanceAllows`) and `aboveChance` (Fix rate's `binomialUpperTail` under `CHANCE_TAIL`). Sweeping commits (Fix rate's `MAX_FIX_FILES`) and bot commits are left out of the rate and the counts. Core mirrors scene's `packageOf` (keep in step). On React, with those left out: a 10.4% rate, 19 packages tested, `react-server` (15 of 66) and `react-dom` (16 of 86) above chance, the compiler 5 of 87 (the canvas's 17 of 76 counted every commit). The badge now counts packages above chance of those tested (10% and at least 2; React: 2 of 19, grade 1, no badge), the Overview reads "N% off-hours", and its top entities are packages. Classic's fields stay for classic. Late night is 23:00–04:59; the docs said 11pm–4am and now say 11pm–5am.

**Primary form — Punch card.** Days down, hours across, each cell its commits in the author's local time; weekend rows and late-night columns shaded. Selecting a package lights its hours (needs the commit index's per-commit offset: `CommitLike` gains `tz`). Chosen over the week clock (board A, which the maintainer liked the look of): rings make outer cells bigger, and the outer rings are the weekend, so the clock overstates exactly what the lens is about.

**Alternate form — Packages against chance.** Fix rate's funnel, on off-hours: packages by commits (log) and off-hours share, the band what chance allows at the repo's rate, packages above it named. *Passes the checkpoint test:* the punch card shows when, not which code; neither the time strip nor the table compares each package with chance.

**Dropped:** the "stressed contributors" leaderboard (it frames people, which the inventory ruled out; a person's off-hours share stays on their inspector card); per-file stress (small samples); the monthly Trend (the time strip).

**As built (Punch card, RELIC-352):**

- **Data** is `timing/punchCard.ts`. The repo's grid is core's `repoHourDayMatrix` (every commit). A selection's grid comes from the commit index: `CommitLike` gained `tz` (the author's UTC offset, which the index already stored; `fromRawCommits` parses it), and `localDayHour` gives a commit's local day and hour. `selectionHours` leaves out sweeping commits (`SWEEPING_COMMIT_FILES`, core's `MAX_FIX_FILES`: keep in step) and bot commits, so a package's lit cells add up to core's count. `touchesSelection` matches a file, a directory's files, or the root package (`repo`).
- **Layout** is `layouts/punchCard.ts`: 7 × 24 `bar` cells (`punch:<day>:<hour>`, layout-only), Monday first and the weekend last, painted as a mix from `--cell-base` by log count: working hours toward `--soft`, off-hours toward `--risk-2`, over faint `--risk-2` bands for the weekend rows and late-night columns. A selection redraws from its own grid, its off-hours in the accent and its working hours grey (so on React `react-server` reads as weekends, not nights). A heading card names the selection's commits and off-hours share. `focusKinds` are `dir`, `file` and `repo`; `needsCommits` is true for the selection, though the repo's grid needs only the report.
- **Inspector (lens mode):** `CommitTimingCard`: the off-hours share of the counted commits, the findings (packages above chance; weekdays 9am–7pm share and the busiest hour; the most regular package, when one has 3× the minimum commits and under half the repo's rate), the five packages with the most off-hours, and the table link.
- **Table:** tested packages (core's order), tiers: below the repo's rate, above it within chance, above chance, above chance at twice the rate.
- **Badge.** On React the rule fires: 2 of 19 tested packages above chance is 10.5%, just over its 10% bar (the checkpoint's "no badge" counted the canvas's 25 packages). The maintainer kept the 10% bar (2026-10-22): two packages out of chance is worth a dot. Wider tuning stays with RELIC-354.
- **People, after all** (asked for by the maintainer once the punch card shipped: management wants to see if someone is burning out, "Joe Blow is working every Saturday"). Not the classic leaderboard: a share of commits can't tell one crunch from a habit (React's Josh Story: 6 weekend commits, all one weekend, 1 of 11 active weeks). Core's author profiles now count active weeks, weeks with weekend or late-night commits and distinct late nights (a 1am commit counts toward the evening before), and flag `regularWeekends` / `regularLateNights` at a third of active weeks over at least 6 (`REGULAR_SHARE`, `REGULAR_MIN_WEEKS`; never bots). Selecting a person redraws the punch card from every commit they made (no filters: a mass rename at 2am is still them working at 2am; `selectionRule`). The lens card's "Off-hours, by person" lists every regular (`regularLine`) and then the most off-hours up to five (`offHoursPeople`, `offHoursLine`; only people with 6+ active weeks), so there are always names to select: the first build listed only regulars, and on React, with none, the lens offered no way to pick anyone. A cell's tooltip names who committed in it (`cellAuthorsOf`, the top three: the repo's commits, or the selected package's; none for a person's own hours). It says so when nobody is regular, and carries the caveat (times come from each author's machine; weekends can be a choice; a reason to check in, not a verdict). The person card's off-hours row in every lens became "weekends in 5 of 29 weeks · 6 late nights", warning when regular (older reports keep the percentages). On React nobody is regular.
- **Alternate form — Against chance** (`against-chance`, `layouts/offHoursFunnel.ts`). Fix rate's funnel on packages, its own layout rather than a mode of `layouts/funnel.ts` (that one is built around files and the fix-chain lane; the two share `niceCeil`, `ticksBetween` and scene's `chanceAllows`). x is commits (log), y the off-hours share; the band is one bar per size up to `chanceAllows(n, rate) / n`, its edge drawn as steps; the repo's rate is an accent line, named at its left end (the right end is where the biggest packages are named). Dots are the tested packages (`offHoursPoints`: `dir:` ids, `repo` for the root's files) in the table's tier colours; every package is named, above-chance ones first, then by size, as room allows. Selecting a package rings it (`focusKinds` `dir`, `repo`). The x axis title's second line says what's counted (packages with 10+ commits; sweeping and bot commits left out). No commits needed.
- **React (last 12 months):** 10% of 490 counted commits off-hours; `react-server` (15 of 66) and `react-dom` (16 of 86) above chance; 67% of commits on weekdays 9am–7pm, busiest Monday 4pm. Selecting `react-server` lights its Saturday and Sunday cells: its off-hours are weekends. On the funnel `react-server` sits well clear of the band and `react-dom` just over its edge; `react-server-dom-parcel` (2 of 10, 20%) is within it, and the band runs from about 33% at 12 commits to 17% at 100.

### Team & Activity › AI & Co-authors (checkpoint 2026-10-22, RELIC-372)

**Input:** `apps/docs/analyzers/co-authors.md` (did we adopt AI, when, who uses it; who pairs with whom), classic's three heroes (monthly adoption bars, per-author AI mix, force-directed co-author graph) and its two bottom tabs, run on React and on this repo. Canvas: three boards (A Where AI writes, B Adoption lanes, C Credit web), React's last 12 months beside gitrelic's own history, since React alone barely uses AI.

**What the two repos showed.** React: 18 of 526 human commits AI-assisted (Claude 16, Amp 1, Cursor 1), none before late June 2026, then a few a week from five people. gitrelic: 66% (293 of 443), all Claude, both authors, every commit since October. Low adoption is a reading in its own right, not an empty state: the lens says how much, since when and who, whatever the number. Human pairs on React are sparse and mostly not pairing: 39 of 47 pairs credited once, most from GitHub squash-merging a PR with several authors.

**Core first (RELIC-372, its own PR).**

- The classifier missed two AI tools: Amp (`amp@ampcode.com`) and Cursor's agent (`cursoragent@cursor.com`; the pattern only matched `@cursor.sh`). Both counted as humans, so React's "human pairs" held them.
- The adoption tier read `none` ("No adoption yet") whenever the percentage rounded to 0, even with AI commits (React's whole history: 16).
- A person credited as co-author under a second email became a pair with themselves (Joe Savona + Joseph Savona, Michael Vitousek + mvitousek on React). Co-authors go through the same name merge as authors.
- New: each package's commits and AI-assisted commits (code framing, like Commit Timing's packages), the weekly split for the time strip, and the fix rate of AI-assisted changes against the others, tested against chance (a two-proportion test, since both rates are estimates). The canvas's rough count called gitrelic's gap within chance; core, counting every rated file, finds 80 of 1,095 changes in AI-assisted commits fixed within 30 days against 33 of 695 for the rest (7.3% against 4.7%): above chance. AI commits there are also the newer, faster-moving code, so the lens says the gap is a reason to look, not a verdict. On React 14 rated changes are too few to test.

**Primary form — Where AI writes.** Packages as rows, each a bar as long as its commits with the AI-assisted part in the accent and its share beside it; the time strip, in this lens, splits each week's bar the same way, which carries the adoption curve. Selecting a package lights its weeks; selecting a person redraws the bars from their commits. Answers how much of the code AI helped write, and where. On gitrelic `packages/scene` and `apps/atlas` are 100%; on React every package is nearly grey and `react-dom` leads with 7 of 93.

**Alternate form — Adoption lanes.** One row per person (`person:` marks, so people travel from Contributors), a bar per week, the AI-assisted part in the accent, each row's second line "11 of 111 AI-assisted · since Jun 29". Answers who adopted and when. *Passes the checkpoint test:* the time strip shows one selection's weeks, so it can't compare everyone's start; Contributors' Lanes shows activity, not AI.

**Dropped:** board C, the credit web (people around, AI tools in the middle): on React it is mostly one-off chords from squash merges, so it reads busier than the data is. A person's co-author partners go on their inspector card instead, and the table lists pairs. Classic's per-author mix (the lanes and the table cover it), its monthly bars (the time strip) and its force-directed graph.

**Open:** whether commits *authored* by an agent (`claude[bot]` from the Claude Code GitHub Action, Copilot's coding agent) count as AI-written; today they are dropped with the bots. *Settled by the maintainer:* they count as AI work, kept apart from AI-assisted (core #158).

**As built (RELIC-372):**

- **Name.** The lens is *AI & Co-authors* (classic's *Co-Authors / AI*), leading with the question it now answers; `catalogParity.test.ts` lists it as a deliberate rename.
- **Data** is `ai/packages.ts` (`aiPackagesOf`, memoised per report, from core's `coAuthors.packages`: no commit history needed) and `ai/adoption.ts` (`adoptionLanesOf`, from the commit index). `CommitLike` gained `ai` (0 none, 1 assisted, 2 agent-authored; core's `CommitIndex.ai`, or the scene classifier for raw commits; older indexes read 0). A person's packages (`aiPackagesFrom`) follow core's rules: sweeping and bot commits out of the packages, sweeping ones still in the share.
- **Where AI writes** is `layouts/aiPackages.ts`: up to 18 packages (`AI_PACKAGE_ROWS`) as rows, most commits first, the rest counted for the table. Each row's bar is its `dir:` mark (`repo` for the root's files); the AI-assisted part in the accent, an agent's own commits in a lighter shade (`AUTHORED_PAINT`), both layout-only marks that select their package. Its share at the right; a heading names the repo's share and the tools. No AI draws the same picture, all grey, and the heading says no commit had AI in it. Selecting a package fades the other rows; selecting a person redraws the rows from their commits (`focusKinds` `dir`, `repo`, `person`).
- **Adoption lanes** is `layouts/adoptionLanes.ts`, shaped like Contributors' Lanes: everyone with an AI commit (most first, agents as "Claude (agent)"), then the busiest of the rest, up to 14 (`ADOPTION_ROWS`), the rest counted below. Each week's bar has its AI part from the baseline up. Names are one line (two-line labels culled every other row on React); the right column says the share and since when ("10% · since Jun 29"), or "none".
- **The time strip** in this lens shades each week's commits with AI in the accent, of the selection's commits when there is one, and its caption counts them ("530 commits over 43 weeks · 18 with AI"). This is a general hook: an `AnalyzerView` may declare `strip: { split, label }`. With a split, a selection's weeks light grey rather than in the accent, which means the split here.
- **Inspector (lens mode):** `AiCoauthorsCard`: the share of commits with AI, the findings (how much, since when, which tools; who uses it most; agents' own commits; the package with the most AI among those with 20+ commits, `AI_SHARE_MIN_COMMITS`, since React's 19-commit `fixtures` led at 10; fixes against the rest, warning only when above chance and saying AI commits are often the newest code; human pairs credited once, mostly squash merges), the five packages with the most AI commits, the five people with the most, and the table link. The **person card** in every lens gained *With AI* (their AI-assisted commits) and *Co-authored with* (their most frequent human co-author), where the co-author graph's information went.
- **Table:** every package: commits, with AI, its share, AI-assisted, agent-authored. Tiers are the share (no AI, under 20%, 20–49%, 50% or more), a shape, not a risk.
- **React (last 12 months):** 3% (18 of 526: Claude 16, Amp 1, Cursor 1), the first in June 2026; the lanes are grey until July, then Silbermann (10%, since Jun 29), dan (57%), lauren, Andrew Clark and ronnakamoto light up; `react-dom` has the most AI (7 of 86); 14 rated AI changes, too few to compare fixes; 51 human pairs, 45 credited once. **gitrelic:** 66%, `scene` and `atlas` written entirely with Claude; AI changes fixed above chance (7.3% against 4.7%), with the caveat.

### Code Health › Age (checkpoint 2026-10-23, RELIC-374)

**Input:** `apps/docs/analyzers/age-map.md` (how much of the codebase has gone cold, and where), classic's Age histogram and its two bottom tabs, classic's Stale Files list, both run on React and on this repo. Canvas: https://claude.ai/artifact/BZbdPyhd7rLr9QagKD8Qw4 (A Warm and cold by package, B Strata, C Cold blocks), on React's real file ages beside gitrelic's.

**Holds:** Age Map (`age-map`) and Stale Files (`dead-code`), merged as the lens inventory decided. One lens, *Age*.

**What the two repos showed.** Neither analyzer works on a windowed run, and the default run is windowed:

- **Age Map rates only the files touched in the window.** On React's default run that's 2,339 of 7,009 files. Its tiers are shares of the window (8/33/66%), so "ancient" meant 194 days of a 294-day window, and a file's tier moved with `--since`.
- **Stale Files has no dates.** All 4,670 of its files read `lastCommitDate: 'unknown'`, because it looks them up in Age Map, which never saw them. 3,107 are fixtures.

With real ages (each file's last change in all of history, counted back from the analyzed commit), React's cold source is plentiful but thin: 979 source files (68k lines) unchanged for a year or more, against 1,265 (416k lines) changed within it. One package has gone quiet: `dom-event-testing-library`, 9 files, no change in 3.4 years. 152 cold source files (8k lines) have nobody left who changed them, mostly devtools and `scripts`. gitrelic is 7 months old: nothing in it is cold.

**Tested and dropped: woken files as a risk.** 330 of React's source files changed in the last year after a year or more untouched (`ReactNativeFeatureFlags.js` after 8.4 years). The guess was that changes to forgotten code break more. Fix rate's blame says the opposite: across React's history those changes were later fixed 1.8% of the time (18 of 1,012) against 2.6% for the rest, at 6-month and 2-year gaps too. They are mostly small, deliberate edits. Woken files stay a neutral finding and carry no badge.

**Core first (RELIC-374, its own PR).**

- **Every tracked file gets its real last change.** One more pass over the history before the window (a `utils/git.ts` primitive under `runGit`'s heavy timeout) gives each file untouched in the window its last change and its authors, and each file touched in the window its previous change before it. On a timeout or error the analyzer falls back to the window, as today, and the report says which it used.
- **Calendar bands replace the window-share tiers:** under 3 months, 3–12 months, 1–2 years, 2–4 years, 4 years or more. *Cold* is a year or more. A file's band no longer moves with `--since`, and "a year" is a unit people already use.
- **Orphaned:** a cold file whose every author (sweeping commits left out, as Fix rate does) has made no commit in the year before the analyzed commit. Nobody left changed it.
- **Dormant package:** a package (scene's `packageOf`, mirrored in core as Commit Timing does) of 5 or more source files with no source change in a year. React: `dom-event-testing-library`.
- **Woken:** a file changed in the last year after a year or more untouched, with the gap.
- Fixture and generated files are left out of every count and counted on their own (`fileClasses`); tests are kept and marked, since the stage can show them.
- Stale Files' `deadCode` takes its dates from the new ages, so classic's list stops saying "unknown". Classic's fields stay for classic; `normalizeReport` backfills the new ones and the fixture is regenerated.

**Badge:** the count of dormant packages, firing at one (React: 1). A dormant package has an obvious action (archive it, delete it, or say why it stays) and is rare, which is what a badge is for. Orphaned files are the lens's highlight, not its badge: they overlap Ownership's ghost files, and a count of them would badge most old repos.

**Primary form — Strata.** One lane per package, the packages with the most cold first; every file a dot placed by time since its last change (square-root scale, ticks at 3 months and 1, 2, 4 and 8 years), sized by lines, painted by band. The cold side of the stage is shaded. Orphaned files are ringed in the accent; a dormant package's lane is outlined and its name in the accent. Every file is a `file:` mark, so files travel in from Hotspots and Churn, and selecting one works as everywhere else. Chosen because it shows whether a package's cold is a few old files or a whole layer (`scripts` and devtools have a cold layer; the reconciler is warm with a thin tail), and it is the archaeology picture the product is named for.

**Alternate form — Warm and cold.** A bar per package split at a center axis: lines changed within the year to the left, cold lines to the right by band, the orphaned part hatched at the far end, dormant packages named in the accent. *Passes the checkpoint test:* the strata can't be summed by eye, and the table lists files, not packages; this answers "how much, and where" exactly.

**Tests switch.** Tests are left out by default and a stage switch adds them (a `toggles` mark, `ViewInput.open`), on both forms. The maintainer liked it on the canvas.

**Colors:** no new theme tokens. Each band mixes from `--cell-base` toward `--person`, the oldest brightest, as Commit Timing's cells mix toward `--risk-2`. The accent is kept for orphaned files and dormant packages.

**Findings** (the lens card): the share of source lines unchanged for a year; how many files are cold and how thin they are; dormant packages, each with its action; orphaned files and where most of them are; woken files, with the longest gap and "check that whoever changed it knew it"; how many fixture and generated files were left out. On a repo with nothing cold, each says so and names the oldest file.

**Tooltips:** a file: its path, its last change ("3.4 years ago"), lines, test; if orphaned, who changed it; if woken, the gap. A package (alternate form): lines within the year and cold, by band, orphaned, its newest source change.

**Dropped:** classic's histogram (the strata place every file on the same axis, and the table drawer's band column covers the distribution); the "% Cold" tiers (Healthy to Critical), which judged a mature codebase for being stable; the Stale Files list as its own lens (the table, sorted by last change, is that list, with dates); board C, the treemap (it overlaps Hotspots' By package and loses React's thin cold files to slivers).

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
- **2026-10-20 — Fix rate's lane is spaced by commit order, not time, and repair arcs rise at least 18 units.** *Why:* on React a fix often lands the same day as the changes it repairs (`Pipeline.ts`'s fix and its four causes all on 2026-02-23), so a time axis stacked them into one dot with flat arcs. Months are named where they start; exact dates stay in the tooltips. Links gained an optional `bow` for it.
- **2026-10-20 — Risk's fix-commits reason comes from fix rate.** A file fixed more often than chance earns 20 points (Shame's top tier) and becomes a candidate; Shame's tiers and leaderboard no longer feed Risk. *Why:* Shame's reason never fired on React's risky files, and its score was mostly small-sample noise. On React's year, `snap/src/runner.ts` becomes cursed (ownership 30 + fixes 20) and `Pipeline.ts` a near miss (40).
- **2026-10-20 — Overview lands on the Fan; the Ring becomes its alternate** (RELIC-361, reversing part of 2026-10-18). Four view cards headlined by their loudest lens, the loudest view open, its lenses on an arc; clicking a lens fans out its top entities as before. Views become entities (`view:<group>`). *Why:* the Ring answers "where is this repo unusual" but asks a first-time viewer to read 20 dots at once; the Fan says it in four numbers and one open view. A Tree with every view open felt better but crowded the stage.
- **2026-10-21 — A second click folds; it never opens** (RELIC-367, reversing the fan-out's "second click opens"). In every lens, clicking the selected mark again folds it back one step: an Overview lens to its view (on the Fan) or to nothing (on the Ring), a file picked from a fan to its lens, a Hotspots file's facet fan to the field. Opening a lens is the inspector's Open. A double-click's second click keeps the selection, so a double-click still selects and fits. *Why:* the first click didn't take you anywhere, so a second click reads as undoing it; being pulled out of the view by a repeat click was jarring. Came out of the Overview forms bake-off (dashboard boards F–H on the checkpoint canvas), still open.
- **2026-10-21 — The Overview lands on the Dashboard; the Fan is its alternate; the Ring is removed** (RELIC-368, closing the forms bake-off of RELIC-361). Three dashboards were prototyped on the checkpoint canvas (F, lens tiles by view; G, view panels; H, a bento) and two built in the app: F first, then H. *Why:* H gives the eye one place to land (the loudest lens, with what it points at, and the other outliers beside it) and keeps calm lenses out of the way behind a switch; F's tiles all weighed the same. The Fan stays for exploring view by view. The Ring answered "where is this repo unusual" but needed twenty dots to do it, which the Dashboard's lead says in one card.
- **2026-10-21 — Contributors is a flow of people into packages, with Lanes as its one alternate** (RELIC-351). Weekly bars with tooltips, no per-commit dots. *Why:* the flow is the only picture that ties people to the code they work in, and ribbons coloured by status show which code was left by people who went quiet; lanes show everyone's weeks at once, which the time strip (one selection) can't. A field of commits against time since last commit was tried and folded into the findings.
- **2026-10-22 — Parallel Dev leaves out sweeping commits, bots and non-source files, needs two collision weeks, and counts pairs by weeks** (RELIC-371). *Why:* on React 327 of 426 raw collisions came from commits over 20 files, and classic's leaders were 3-week files and `Cargo.lock`; counting pair file-weeks counted one flag change across eight forks eight times.
- **2026-10-22 — Parallel Dev is a circle of pairs, with Collision lanes as its one alternate.** *Why:* the question is who has to coordinate with whom, which only a people picture answers; lanes answer where and when, which the shared strip and table can't.
- **2026-10-22 — Commit Timing tests packages against the repo's off-hours rate, and is a punch card with the package funnel as its alternate** (RELIC-352). *Why:* per-file stress rated files from three commits, so its leaders were one late commit in a tiny file; a package-level count with Fix rate's chance test answers "which code changes off-hours". The grid reads exactly; the week clock, though it looked best, enlarges the weekend rings.
- **2026-10-22 — Commit Timing's badge stays at 10% of tested packages above chance** (RELIC-352). *Why:* React's 2 of 19 fires it, and the maintainer wants that: two packages changing off-hours beyond chance is worth flagging. Broader badge tuning is RELIC-354.
- **2026-10-22 — Commit Timing names people, by regularity** (RELIC-352, reversing the checkpoint's drop of people). *Why:* the maintainer wants to spot someone working every weekend; regularity (a third of active weeks, over six) separates a habit from one crunch, which a share of commits can't, and only regulars are named, with a caveat that it's a check-in, not a verdict.
- **2026-10-22 — AI & Co-authors shows where AI writes, by package, with Adoption lanes as its one alternate; the co-author graph is dropped** (RELIC-372). *Why:* how much of the code AI helped write, and where, is the question a team lead asks, and low adoption is an answer too; lanes show everyone's start at once, which the strip can't. On React most human "pairs" are one-off squash-merge credits, so a graph of them overstates collaboration.
- **2026-10-23 — The time strip can shade a lens's part of each week** (RELIC-372). An `AnalyzerView.strip` names it; AI & Co-authors shades commits with AI in them. *Why:* adoption is a trend, and trends live in the strip; drawing it there keeps the stage for where and who.
- **2026-10-23 — Age rates every file by its real last change, in calendar bands; Strata primary, Warm and cold alternate** (RELIC-374). Stale Files merges in. The badge counts dormant packages; orphaned cold files are the highlight. *Why:* both analyzers saw only the window, so Age Map's oldest files were missing and Stale Files had no dates; window-share tiers moved with `--since`. Changes to long-untouched files were fixed less often on React, not more, so woken files stay a finding.
