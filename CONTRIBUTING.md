# Contributing to Lore

Thanks for your interest in contributing! This document covers how to get set up, how the codebase is organized, and what to expect when submitting a pull request.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 8+

### Setup

```bash
git clone https://github.com/your-username/lore.git
cd lore
pnpm install
pnpm build
```

### Running locally

```bash
# Analyze any git repo
node apps/cli/dist/index.js --path ~/projects/my-app

# Watch mode (rebuilds on changes)
pnpm dev
```

---

## Project Structure

```
lore/
├── packages/
│   └── core/               # Analysis engine — start here for new analyzers
│       └── src/
│           ├── analyzers/  # One file per analyzer (churn, bus-factor, etc.)
│           ├── utils/      # Git primitives (parseGitLog, getTrackedFiles)
│           ├── runner.ts   # Orchestrates all analyzers → LoreReport
│           └── types.ts    # All TypeScript interfaces
├── apps/
│   ├── cli/                # Terminal UI (Ink + Commander)
│   └── web/                # Web dashboard (React + Vite + Tailwind)
└── docs/                   # Design docs, usage guide, implementation plans
```

---

## Adding a New Analyzer

1. Create `packages/core/src/analyzers/my-analyzer.ts`
2. Export a function `analyzeX(commits: RawCommit[], trackedFiles: string[]): XReport`
3. Add `XReport` (and any supporting interfaces) to `packages/core/src/types.ts`
4. Call it in `packages/core/src/runner.ts` and include the result in the `LoreReport` return value
5. Export any public types from `packages/core/src/index.ts`
6. Add tests in `packages/core/src/analyzers/my-analyzer.test.ts`

See any existing analyzer (e.g. `churn.ts`) as a reference.

---

## Running Tests

```bash
# All tests
pnpm test

# Core package only (with coverage)
pnpm --filter @lore/core test

# Watch mode
pnpm --filter @lore/core test -- --watch
```

Tests live next to source files (`churn.ts` → `churn.test.ts`). New code should come with tests.

---

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include tests for new behavior
- Run `pnpm build` and `pnpm test` before submitting and make sure both pass
- Write a clear PR description explaining what changed and why

---

## Reporting Issues

Open a GitHub issue with:
- What you were running (`lore --path ...`)
- What you expected to see
- What actually happened

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
