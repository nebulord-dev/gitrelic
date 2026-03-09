# LORE

Git archaeology — understand the history and health of your codebase.


## What it does

Run `lore` in any git repository and get a narrative health report on the codebase's *history* — not just its current state.

- **Churn analysis** — which files change the most, and what that means
- **Bus factor** — who owns what, where you're exposed if someone leaves
- **Age map** — what's fresh, what's stale, what nobody dares touch
- **Contributor stories** — who built what, who's still active, who's a ghost
- **Cursed files** — the intersection of all of the above: high churn + concentrated ownership + age paradoxes
- **Shame score** — commit message forensics: files with repeated reverts, hotfixes, and hacks

## Usage

```bash
# Analyze current directory
lore

# Analyze a specific repo
lore --path ~/projects/my-app

# Open web dashboard
lore --path ~/projects/my-app --web

# Analyze only the last 6 months
lore --path ~/projects/my-app --since "6 months ago"

# Output JSON for piping
lore --path ~/projects/my-app --json > lore-report.json

# Show commit message shame leaderboard
lore --path ~/projects/my-app --shame
```

## How Lore scores files

Lore uses three scoring systems, each 0–100:

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

For the full flag reference, tips by repo type, and example workflows, see **[docs/USAGE.md](docs/USAGE.md)**.

## Setup

```bash
pnpm install
pnpm build
cd apps/cli && pnpm link --global
```

## Architecture

pnpm monorepo + Turbo:

- `packages/core` — git analysis engine (churn, bus factor, age, contributors, cursed files)
- `apps/cli` — Ink terminal UI + Commander
- `apps/web` — Vite + React + Tailwind dashboard (served via `--web`)

## Monorepo

```
lore/
├── packages/
│   └── core/           # Analysis engine
├── apps/
│   ├── cli/            # Terminal UI
│   └── web/            # Web dashboard
├── turbo.json
└── pnpm-workspace.yaml
```
