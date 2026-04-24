# tsup → tsdown + TypeScript 6 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tsup with tsdown and upgrade TypeScript from 5.x to 6.x across the GitRelic monorepo.

**Architecture:** Two tsup consumers (`@gitrelic/core` and `apps/cli`) get migrated to tsdown. `apps/web` (Vite) and `apps/docs` (VitePress) are unaffected. The TS6 upgrade applies to the whole workspace via the pnpm catalog.

**Tech Stack:** tsdown, TypeScript 6, pnpm catalogs, Turbo

**Spec:** `docs/superpowers/specs/2026-04-18-tsdown-migration-design.md`

> **Path convention:** `<nebulord>` refers to the parent directory containing `gitrelic/` (and sibling repos like `sickbay/`). Substitute your own absolute path when executing.

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `pnpm-workspace.yaml` | Replace `tsup` catalog entry with `tsdown`, bump `typescript` to `^6.0.0` |
| Modify | `packages/core/package.json` | Swap `tsup` → `tsdown` in devDeps and simplify build scripts |
| Modify | `apps/cli/package.json` | Swap `tsup` → `tsdown` in devDeps and build scripts |
| Delete | `apps/cli/tsup.config.ts` | Old config file |
| Create | `apps/cli/tsdown.config.ts` | New config with `deps.alwaysBundle` replacing `noExternal` |
| Modify | `apps/cli/scripts/copy-web-dist.mjs` | Update comments referencing `tsup.config.ts` |
| Modify | `.claude/skills/audit-architecture/SKILL.md` | Update tsup → tsdown references |
| Modify | `.claude/skills/audit-cli/SKILL.md` | Update tsup → tsdown references |
| Modify | `.claude/skills/prime/SKILL.md` | Update tsup → tsdown reference |
| Modify | `<nebulord>/CLAUDE.md` | Update build tool reference in shared stack table |

---

### Task 1: Create migration branch

- [ ] **Step 1: Create branch from main**

```bash
git checkout main && git pull
git checkout -b kan-176-tsdown-migration
```

---

### Task 2: Swap catalog entries

**Files:**
- Modify: `pnpm-workspace.yaml:6-7`

- [ ] **Step 1: Update pnpm-workspace.yaml**

Replace in the `catalog:` section:

```yaml
# Before
  tsup: ^8.3.5
  typescript: ^5.7.2

# After
  tsdown: ^0.12.5
  typescript: ^6.0.0
```

Note: check `npm view tsdown version` for the latest tsdown version before applying.

- [ ] **Step 2: Commit**

```bash
git add pnpm-workspace.yaml
git commit -m "chore: update catalog — tsup → tsdown, typescript → 6"
```

---

### Task 3: Migrate @gitrelic/core

**Files:**
- Modify: `packages/core/package.json:14-16,31`

- [ ] **Step 1: Update package.json devDependencies**

Replace `"tsup": "catalog:"` with `"tsdown": "catalog:"` in `devDependencies`.

- [ ] **Step 2: Simplify build scripts**

```jsonc
// Before
"build": "tsup src/index.ts --format esm --dts --clean",
"dev": "tsup src/index.ts --format esm --dts --watch",

// After
"build": "tsdown src/index.ts",
"dev": "tsdown src/index.ts --watch",
```

`--format esm`, `--dts`, and `--clean` are all tsdown defaults — omit them.

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json
git commit -m "chore(core): migrate tsup → tsdown"
```

---

### Task 4: Migrate apps/cli

**Files:**
- Modify: `apps/cli/package.json:24-25,43`
- Delete: `apps/cli/tsup.config.ts`
- Create: `apps/cli/tsdown.config.ts`

- [ ] **Step 1: Update package.json devDependencies**

Replace `"tsup": "catalog:"` with `"tsdown": "catalog:"` in `devDependencies`.

- [ ] **Step 2: Update build scripts**

```jsonc
// Before
"build": "tsup",
"dev": "tsup --watch",

// After
"build": "tsdown",
"dev": "tsdown --watch",
```

- [ ] **Step 3: Create tsdown.config.ts**

Create `apps/cli/tsdown.config.ts`:

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.tsx'],
  // @gitrelic/core is private and not published separately, so inline its source
  // into the CLI bundle. Its runtime dependencies (currently just execa) must
  // be declared in apps/cli/package.json so they resolve at install time.
  deps: { alwaysBundle: ['@gitrelic/core'] },
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Copy the built web dashboard into dist/web/ so it ships inside the
  // published package (apps/cli/package.json files: ["dist"]). Without this
  // step the `--web` flag crashes at runtime because `../../web/dist` only
  // resolves inside the monorepo. See scripts/copy-web-dist.mjs for detail.
  onSuccess: 'node scripts/copy-web-dist.mjs',
});
```

