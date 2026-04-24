# Migrate tsup → tsdown + TypeScript 6

**Date:** 2026-04-18
**Jira:** KAN-176
**Branch:** from `main`

## Motivation

tsup is no longer maintained; its author recommends tsdown as the successor. tsup does not support TypeScript 6, which blocks the TS upgrade. tsdown supports TS6 and is actively maintained.

## Scope

Two tsup consumers in the monorepo:

| Package | Current build | Config style |
|---|---|---|
| `@gitrelic/core` | `tsup src/index.ts --format esm --dts --clean` | Inline CLI flags in `package.json` scripts |
| `apps/cli` | `tsup` (reads `tsup.config.ts`) | Config file with `noExternal`, `banner`, `onSuccess` |

**Not affected:** `apps/web` (Vite), `apps/docs` (VitePress).

## Changes

### 1. `pnpm-workspace.yaml` catalog

```yaml
# Before
tsup: ^8.3.5
typescript: ^5.7.2

# After
tsdown: <latest>
typescript: ^6.0.0
```

### 2. `packages/core/package.json`

- `devDependencies`: `tsup: catalog:` → `tsdown: catalog:`
- `scripts.build`: `tsup src/index.ts --format esm --dts --clean` → `tsdown src/index.ts`
  - `--format esm`, `--dts`, `--clean` are tsdown defaults; can be omitted
- `scripts.dev`: `tsup src/index.ts --format esm --dts --watch` → `tsdown src/index.ts --watch`

### 3. `apps/cli/package.json`

- `devDependencies`: `tsup: catalog:` → `tsdown: catalog:`
- `scripts.build`: `tsup` → `tsdown`
- `scripts.dev`: `tsup --watch` → `tsdown --watch`

### 4. `apps/cli/tsup.config.ts` → `apps/cli/tsdown.config.ts`

```typescript
// Before
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  noExternal: ['@gitrelic/core'],
  banner: { js: '#!/usr/bin/env node' },
  onSuccess: 'node scripts/copy-web-dist.mjs',
});

// After
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.tsx'],
  deps: { alwaysBundle: ['@gitrelic/core'] },
  banner: { js: '#!/usr/bin/env node' },
  onSuccess: 'node scripts/copy-web-dist.mjs',
});
```

Removed options that are now defaults: `format` (esm), `dts` (auto from package.json `types`), `clean` (true).

### 5. `apps/cli/scripts/copy-web-dist.mjs` (comment update)

Line 13 references `tsup.config.ts` and line 17 references `tsup.config.ts` via `onSuccess` — update both to reference `tsdown.config.ts`.

### 6. `.claude/` skill files (stale references)

Update `tsup` → `tsdown` references in:
- `.claude/skills/audit-cli/SKILL.md`
- `.claude/skills/audit-architecture/SKILL.md`
- `.claude/skills/prime/SKILL.md`

### 7. Lockfile

`pnpm install` to regenerate `pnpm-lock.yaml`.

### 8. TypeScript 6

Catalog bump to `^6.0.0`. If TS6 introduces new strictness or breaking changes, fix any resulting type errors across all packages.

## Verification

1. `pnpm build` — all three packages build successfully
2. `pnpm test` — all 260 tests pass
3. `pnpm lint` — no new lint errors
4. `pnpm typecheck` — no type errors
5. Manual: `node apps/cli/dist/index.js --path . --web` — CLI runs, web dashboard loads

## Option Mapping Reference

| tsup | tsdown | Notes |
|---|---|---|
| `noExternal` | `deps.alwaysBundle` | Renamed |
| `format: ['esm']` | default | ESM is default in tsdown |
| `clean: true` | default | Clean is default in tsdown |
| `dts: true` | auto | Auto-enabled when `types` in package.json |
| `banner` | `banner` | Same API |
| `onSuccess` | `onSuccess` | Same API |
| `entry` | `entry` | Same API |

## Risks

- **Low:** tsdown is a new tool; edge cases in `noExternal` → `alwaysBundle` behavior for inlining `@gitrelic/core` into the CLI bundle. Mitigated by testing the published artifact shape.
- **Low:** TS6 type errors. Mitigated by running `pnpm typecheck` across all packages.
