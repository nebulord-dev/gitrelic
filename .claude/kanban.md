# CodeLore — Kanban

> Task board for tracking CodeLore development. Update this file as work progresses.
> Columns: Backlog → In Progress → Done

## Roadmap

Phases run roughly sequentially. Phase 2 can begin once Phase 1 core tests are in place — it doesn't need the full testing suite to be done first. Phase 3 visualizations can start mid-Phase 2 for tabs where data already exists (e.g. shame tab).

```
Phase 1 — Hygiene & Rename     ██████████████████░░░░░░░░░░░░░░░
Phase 2 — Core Analyzers       ░░░░██████████████████░░░░░░░░░░  ← starts mid-P1
Phase 3 — Visual Storytelling   ░░░░░░░░░░██████████████░░░░░░░░  ← starts mid-P2
Phase 4 — Composite Intelligence░░░░░░░░░░░░░░░░████████████░░░░
Phase 5 — AI, CLI & Distribution░░░░░░░░░░░░░░░░░░░░░░░░████████
```

| Phase | Focus                    | Key tasks                                                                                                                                   | Unblocks                              |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **1** | Hygiene & Rename         | Vitest suite, oxc linting, Turbo upgrade, React 18→19, rename to CodeLore                                                                   | Safe refactor in Phase 2              |
| **2** | Core Analyzers           | cloc, hotspot score, coupling map, churn velocity, rewrite ratio, rename tracking, test coverage proxy, dead code candidates, blast radius   | Phase 3 visualizations, Phase 4 composites |
| **3** | Visual Storytelling      | Treemap, hotspot matrix, commit graph, shame tab, file coupling graph, knowledge map, contributor timeline, file drill-down, language panel, repo health tab | Phase 4 dashboard surfaces            |
| **4** | Composite Intelligence   | Onboarding difficulty, ownership drift, knowledge concentration, complexity over time, co-author analysis, risk & learning curve dashboard, technical debt workbench, team dynamics analyzers + tab, solo dev insights | Phase 5 AI narratives                 |
| **5** | AI, CLI & Distribution   | Claude summary, refactor brief, "what happened here?", team narrative, PR risk action, `codelore diff/watch/blame/graph/hotspot/team/debt` commands, `codelore.config.ts`, `codelore init`, badge, share, VS Code ext, HTML export, pre-commit hook | —                                     |

> **Key dependency chains:**
> - `cloc` → `hotspot score` → treemap, hotspot matrix, debt workbench, risk dashboard
> - `coupling map` → file coupling graph, Conway's Law map, debt dependency chains, team boundary friction
> - `churn velocity` + `rewrite ratio` → risk dashboard, debt workbench, team dynamics
> - `onboarding difficulty` + `test coverage proxy` → learning curve surface
> - Phase 4 composite dashboards consume multiple Phase 2 analyzers — they're synthesis layers, not new data collection

---

## Backlog

### Testing & Infrastructure

#### Configure oxc for linting ⏸ ON HOLD
Set up `oxlint` as the linter for the CodeLore monorepo. **On hold:** oxc's React ESLint plugin support is alpha-only as of March 2025 — React linting is important for the web package, so we're waiting until it stabilizes. Revisit when oxc promotes React plugin support to stable.
- Install `oxlint` in the workspace root
- Add `lint` scripts to root and per-package `package.json`
- Configure `.oxlintrc` with appropriate rules
- Integrate with Turbo pipeline (`lint` task in `turbo.json`)
- Fix or suppress any initial violations so lint passes clean
- Document lint command in CLAUDE.md

---

### Smarts & Analysis

~~#### Commit message forensics~~
~~Files with a high ratio of "fix", "hotfix", "revert", "oops" commits are cursed in a different way than high churn. Surface a "shame score" per file based on commit message sentiment.~~
_(Done — see Done column)_

~~#### Hotspot score~~ _(Done — see Done column)_

~~#### `cloc` integration~~ _(Done as LOC analyzer — pure filesystem, no cloc dependency. See Done column)_