- [ ] **Step 4: Commit (delete old config + add new)**

```bash
git add apps/cli/package.json apps/cli/tsdown.config.ts
git rm apps/cli/tsup.config.ts
git commit -m "chore(cli): migrate tsup → tsdown"
```

---

### Task 5: Update stale comments and docs

**Files:**
- Modify: `apps/cli/scripts/copy-web-dist.mjs:13,17`
- Modify: `.claude/skills/audit-architecture/SKILL.md`
- Modify: `.claude/skills/audit-cli/SKILL.md`
- Modify: `.claude/skills/prime/SKILL.md`
- Modify: `<nebulord>/CLAUDE.md:23`

- [ ] **Step 1: Update copy-web-dist.mjs comments**

Line 13: `after tsup builds the` → `after tsdown builds the`
Line 17: `apps/cli/tsup.config.ts` → `apps/cli/tsdown.config.ts`

- [ ] **Step 2: Update .claude/skills/audit-architecture/SKILL.md**

Replace all `tsup` references with `tsdown` equivalents throughout the file:
- `tsup.config.ts` → `tsdown.config.ts` (appears in file tree, prose, and "How to Run" block)
- `noExternal` → `deps.alwaysBundle` (where referencing the config option)
- `tsup or Vite` → `tsdown or Vite`
- `tsup config` → `tsdown config` in prose

- [ ] **Step 3: Update .claude/skills/audit-cli/SKILL.md**

Replace all `tsup` references with `tsdown` equivalents:
- `tsup.config.ts` → `tsdown.config.ts`
- `noExternal: ['@gitrelic/core']` → `deps: { alwaysBundle: ['@gitrelic/core'] }`
- `tsup's noExternal` → `tsdown's alwaysBundle`
- `tsup` → `tsdown` in prose

- [ ] **Step 4: Update .claude/skills/prime/SKILL.md**

Line 105: `tsup for bundling core/cli` → `tsdown for bundling core/cli`

- [ ] **Step 5: Update root CLAUDE.md (separate repo)**

In `<nebulord>/CLAUDE.md`, line 23:
`| Build | tsup | tsup (core), Vite (extension) |` → `| Build | tsdown | tsup (core), Vite (extension) |`

Note: only the first column (GitRelic) changes. The second column describes Darkstar, which still uses tsup.

This file is in the parent `nebulord` repo, not the gitrelic repo. Commit separately:

```bash
cd <nebulord>
git add CLAUDE.md
git commit -m "docs: update gitrelic build tool tsup → tsdown"
cd <nebulord>/gitrelic
```

- [ ] **Step 6: Commit gitrelic docs changes**

```bash
git add apps/cli/scripts/copy-web-dist.mjs .claude/skills/
git commit -m "docs: update tsup → tsdown references across docs and skills"
```

---

### Task 6: Install dependencies and verify build

- [ ] **Step 1: Install**

```bash
pnpm install
```

This regenerates `pnpm-lock.yaml` with tsdown replacing tsup.

- [ ] **Step 2: Build all packages**

```bash
pnpm build
```

Expected: all three packages (`core`, `web`, `cli`) build successfully.

- [ ] **Step 3: Verify CLI artifact**

```bash
head -1 apps/cli/dist/index.js
```

Expected: `#!/usr/bin/env node` (shebang from `banner` config).

```bash
ls apps/cli/dist/web/index.html
```

Expected: file exists (from `onSuccess` copy hook).

- [ ] **Step 4: Commit lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore: regenerate lockfile for tsdown + typescript 6"
```

---

### Task 7: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all tests pass (~260 tests).

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no type errors. If TS6 introduces new errors, fix them and commit:

```bash
git commit -am "fix: resolve typescript 6 type errors"
```

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no new lint errors.

---

### Task 8: Smoke test CLI

- [ ] **Step 1: Run CLI against this repo**

```bash
node apps/cli/dist/index.js --path .
```

Expected: CLI runs, produces report output, exits cleanly.

- [ ] **Step 2: Run CLI with --json flag**

```bash
node apps/cli/dist/index.js --path . --json > /dev/null
```

Expected: exits 0, valid JSON output.

- [ ] **Step 3: Run CLI with --web flag**

```bash
node apps/cli/dist/index.js --path . --web &
sleep 3
curl -s http://localhost:7777 | head -5
kill %1
```

Expected: web server starts, returns HTML with the dashboard.
