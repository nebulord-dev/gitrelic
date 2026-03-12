# Lore — Kanban

> Task board for tracking Lore development. Update this file as work progresses.
> Columns: Backlog → In Progress → Done

---

## Backlog

### Testing & Infrastructure

#### Configure oxc for linting
Set up `oxlint` as the linter for the Lore monorepo:
- Install `oxlint` in the workspace root
- Add `lint` scripts to root and per-package `package.json`
- Configure `.oxlintrc` with appropriate rules
- Integrate with Turbo pipeline (`lint` task in `turbo.json`)
- Fix or suppress any initial violations so lint passes clean
- Document lint command in CLAUDE.md

#### Add full test suite
Set up Vitest across the monorepo. Priority test targets:
- **Core analyzers**: Unit tests for `churn.ts`, `bus-factor.ts`, `age-map.ts`, `contributors.ts`, `cursed-files.ts` using mock commit data (no real git repos needed)
- **Ignore list**: Verify `isIgnored()` correctly filters lock files, assets, generated files
- **Relative thresholds**: Test percentage-based scaling at different repo ages (young, mid, mature)
- **Git primitives**: Test `parseGitLog()` parsing with known input strings
- **`--since` handling**: Test `all` keyword produces `undefined`, default is `12 months ago`
- Colocate tests with source files (e.g. `churn.test.ts` next to `churn.ts`)
- **Note**: `parseGitLog()` in `git.ts` is currently private. Export it so it can be unit tested directly with known input strings rather than requiring a real git repo via `getAllCommits()`.

---

### Smarts & Analysis

~~#### Commit message forensics~~
~~Files with a high ratio of "fix", "hotfix", "revert", "oops" commits are cursed in a different way than high churn. Surface a "shame score" per file based on commit message sentiment.~~
_(Done — see Done column)_

#### Hotspot score ⭐ PRIORITIZE
The core Tornhill formula: `churn × complexity = hotspot`. A file that changes constantly AND is complex is the highest-risk file in the codebase — not just high churn, not just high complexity, but the *product* of both. Implement as a composite 0–100 score per file. This is the single most actionable metric in behavioral code analysis and the intellectual backbone of the whole tool. Feeds directly into cursed file scoring, the treemap visualization, and the commit graph heat overlay.
- Use lines-of-code as a complexity proxy initially (no AST parsing needed)
- Later: swap in cyclomatic complexity via `typhonjs-escomplex` for JS/TS files
- Surface as a dedicated "Hotspots" section in both CLI and web dashboard

#### `cloc` integration
Wrap `cloc` (or the npm port `cloc`) to get language breakdown and LOC per file across the repo. Feeds:
- Hotspot score (LOC as complexity proxy)
- "What is this repo made of" stat block (languages, % breakdown)
- Per-file LOC displayed in file drill-down views
- LOC growth over time when combined with git history

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

#### Coupling map ⭐ PRIORITIZE
Files that always change together in the same commit are secretly coupled even if they don't import each other. If `auth.ts` and `session.ts` appear in the same commit 80% of the time, that's a hidden architectural dependency. Surface per-file "coupling partners" and an overall coupling score. Shows real architecture vs. intended architecture. Unique insight that no other git tool surfaces.

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
`lore --since 30d vs 90d` — compare two time windows to show what's getting better vs. worse. A file that was hot 90 days ago but calm recently is recovering. A file that was fine 90 days ago but hot recently is deteriorating. Directional health, not just snapshot health.

---

### Narrative & AI

#### Claude-powered summary
Pass the full `LoreReport` to Claude API and get a 3-paragraph "story of this codebase" narrative. The tool is already named after the concept — lean into it.

#### "What happened here?"
Click any file in the web dashboard and get an AI-generated explanation of its commit history narrative. Per-file deep dive powered by Claude.

#### Refactor brief
For the top cursed file, Claude generates a short brief: why it's cursed, what the likely root cause is based on commit patterns, and what a refactor approach might look like. Actionable output, not just a score.

