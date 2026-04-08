# GITLORE

Git archaeology — understand the history and health of your codebase.


## What it does

Run `gitlore` in any git repository and get a narrative health report on the codebase's *history* — not just its current state.

### Churn & Complexity

- **Churn analysis** — which files change the most, and what that means
- **Churn velocity** — accelerating vs decelerating change over time
- **Hotspot scoring** — churn × LOC composite risk
- **Hotspot clustering** — multi-dimensional grouping across structural, ownership, temporal, and coupling signals
- **Complexity trend** — monthly file growth curves
- **Rewrite ratio** — insertion/deletion balance per file

### Ownership & Risk

- **Bus factor** — who owns what, where you're exposed if someone leaves
- **Knowledge concentration** — single-author file ratio across the repo
- **Ghost files** — files owned by authors who've gone inactive
- **Contributor profiles** — who built what, who's still active, who's a ghost
- **Co-authorship** — collaboration pair analysis from Co-authored-by trailers

### History & Patterns

- **Age map** — what's fresh, what's stale, what nobody dares touch
- **Dead code candidates** — ancient, untouched files
- **Blast radius** — how many files typically change alongside each file
- **Coupling map** — co-change frequency between file pairs
- **Parallel development** — multi-author overlap detection per week
- **Rename tracking** — file rename chain detection
- **Commit timing** — late-night and weekend stress patterns

### Diagnostics

- **Cursed files** — the intersection of all of the above: high churn + concentrated ownership + age paradoxes
- **Shame score** — commit message forensics: files with repeated reverts, hotfixes, and hacks
- **Test coverage proxy** — test file proximity per directory
- **LOC & language breakdown** — lines of code with language detection

## Usage

```bash
# Analyze current directory
gitlore

# Analyze a specific repo
gitlore --path ~/projects/my-app

# Open web dashboard
gitlore --path ~/projects/my-app --web

# Analyze only the last 6 months
gitlore --path ~/projects/my-app --since "6 months ago"

# Output JSON for piping
gitlore --path ~/projects/my-app --json > gitlore-report.json

# Show commit message shame leaderboard
gitlore --path ~/projects/my-app --shame

# Show parallel development panel
gitlore --path ~/projects/my-app --parallel
```

## How GitLore scores files

GitLore uses three scoring systems, each 0–100:

### Churn score

How often a file has been modified relative to the most-committed file in the repo.
A score of 100 means this file is the most-modified file in the repo. Lower scores are proportional — a score of 50 means this file was modified half as often as the top file.

### Shame score (`--shame`)

Based on commit message sentiment. Each commit touching a file is scanned for keywords:

| Weight | Keywords |
|--------|----------|
| 3 — Critical | `revert`, `hotfix`, `oops`, `fixup`, `broke` |
| 2 — Moderate | `hack`, `workaround`, `temporary`, `temp`, `kludge`, `band-aid` |
| 1 — Mild | `fix`, `bug`, `wrong`, `mistake`, `typo`, `cleanup` |

**Shame score** = `min((total weighted points / total commits for file) × 100, 100)`

Ratio-based: a file with 1 revert in 2 commits scores higher than 1 revert in 100 commits.

### Curse score

A composite of churn, bus factor risk, age anomalies, and shame. Files scoring ≥ 50 appear
in the Cursed Files panel. Shame contributes up to +20 points to the curse score.

## Setup

```bash
pnpm install
pnpm build
cd apps/cli && pnpm link --global
```

## Architecture

pnpm monorepo + Turbo:

- `packages/core` — git analysis engine (22 analyzers covering churn, ownership, history, and diagnostics)
- `apps/cli` — Ink terminal UI + Commander
- `apps/web` — Vite + React + Tailwind dashboard (served via `--web`)

## Monorepo

```text
gitlore/
├── packages/
│   └── core/           # Analysis engine
├── apps/
│   ├── cli/            # Terminal UI
│   └── web/            # Web dashboard
├── turbo.json
└── pnpm-workspace.yaml
```

## Contributing

PRs must use [conventional commit](https://www.conventionalcommits.org/) format in the title (e.g. `feat: add X`, `fix: resolve Y`). CI enforces this automatically.

Pre-commit hooks run oxlint and oxfmt on staged files. Releases are automated via [semantic-release](https://github.com/semantic-release/semantic-release) — version bumps, changelogs, and GitHub releases happen on merge to main.
