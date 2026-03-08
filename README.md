# Lore

Git archaeology — understand the history and health of your codebase.

```
██████╗ ███████╗████████╗██████╗  ██████╗
██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗
██████╔╝█████╗     ██║   ██████╔╝██║   ██║
██╔══██╗██╔══╝     ██║   ██╔══██╗██║   ██║
██║  ██║███████╗   ██║   ██║  ██║╚██████╔╝
╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝
```

## What it does

Run `lore` in any git repository and get a narrative health report on the codebase's *history* — not just its current state.

- **Churn analysis** — which files change the most, and what that means
- **Bus factor** — who owns what, where you're exposed if someone leaves
- **Age map** — what's fresh, what's stale, what nobody dares touch
- **Contributor stories** — who built what, who's still active, who's a ghost
- **Cursed files** — the intersection of all of the above: high churn + concentrated ownership + age paradoxes

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
```

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
