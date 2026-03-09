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

#### Shame tab in web dashboard
Add a sixth tab to the web dashboard for commit message forensics. The `forensics` data is already in every `LoreReport` — this is purely a UI addition. Show the shame leaderboard (file, shame score, dominant keywords, top offending commit messages) and a summary stat for total shame commits. Mirrors the `--shame` CLI panel but with more room to show details.

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