#### PR risk assessment (`lore-action`) ⭐ PRIORITIZE
GitHub Action that runs on every PR, looks up the touched files in a cached LoreReport, and posts a comment: "This PR touches 2 cursed files and one file owned 90% by someone who hasn't committed in 4 months." Brings Lore into the daily review workflow without anyone having to remember to run it. Highest practical value for teams.

#### Commit graph annotation layer
Overlay Lore data directly on the commit graph visualization. Hotspot spikes, ownership changes, shame-score events, and bus-factor warnings appear as markers on the graph timeline. The commit graph becomes a *navigable diagnostic surface*, not just a pretty picture. Click a spike on the graph to see which files caused it and why Lore flagged them.

#### Team narrative report
AI-generated per-team (or per-contributor) narrative: "Alice owns 60% of the auth subsystem, has been the primary author for 2 years, and her files have the lowest churn in the repo. Bob joined 4 months ago and has touched 12 high-hotspot files — either he's doing important cleanup or spreading risk." Designed to be shared in engineering all-hands or team retrospectives.

---

### CLI Commands

#### `lore diff <branch>`
Compare health between branches or commits. "Since you branched from main, these 3 files have become hotspots."

#### `lore watch`
Live TUI that updates as you commit. Real-time churn tracking in the terminal.

#### `lore blame <file>`
Deep dive on a single file: full commit timeline, author breakdown, message forensics.

#### `lore graph`
Render the commit DAG in the terminal — branch lanes, colored by hotspot severity. Each commit dot is colored by its churn impact. Hotspot commits glow. Wraps `git log --graph` with Lore enrichment layered on top. The terminal version of the web commit graph.

#### `lore hotspot [--top N]`
Dedicated CLI command that outputs the top N hotspot files ranked by the churn × complexity composite score. Separate from the general `lore` report — fast, focused, actionable. Pairs well with `lore blame <file>` for drilling in.

#### `lore team`
Contributor-focused report: bus factor, ghost files, knowledge concentration index, ownership drift summary. Designed for the engineering manager audience rather than the individual developer.

---

### Web Dashboard

#### Commit graph visualization ⭐ PRIORITIZE
The GitKraken-style DAG — colored branch lanes, commit dots, merge lines. Built with `d3-dag` for layout and custom SVG rendering for full control. Nodes colored by hotspot score (cool → hot). Click any commit to see which files changed, their Lore scores at that point in time, and the commit message. This is the visual centerpiece of the web dashboard — the thing people screenshot and share. Makes Lore immediately legible to anyone who's used a git GUI before.
- Data: `git log --all --pretty=format:"%H|%P|%an|%at|%s" --topo-order`
- Layout: `d3-dag` handles lane assignment
- Render: custom SVG — full control over color, dot size, heat overlays
- Interaction: click commit → file list with Lore scores; hover → tooltip with author, date, shame score

#### Hotspot matrix
Scatter plot: X-axis = churn, Y-axis = complexity (LOC), dot size = number of authors, dot color = shame score. Every file in the repo plotted simultaneously. The top-right quadrant (high churn, high complexity) is the danger zone. Instantly shows the shape of the codebase's risk. This is the single most information-dense visualization Lore can produce and the one most directly derived from Tornhill's methodology.

#### Shame tab in web dashboard
Add a sixth tab to the web dashboard for commit message forensics. The `forensics` data is already in every `LoreReport` — this is purely a UI addition. Show the shame leaderboard (file, shame score, dominant keywords, top offending commit messages) and a summary stat for total shame commits. Mirrors the `--shame` CLI panel but with more room to show details.

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

#### Repo health tab
Top-level health dashboard powered by `git-sizer` integration. Blob sizes, history bloat, pack efficiency. The "infrastructure layer" complement to the code-behavior metrics everywhere else in Lore. Green/amber/red status indicators. Something you'd check once when onboarding to a new repo.

#### Language breakdown panel
Visual breakdown of what the repo is made of — languages, LOC per language, file count per language — powered by `cloc` integration. Surprisingly absent from most git analytics tools. Immediately useful context for everything else on the dashboard.

