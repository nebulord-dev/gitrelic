# Lore — Kanban

> Task board for tracking Lore development. Update this file as work progresses.
> Columns: Backlog → In Progress → Done

---

## Backlog

### Ignore list for lock files and auto-generated files
Filter out files that add noise to analysis: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `*.ico`, default Next.js public assets, and similar auto-generated files. These inflate churn counts and cursed file scores without providing actionable insight.

### Tighten cursed file scoring
63 cursed files on a 115-file repo is too many. Raise the minimum threshold and recalibrate score contributions so only genuinely problematic files surface.

### Make active window relative to repo age
Hardcoded thresholds (90 days for "active", 180 days for "ghost", 30/180/365 for age status) don't make sense for young repos. A 0.3-year-old repo shouldn't have any ghosts. Scale windows proportionally to repo age.

### Default `--since` to last 12 months
Young repos get penalized by irrelevant distant history. Default to `--since="12 months ago"` when the user doesn't provide one, with an opt-out for full history analysis.

---

### Smarts & Analysis

#### Commit message forensics
Files with a high ratio of "fix", "hotfix", "revert", "oops" commits are cursed in a different way than high churn. Surface a "shame score" per file based on commit message sentiment.

#### Churn velocity
Is churn accelerating or decelerating? A file with 40 commits but 30 in the last month is more alarming than one spread over 3 years. Track churn rate over time, not just total count.

#### Rename tracking
Follow files through renames so churn/age history isn't lost when someone does `mv auth.ts authentication.ts`. Use git's `--follow` or `--find-renames` to stitch history across renames.

#### Complexity over time
Track lines-of-code per file across commits to show whether files are growing or shrinking. Growing + high churn = compounding risk.

#### "Dead code" candidates
Files that are tracked, never churned, AND old. Not stale — *deliberately* untouched. Either solid infrastructure or forgotten debt.

---

### Narrative & AI

#### Claude-powered summary
Pass the full `LoreReport` to Claude API and get a 3-paragraph "story of this codebase" narrative. The tool is already named after the concept — lean into it.

#### "What happened here?"
Click any file in the web dashboard and get an AI-generated explanation of its commit history narrative. Per-file deep dive powered by Claude.

---

### CLI Commands

#### `lore diff <branch>`
Compare health between branches or commits. "Since you branched from main, these 3 files have become hotspots."

#### `lore watch`
Live TUI that updates as you commit. Real-time churn tracking in the terminal.

#### `lore blame <file>`
Deep dive on a single file: full commit timeline, author breakdown, message forensics.

---

### Web Dashboard

#### Treemap visualization
Directory tree colored by churn score. Instantly see which *parts* of the codebase are on fire. Visually stunning and immediately useful.

#### Timeline chart
Commits over time, stacked by contributor. See when people joined, left, went quiet.

#### Drill into a file
Click any file anywhere in the dashboard to see its full commit history inline.

---

### Polish

#### Ignore list config (`lore.config.ts`)
Make the ignore list configurable via a `lore.config.ts` file (extends the built-in defaults). Pairs with the existing "ignore list" backlog item.

#### `lore badge`
Generate a health badge for your README (like coverage badges). Quick visual indicator of repo health.

#### Export as HTML (`lore --format html`)
Dump a standalone self-contained report HTML file you can share — no server needed.

---

## In Progress

_(nothing right now)_

---

## Done

### Adapt skills from Vitals to Lore
Ported `/plan-feature`, `/prime`, `/review-project`, and `/sync-docs` skills. Replaced all Vitals-specific references with Lore equivalents (analyzers instead of runners, updated file paths, removed fixtures/scoring references).