#### `git-sizer` integration
Wrap `git-sizer` (GitHub's repo health CLI) to surface repo-level health metrics: largest blobs, tree depth, pack efficiency, history size. Not per-file — this is repo-wide infrastructure health. Add a "Repo Health" tab to the web dashboard. Flags repos with bloated history, giant binary files, or pathological tree structures that slow down git operations.

#### Churn velocity
Is churn accelerating or decelerating? A file with 40 commits but 30 in the last month is more alarming than one spread over 3 years. Track churn rate over time, not just total count.

#### Rename tracking
Follow files through renames so churn/age history isn't lost when someone does `mv auth.ts authentication.ts`. Use git's `--follow` or `--find-renames` to stitch history across renames.

#### Complexity over time
Track lines-of-code per file across commits to show whether files are growing or shrinking. Growing + high churn = compounding risk.

#### "Dead code" candidates
Files that are tracked, never churned, AND old. Not stale — *deliberately* untouched. Either solid infrastructure or forgotten debt.

#### Dependency graph (`madge` integration)
Wrap `madge` to build a static import/dependency graph: which files import which, and where circular dependencies exist. This is *structural* coupling (what the code declares) vs. the coupling map's *temporal* coupling (what git history reveals). The two together tell a complete story — temporal coupling with no import relationship is the most surprising hidden dependency. Surface circular deps as a dedicated warning, and expose the graph data for a force-directed visualization in the web dashboard. Pairs directly with the coupling map analyzer.

#### Parallel development v2: sustained vs. spike detection
Distinguish chronic parallel development (8 of 12 weeks) from one-off spikes (1 intense week). The sustained case is the real Tornhill red flag. Add `parallelPattern: 'chronic' | 'spike' | 'occasional'` classification. Also: configurable `--parallel-window` flag (default 7d, support 3d/14d), commit proximity scoring for finer-grained severity. Design spec: `docs/plans/2026-03-11-parallel-development-design.md` § V2 Roadmap.

#### `--parallel` CLI panel
Dedicated CLI panel for parallel development data (like `--shame` for forensics). Show the parallel dev leaderboard with scores, peak windows, and narratives.

~~#### Coupling map~~ _(Done — see Done column)_

#### Commit timing forensics
When does this team actually write code? Surface late-night commits, weekend commits, and timezone clustering per file and per contributor. A file with 40% of its commits between 11pm–2am is a different kind of red flag than high churn. Could feed into curse scoring as a stress signal.

#### Ownership drift
Track *who* the dominant author is over time, not just cumulatively. A file owned by Alice for 2 years but now owned by Bob for the last 3 months tells a story about knowledge transfer (or lack of it). Especially powerful combined with bus factor data.

#### Onboarding difficulty score
Files that new contributors (first 90 days) never touch vs. files gated to veterans only. The veteran-only files are either the most critical or the most intimidating — useful for onboarding planning and identifying knowledge silos.

#### Blast radius
Which files, when they change, tend to cause changes in the most other files in the same commit? High blast-radius files are the real architectural load-bearers regardless of what the dependency graph says.

#### Rewrite ratio
Track insertions vs. deletions over time per file. High insertions *and* high deletions = lots of rewriting, not just growth. Different from churn — it's "this code never sticks" vs. "this code changes a lot." Good additional signal for curse scoring.

#### "The Ghost Problem"
Dedicated view for files owned >70% by someone whose last commit was >6 months ago. Not just bus factor — specifically "this person left and took the knowledge with them." More actionable than generic bus factor because it identifies the specific risk person.

#### Test coverage proxy
No actual coverage tooling needed — count `*.test.*` files relative to source files per directory. Directories with zero test files alongside high-churn source files are the highest-risk areas. Fast heuristic that pairs well with curse scoring.

#### Release archaeology
If the repo uses git tags for releases, show which files changed most between each release. Some files appear in every release; some only appear when things go wrong. Reveals which files are on the "hot path" of every deployment.

#### Technical debt introduction ("first blood")
For each currently-cursed or high-hotspot file, identify *who* wrote the first commit that started its trajectory — the original author of the now-problematic code. Not to blame, but to identify who holds the deepest tribal knowledge about why it exists. That person is the best person to fix it or document it. Surface as "original author" in the file drill-down.

#### Commit message tone over time
Beyond the static shame score — is the tone getting *worse*? A file with increasing frequency of "fix", "hotfix", "revert" commits over recent months is a codebase in distress right now. Plot shame score over time per file. A rising shame trajectory is more alarming than a historically high but stable one.

#### Knowledge concentration index
Repo-wide: what percentage of files are "single-author dominant" (>80% commits from one person)? High concentration = fragile team. Surface as a top-level health metric alongside bus factor. Useful for engineering managers doing risk assessments before someone leaves.

#### Co-author analysis
Parse `Co-authored-by:` trailer lines from commit messages (standard GitHub/GitLab convention for pair programming and AI-assisted commits). Surface who actually collaborates with whom, which files get pair-programmed, and whether AI-assisted commits correlate with lower or higher future churn.

#### `--since` comparison mode
`codelore --since 30d vs 90d` — compare two time windows to show what's getting better vs. worse. A file that was hot 90 days ago but calm recently is recovering. A file that was fine 90 days ago but hot recently is deteriorating. Directional health, not just snapshot health.

#### Team dynamics & code quality correlation ⭐ PRIORITIZE — NEEDS DEDICATED DESIGN SESSION
Large feature (4 sub-analyzers + 5 web visualizations + CLI companion). Requires its own brainstorming → spec → plan cycle. Depends on churn velocity and rewrite ratio analyzers (being built now).

Analyze how developer and team interactions influence code quality over time. Two parts: the **analysis engine** (core analyzers that extract the signals) and the **visualization layer** (web dashboard views that make the patterns visceral and explorable).

**Part 1 — Core analyzers:**

*Coordination cost analyzer:*
- For each file, partition its history into single-author windows vs. multi-author overlap windows (reuse parallel dev's author-week matrix).
- Compare quality metrics (shame ratio, churn velocity, rewrite ratio) between the two modes.
- Produce a per-file `coordinationCost` score: positive = multi-author work *degrades* quality, negative = multi-author work *improves* quality, zero = no difference.
- Roll up to per-author-pair stats: "When Alice and Bob overlap on a file, shame ratio increases 40%. When Alice and Carol overlap, churn stabilizes." The pair-level insight is where the real value is.

*Team boundary friction analyzer:*
- Cross-reference coupling map (files that change together) with bus factor (who owns each file).
- Flag "Conway's Law violations": coupled file pairs owned by different primary authors (or teams, if team metadata is available via a config or email-domain grouping).
- Score each violation by coupling strength × quality divergence between the paired files. Strong coupling + divergent quality = high friction.

*Author quality fingerprint analyzer:*
- For each contributor, measure what happens to files *after* they touch them in a trailing window (configurable, default 30 days):
  - Does churn velocity increase or decrease?
  - Does shame ratio rise or fall?
  - Does the file gain or lose additional authors?
- Classify each author as: **stabilizer** (files calm down after their commits), **destabilizer** (files heat up after their commits), or **neutral**.
- Sensitive data — gate behind a `--team` flag so it's opt-in, never shown by default. Frame as team health, not individual blame.

*"Too many cooks" threshold analyzer:*
- For each file, correlate distinct-author-count-per-window with defect proxy signals (shame ratio, fix-commit frequency, rewrite ratio).
- Find the inflection point where adding more authors starts degrading quality. Some files handle 3 authors fine but fall apart at 5. Surface the per-file "safe author count" — the number of concurrent contributors before quality degrades.
- Repo-wide stat: "Files with 4+ authors in a 30-day window have 2.3× the shame ratio of single-author files."

**Part 2 — Web dashboard: "Team Dynamics" tab:**

*Collaboration health matrix:*
- Grid visualization: authors on both axes, cell color = quality impact when that pair works on the same files. Green = stabilizing pair, red = friction pair, gray = never overlap. Immediately shows which collaborations are productive and which create churn. Click a cell to see the specific files and time windows driving the score.

*Conway's Law map:*
- Force-directed graph: nodes are files (or directories), edges are coupling strength. Nodes colored by primary owner. When coupled files have *different* owner colors, the edge glows red — that's a boundary friction point. Visually reveals where the team structure and the code structure are misaligned. The "aha moment" visualization — teams see their own organizational problems reflected in their code.

*Author impact timeline:*
- Horizontal swim lanes per contributor. Each lane shows a sparkline of their "stabilizer score" over time — are they currently in a stabilizing or destabilizing phase? Overlaid with markers for significant events: joined a new area of the codebase, started overlapping with a new collaborator, touched a cursed file. Tells the story of each contributor's *relationship* with the codebase over time, not just their commit count.

*Team quality pulse:*
- Aggregate dashboard card: team-wide coordination cost trend (is multi-author work getting smoother or rougher?), current Conway's Law violation count, percentage of files past their "safe author count" threshold, and a sparkline of overall team quality trajectory. The single-glance "are we getting better at working together?" metric.

*Friction hotspot overlay:*
- Toggleable layer on the existing treemap/knowledge map: files colored not by churn or ownership but by *coordination cost*. High coordination cost files in red = "this file creates friction whenever multiple people touch it." Different insight than hotspots — a file can be low-churn but high-friction when it *does* get touched by multiple people.

**CLI companion — `codelore team [--pairs] [--friction] [--fingerprints]`:**
- `codelore team` — summary: top friction points, worst coordination costs, Conway's Law violations.
- `codelore team --pairs` — author-pair quality matrix in the terminal.
- `codelore team --friction` — ranked list of boundary friction files.
- `codelore team --fingerprints` — per-author stabilizer/destabilizer classification (opt-in, requires `--team` flag on the main scan).

---

### Solo Developer Insights

A suite of features for single-author repos where multi-author signals (bus factor, parallel dev) are meaningless. Instead, surfaces self-knowledge: your habits, your trajectory, your relationship with your own code over time. All built on existing `RawCommit` data — no new git primitives needed. Full ISO timestamps (`%aI`) are already captured per commit.

#### Personal coding rhythm
Parse commit timestamps to surface when you actually write code: hour-of-day distribution, most productive weekday, night-owl vs. early-bird classification. "73% of your commits happen after 8pm. Wednesday is your most productive day." Genuinely personal data you can't get anywhere else — high "wow factor," great for screenshots.

#### Velocity shape
Commits-per-week over the project's lifetime, charted as a curve. The shape tells the story of the project: initial burst, steady feature building, maintenance plateau, dead period, revival. Solo projects have very recognizable lifecycle shapes. Seeing your own project's trajectory is oddly motivating (or humbling).

#### Project phase detection
Detect what phase the project is currently in based on recent commit patterns: **Building** (new files, feat commits, growing LOC), **Polishing** (high fix/refactor ratio, LOC stabilizing), **Maintenance** (low velocity, mostly fixes), **Revival** (dead period followed by sudden activity). A simple current-phase label is surprisingly useful self-knowledge.

#### Session analytics
Cluster commits within a configurable time window (default: 2 hours) into "sessions." Surface average session length, longest sessions, time-of-day session patterns, and which files tend to be worked on in long vs. short sessions. Gives a feel for how you actually work — sprint-and-commit vs. slow-and-steady.

#### "Files you keep second-guessing"
For a solo dev, high churn means *you* kept changing your mind — no coordination overhead, no other authors. These files are where your design instincts struggled, where the problem was harder than expected, or where requirements kept shifting. Worth surfacing with solo-specific framing separate from the multi-author churn interpretation.

#### Commit message trend over time
Plot the ratio of `fix:`/`hotfix:`/`revert:` vs. `feat:` commits on a per-week sliding window. Are you in a creative/building phase or a firefighting phase right now? A rising fix-ratio trend is a signal the project is under strain. The trend over time is more interesting than the static shame score.

---

### Narrative & AI

#### Claude-powered summary
Pass the full `CodeloreReport` to Claude API and get a 3-paragraph "story of this codebase" narrative. The tool is already named after the concept — lean into it.

#### "What happened here?"
Click any file in the web dashboard and get an AI-generated explanation of its commit history narrative. Per-file deep dive powered by Claude.

#### Refactor brief
For the top cursed file, Claude generates a short brief: why it's cursed, what the likely root cause is based on commit patterns, and what a refactor approach might look like. Actionable output, not just a score.

#### PR risk assessment (`codelore-action`) ⭐ PRIORITIZE
GitHub Action that runs on every PR, looks up the touched files in a cached CodeloreReport, and posts a comment: "This PR touches 2 cursed files and one file owned 90% by someone who hasn't committed in 4 months." Brings CodeLore into the daily review workflow without anyone having to remember to run it. Highest practical value for teams.

#### Commit graph annotation layer
Overlay CodeLore data directly on the commit graph visualization. Hotspot spikes, ownership changes, shame-score events, and bus-factor warnings appear as markers on the graph timeline. The commit graph becomes a *navigable diagnostic surface*, not just a pretty picture. Click a spike on the graph to see which files caused it and why CodeLore flagged them.

#### Team narrative report
AI-generated per-team (or per-contributor) narrative: "Alice owns 60% of the auth subsystem, has been the primary author for 2 years, and her files have the lowest churn in the repo. Bob joined 4 months ago and has touched 12 high-hotspot files — either he's doing important cleanup or spreading risk." Designed to be shared in engineering all-hands or team retrospectives.

---

### CLI Commands

#### `codelore diff <branch>`
Compare health between branches or commits. "Since you branched from main, these 3 files have become hotspots."

#### `codelore watch`
Live TUI that updates as you commit. Real-time churn tracking in the terminal.

#### `codelore blame <file>`
Deep dive on a single file: full commit timeline, author breakdown, message forensics.

#### `codelore graph`
Render the commit DAG in the terminal — branch lanes, colored by hotspot severity. Each commit dot is colored by its churn impact. Hotspot commits glow. Wraps `git log --graph` with CodeLore enrichment layered on top. The terminal version of the web commit graph.

#### `codelore hotspot [--top N]`
Dedicated CLI command that outputs the top N hotspot files ranked by the churn × complexity composite score. Separate from the general `codelore` report — fast, focused, actionable. Pairs well with `codelore blame <file>` for drilling in.

#### `codelore team`
Contributor-focused report: bus factor, ghost files, knowledge concentration index, ownership drift summary. Designed for the engineering manager audience rather than the individual developer.

---

### Web Dashboard

#### Commit graph visualization ⭐ PRIORITIZE
The GitKraken-style DAG — colored branch lanes, commit dots, merge lines. Built with `d3-dag` for layout and custom SVG rendering for full control. Nodes colored by hotspot score (cool → hot). Click any commit to see which files changed, their CodeLore scores at that point in time, and the commit message. This is the visual centerpiece of the web dashboard — the thing people screenshot and share. Makes CodeLore immediately legible to anyone who's used a git GUI before.
- Data: `git log --all --pretty=format:"%H|%P|%an|%at|%s" --topo-order`
- Layout: `d3-dag` handles lane assignment
- Render: custom SVG — full control over color, dot size, heat overlays
- Interaction: click commit → file list with CodeLore scores; hover → tooltip with author, date, shame score

#### Hotspot matrix
Scatter plot: X-axis = churn, Y-axis = complexity (LOC), dot size = number of authors, dot color = shame score. Every file in the repo plotted simultaneously. The top-right quadrant (high churn, high complexity) is the danger zone. Instantly shows the shape of the codebase's risk. This is the single most information-dense visualization CodeLore can produce and the one most directly derived from Tornhill's methodology.

#### Shame tab in web dashboard
Add a sixth tab to the web dashboard for commit message forensics. The `forensics` data is already in every `CodeloreReport` — this is purely a UI addition. Show the shame leaderboard (file, shame score, dominant keywords, top offending commit messages) and a summary stat for total shame commits. Mirrors the `--shame` CLI panel but with more room to show details.

#### Knowledge map visualization ⭐ PRIORITIZE
Tornhill-style treemap: files as circles, sized by LOC (requires cloc integration), colored by dominant author (from bus factor data), grouped by directory. Parallel development data overlays as a heat ring or border glow around contested files. Connects "who owns what" with "where is concurrent work happening." Great for onboarding ("who do I ask about feature X?"), knowledge transfer planning, and team health. See screenshot from *Software Design X-Rays* for reference. Design spec: `docs/plans/2026-03-11-parallel-development-design.md` § V2 Roadmap.

#### Treemap visualization ⭐ PRIORITIZE
Directory tree colored by churn/curse score. Instantly see which *parts* of the codebase are on fire. Visually stunning and immediately useful — the single best "wow factor" feature for demos and team presentations.
- Study `git-truck` (open source, Node/React) before building — it solves the same problem and is worth mining for implementation ideas on treemap layout with git data.

#### File coupling graph
Force-directed graph where nodes are files and edges represent "changed together" frequency. Shows the real architecture vs. the intended architecture. Pairs with the coupling map analyzer.

#### Contributor timeline
Horizontal timeline showing when each contributor joined, their peak activity period, and when they went quiet. Makes team turnover and knowledge loss viscerally visible. Great for engineering manager conversations.

#### Timeline chart
Commits over time, stacked by contributor. See when people joined, left, went quiet.

#### Drill into a file
Click any file anywhere in the dashboard to see its full commit history inline. When code snippets are shown, consider `sourcegraph/codeintellify` to add hover tooltips with code intelligence (go-to-definition, type info) — IDE-like feel without building it from scratch.

#### Risk & learning curve dashboard ⭐ PRIORITIZE
A dedicated "Developer Intelligence" view that synthesizes existing analyzer data into two composite lenses — **defect risk** and **learning curve** — and presents them in ways that are immediately actionable, not just informative.

**Defect prediction surface:**
- Quadrant scatter plot (hotspot matrix variant): X = churn velocity (accelerating vs. stable), Y = rewrite ratio (code that doesn't stick). Dot size = shame score, dot color = bus factor risk. Top-right quadrant files are ticking time bombs. Clicking a dot opens a "defect brief" — a timeline showing *when* the file started deteriorating and *what changed* (new author? spike in fix commits? rapid growth?).
- "Deterioration feed" — a reverse-chronological list of files whose risk scores have *worsened* in the last N commits/weeks. Not a static leaderboard — a *news feed* of emerging problems. Inspired by anomaly detection dashboards.
- Per-file "stability spark line" — a tiny inline chart (like GitHub contribution graphs) showing the file's risk trajectory over time. Green = stabilizing, red = deteriorating. Visible everywhere a file name appears — in hotspot lists, cursed file cards, search results. Ambient awareness without clicking into anything.

**Learning curve surface:**
- "Approachability map" — a treemap where each file is sized by LOC and colored by a composite of: contributor count (more authors = more accessible), onboarding difficulty score (do newcomers touch it?), and comment density. Deep red = "here be dragons" (single author, no newcomers, no comments). Green = well-trodden and documented. A new team member looks at this and immediately knows where to start and where to avoid.
- "Knowledge transfer radar" — for each file or directory, show: who knows it (bus factor), who's learning it (recent new contributors), and who *should* learn it (high-risk files with single owners). Presents as a radar/spider chart per directory with axes like "ownership breadth", "newcomer activity", "documentation", "churn stability", "author diversity".
- "First-touch guide" — sorted list of files ranked by approachability (low complexity, multiple authors, low churn, has tests nearby). The opposite of the hotspot list. "If you're new here, start with these files." Generated automatically from existing data, zero config.

**Shared UX patterns:**
- Every visualization links back to the file drill-down — no dead ends.
- Hover any file anywhere to get a one-line risk summary: "High churn, single owner, accelerating shame score — defect risk: critical."
- Dashboard-level summary stats: "12 files are deteriorating, 3 files are knowledge silos, 87% of high-risk files have no test coverage proxy."

#### Technical debt workbench ⭐ PRIORITIZE
A dedicated view that uses *behavioral* signals — not static analysis — to identify, prioritize, and guide remediation of technical debt. Most debt tools tell you what's messy. CodeLore tells you what's messy *and actively costing you time*.

**Debt identification — behavioral signals over static ones:**
- "Costly debt" ranking: files scored by `churn × complexity × (1 + shame_ratio)`. High-complexity files that nobody touches aren't debt — they're fossils. High-complexity files that churn every sprint are bleeding velocity. This is the core Tornhill insight applied directly to prioritization.
- "Debt clusters" — group files by directory and aggregate their debt signals. A single bad file is a refactor. An entire directory of churning, shame-heavy, single-owner files is a *systemic* problem. Surface directory-level rollups so teams think in terms of subsystems, not individual files.
- "Accidental debt vs. deliberate debt" — classify based on commit message patterns. Files with `hack`, `workaround`, `TODO`, `temporary` in their commit history = deliberate debt someone knowingly created. Files with rising churn and fix-commits but no such markers = accidental debt that crept in. Different remediation strategies for each.

**Prioritization — what to fix first:**
- "ROI estimator" — rank debt items by estimated payoff: `(churn_frequency × author_count × shame_trend) / complexity`. High churn + many authors + worsening trajectory + *low* complexity = easiest win with biggest payoff. High churn + single author + *high* complexity = important but expensive. Show both axes so teams can pick quick wins or strategic investments.
- "Debt budget" — given a time budget (e.g. "we have 2 days for debt work this sprint"), auto-select the highest-ROI files that fit within the budget based on estimated complexity. Not magic — just sorting by payoff-per-effort and accumulating until the budget is spent.
- "Debt dependency chain" — using coupling map data, show when fixing one file likely requires touching its coupled partners. A file that looks like a quick win but is tightly coupled to 4 other high-debt files is actually a bigger project. Surface this *before* someone starts the refactor.

**Remediation guidance:**
- Per-file "debt brief" — a structured summary: what kind of debt (accidental/deliberate), when it started accumulating (first shame commit or churn inflection point), who introduced it (first blood data), who knows it best (bus factor), what it's coupled to, and whether it has test coverage nearby. Everything a developer needs to decide whether and how to tackle it.
- "Before/after projection" — for the top debt items, show what the hotspot matrix and deterioration feed *would* look like if those files stabilized. "If `auth.ts` stopped churning, your overall codebase risk drops 15%." Motivational and useful for justifying debt sprints to management.
- AI-powered refactor briefs (pairs with the existing "Refactor brief" backlog item) — for each top-debt file, Claude generates a specific remediation plan based on the behavioral evidence: "This file has been rewritten 4 times in 6 months by 3 different authors. The commit messages suggest the API surface keeps changing. Consider extracting a stable interface."

**CLI companion — `codelore debt [--budget 2d] [--top N]`:**
- Quick terminal output: ranked debt list with ROI scores, estimated effort, and one-line summaries.
- `--budget` flag auto-selects what fits in a time window.
- Feeds into the web dashboard for the full interactive experience.

#### Repo health tab
Top-level health dashboard powered by `git-sizer` integration. Blob sizes, history bloat, pack efficiency. The "infrastructure layer" complement to the code-behavior metrics everywhere else in Lore. Green/amber/red status indicators. Something you'd check once when onboarding to a new repo.

#### Language breakdown panel
Visual breakdown of what the repo is made of — languages, LOC per language, file count per language — powered by `cloc` integration. Surprisingly absent from most git analytics tools. Immediately useful context for everything else on the dashboard.

#### Hotspot score leaderboard
Dedicated panel showing files ranked by the churn × complexity composite. Not just cursed files — specifically the Tornhill hotspot formula. Separate from the existing cursed file view because the formula and interpretation are different. Most engineers will understand "high churn AND high complexity = problem" immediately.

---

### Polish

#### Ignore list config (`codelore.config.ts`)
Make the ignore list configurable via a `codelore.config.ts` file (extends the built-in defaults). Pairs with the existing "ignore list" backlog item.

#### Pre-commit hook warning
When committing to an already-cursed file, warn the developer: "⚠ auth.ts is a cursed file (score: 78/100). Proceed?" Tiny integration surface, high signal value. Installable via `codelore install-hook`.

#### `codelore badge`
Generate a health badge for your README (like coverage badges). Quick visual indicator of repo health.

#### Export as HTML (`codelore --format html`)
Dump a standalone self-contained report HTML file you can share — no server needed. No dashboard, no server — just a file you can email or drop in Slack.

#### `codelore init` setup wizard
Interactive first-run wizard: detects repo age, suggests appropriate `--since` window, asks if you want the pre-commit hook, generates a `codelore.config.ts` with sensible defaults. Removes the "now what?" moment after install.

#### VS Code extension
Surface CodeLore scores inline in the editor — hotspot severity as a gutter indicator, shame score in the file tab, bus factor warning when you open a ghost file. Passive ambient awareness without running the CLI. The eventual distribution channel that gets CodeLore in front of the most developers with the least friction.

#### Shareable snapshot (`codelore share`)
Generate a static snapshot of the current `CodeloreReport` as a hosted URL (or self-hostable JSON + HTML bundle). "Here's the codelore of our repo as of today" that you can share with stakeholders who don't have git access. Privacy-aware: strips author emails, optionally anonymizes contributor names.

---

## In Progress

_(nothing right now)_

---

## Done

### Parallel development analyzer
Detects temporal concurrency per file — multiple authors committing in the same calendar week. Uses author-week matrix approach with severity-weighted scoring (`max(1.0, min(avg_authors/2, 2.0))`). Produces standalone `ParallelDevReport` on `CodeloreReport` and feeds into cursed file scoring (+5/+10/+20 bonus). 11 unit tests. Inspired by Tornhill/Meneely research on parallel work correlating with defect rates. V2 roadmap: sustained vs. spike detection, configurable time windows, knowledge map visualization, defect correlation. Design spec: `docs/plans/2026-03-11-parallel-development-design.md`.

### Color-coded cursed file reason tags (web dashboard)
Each signal type on cursed file cards now has a distinct color: orange (churn), amber (ownership), purple (parallel dev), pink (shame), cyan (age paradox), blue (coordination). Replaces the previous all-red styling.

### Commit message forensics ("shame score")
Three-tier weighted keyword scoring (`revert`/`hotfix`/`oops` = critical, `hack`/`workaround` = moderate, `fix`/`typo` = mild). Ratio-based per-file shame score (0–100). Feeds into cursed file scoring (+20 max bonus). `--shame` flag surfaces a dedicated leaderboard panel in the CLI. Full history recommended: `codelore --since all --shame`.

### Adapt skills from Vitals to CodeLore
Ported `/plan-feature`, `/prime`, `/review-project`, and `/sync-docs` skills. Replaced all Vitals-specific references with CodeLore equivalents (analyzers instead of runners, updated file paths, removed fixtures/scoring references).

### Ignore list for lock files and auto-generated files
Built-in `IGNORED_PATTERNS` in `git.ts` filters lock files, assets (`.ico`, `.png`, `.svg`, etc.), and generated output (`.next/`, `dist/`, `coverage/`) from `getTrackedFiles()`.

### Tighten cursed file scoring
Raised minimum threshold from 30→50 and reduced score contributions. Files now need multiple strong signals to qualify as cursed.

### Make active window relative to repo age
Age map thresholds (fresh/aging/stale/ancient) and contributor windows (active/ghost) are now percentage-based, scaling proportionally to repo age.

### Default `--since` to last 12 months
CLI defaults to `--since="12 months ago"`. Use `--since all` for full history. Young repos naturally return all commits.

### Rename to CodeLore
Full monorepo rename: `@lore/*` → `@codelore/*`, CLI binary `lore` → `codelore`, all type names (`LoreReport` → `CodeloreReport`, `runLore()` → `runCodelore()`), all imports, docs, and skill references updated.

### Vitest test suite
Set up Vitest with coverage and UI across the monorepo. Core package has unit tests for all analyzers (churn, bus-factor, age-map, contributors, cursed-files) using mock commit data, plus git primitive tests (`parseGitLog`, `isIgnored`). Tests colocated with source files.

### Turbo upgrade
Upgraded Turbo from `2.3.3` → `2.8.14`, now aligned with Vitals.

### React 18 → 19 upgrade
Upgraded `@codelore/web` from React 18 to React 19. Stack drift with Vitals eliminated.

### Project documentation
Added AGENTS.md (architecture guide for Claude Code), CONTRIBUTING.md, MIT LICENSE, USAGE.md (flag reference + example workflows), .editorconfig.

### LOC analyzer
Pure filesystem line counting (no `cloc` dependency). Reads tracked files, counts newlines, detects language from file extensions (30+ languages mapped). Produces `LocReport` with per-file LOC, language breakdown with percentages, and summary. First async analyzer in the codebase. 9 unit tests. Feeds hotspot score and future treemap/language panel.

### Hotspot score
The core Tornhill formula: `churnScore × log2(loc)` normalized to 0-100. Uses LOC as complexity proxy. Categories: critical (75+), warning (50-74), moderate (25-49), low (0-24). Dedicated "Hotspots (churn × complexity)" panel in CLI and updated Hotspots tab in web dashboard showing composite scores alongside LOC and churn. Overview card switched from raw churn to hotspot scores. 8 unit tests. Design spec: `docs/superpowers/specs/2026-03-14-phase2-loc-hotspot-coupling-design.md`.

### Coupling map
Temporal coupling detection from commit co-occurrence. Builds co-occurrence matrix from commit file lists, filters by dual thresholds (minimum 3 co-occurrences AND minimum 30% coupling strength), excludes bulk commits (30+ files). Coupling strength uses `min(totalA, totalB)` as denominator. Per-file coupling profiles with average strength score. CLI panel shows top 10 pairs with strength % and co-commit count. Web dashboard has dedicated Coupling tab with per-file drill-down view. 12 unit tests. Design spec: `docs/superpowers/specs/2026-03-14-phase2-loc-hotspot-coupling-design.md`.