#### Hotspot score leaderboard
Dedicated panel showing files ranked by the churn × complexity composite. Not just cursed files — specifically the Tornhill hotspot formula. Separate from the existing cursed file view because the formula and interpretation are different. Most engineers will understand "high churn AND high complexity = problem" immediately.

---

### Polish

#### Ignore list config (`lore.config.ts`)
Make the ignore list configurable via a `lore.config.ts` file (extends the built-in defaults). Pairs with the existing "ignore list" backlog item.

#### Pre-commit hook warning
When committing to an already-cursed file, warn the developer: "⚠ auth.ts is a cursed file (score: 78/100). Proceed?" Tiny integration surface, high signal value. Installable via `lore install-hook`.

#### `lore badge`
Generate a health badge for your README (like coverage badges). Quick visual indicator of repo health.

#### Export as HTML (`lore --format html`)
Dump a standalone self-contained report HTML file you can share — no server needed. No dashboard, no server — just a file you can email or drop in Slack.

#### `lore init` setup wizard
Interactive first-run wizard: detects repo age, suggests appropriate `--since` window, asks if you want the pre-commit hook, generates a `lore.config.ts` with sensible defaults. Removes the "now what?" moment after install.

#### VS Code extension
Surface Lore scores inline in the editor — hotspot severity as a gutter indicator, shame score in the file tab, bus factor warning when you open a ghost file. Passive ambient awareness without running the CLI. The eventual distribution channel that gets Lore in front of the most developers with the least friction.

#### Shareable snapshot (`lore share`)
Generate a static snapshot of the current `LoreReport` as a hosted URL (or self-hostable JSON + HTML bundle). "Here's the lore of our repo as of today" that you can share with stakeholders who don't have git access. Privacy-aware: strips author emails, optionally anonymizes contributor names.

---

## In Progress

_(nothing right now)_

---

## Done

### Parallel development analyzer
Detects temporal concurrency per file — multiple authors committing in the same calendar week. Uses author-week matrix approach with severity-weighted scoring (`max(1.0, min(avg_authors/2, 2.0))`). Produces standalone `ParallelDevReport` on `LoreReport` and feeds into cursed file scoring (+5/+10/+20 bonus). 11 unit tests. Inspired by Tornhill/Meneely research on parallel work correlating with defect rates. V2 roadmap: sustained vs. spike detection, configurable time windows, knowledge map visualization, defect correlation. Design spec: `docs/plans/2026-03-11-parallel-development-design.md`.

### Color-coded cursed file reason tags (web dashboard)
Each signal type on cursed file cards now has a distinct color: orange (churn), amber (ownership), purple (parallel dev), pink (shame), cyan (age paradox), blue (coordination). Replaces the previous all-red styling.

### Commit message forensics ("shame score")
Three-tier weighted keyword scoring (`revert`/`hotfix`/`oops` = critical, `hack`/`workaround` = moderate, `fix`/`typo` = mild). Ratio-based per-file shame score (0–100). Feeds into cursed file scoring (+20 max bonus). `--shame` flag surfaces a dedicated leaderboard panel in the CLI. Full history recommended: `lore --since all --shame`.

### Adapt skills from Vitals to Lore
Ported `/plan-feature`, `/prime`, `/review-project`, and `/sync-docs` skills. Replaced all Vitals-specific references with Lore equivalents (analyzers instead of runners, updated file paths, removed fixtures/scoring references).

### Ignore list for lock files and auto-generated files
Built-in `IGNORED_PATTERNS` in `git.ts` filters lock files, assets (`.ico`, `.png`, `.svg`, etc.), and generated output (`.next/`, `dist/`, `coverage/`) from `getTrackedFiles()`.

### Tighten cursed file scoring
Raised minimum threshold from 30→50 and reduced score contributions. Files now need multiple strong signals to qualify as cursed.

### Make active window relative to repo age
Age map thresholds (fresh/aging/stale/ancient) and contributor windows (active/ghost) are now percentage-based, scaling proportionally to repo age.

### Default `--since` to last 12 months
CLI defaults to `--since="12 months ago"`. Use `--since all` for full history. Young repos naturally return all commits.
