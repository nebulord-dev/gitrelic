---
name: audit-architecture
description: Use when auditing GitRelic's monorepo architecture for boundary violations, dependency order problems, bundled-deps drift, cross-package import issues, workspace registration gaps, docs isolation, tsconfig drift, or release-workflow invariants. Run before merging large cross-package branches, after adding new packages, or before a major release.
---

# Audit: Monorepo Architecture

Dispatch the `monorepo-architect` agent (`.claude/agents/monorepo-architect.md`) to review structural integrity across all GitRelic packages and apps. This audit is about the *shape* of the monorepo, not the correctness of any single package.

## Checklist

### 1. Package Boundary Violations

**Critical rule:** browser code — `apps/web`, `apps/atlas` and `packages/scene` — must NEVER import values from `@gitrelic/core`. Only `import type` is allowed — value imports would bundle Node.js modules (`execa`, `node:fs`, `node:http`) into the browser build and break Vite. The oxlint `typescript/no-restricted-imports` overrides in `oxlint.config.ts` must still cover `apps/web/src/**`, `apps/atlas/src/**` and `packages/scene/src/**`.

- Search `apps/web/src/`, `apps/atlas/src/` and `packages/scene/src/` (excluding `*.test.ts`) for any `from '@gitrelic/core'` that is NOT `import type`
- Search for any `require('@gitrelic/core')` in those trees
- In `apps/atlas/src/` and `packages/scene/src/` (both `verbatimModuleSyntax`), `import { type X } from '@gitrelic/core'` is a violation too — it survives as a side-effect import of core. oxlint's `typescript/no-import-type-side-effects` must stay enabled for both
- `apps/atlas/dev/devData.ts` value-imports core on purpose: it's the Vite dev plugin, Node-side, never in the browser bundle. Flag it only if something under `apps/atlas/src/` starts importing it
- Check `packages/scene/src/` and `apps/web/src/utils/` — constants that needed core values (thresholds, weights, category names) must be duplicated there, not imported from core
- `packages/scene` must stay framework-free and browser-safe: no `react`, `svelte` or `node:*` imports (oxlint override in `oxlint.config.ts`), and nothing may import from `apps/*`
- Run `pnpm --filter @gitrelic/web build` and `pnpm --filter @gitrelic/atlas build` and read the output — a Node.js import may only produce a "Module externalized for browser compatibility" **warning** while the build succeeds and the dashboard breaks at runtime. Don't treat a green build as proof; the grep above is the real check

### 2. Dependency Direction

The enforced direction is `@gitrelic/core` → `@gitrelic/scene` → `@gitrelic/web` and `@gitrelic/atlas`, plus `@gitrelic/core` → `gitrelic` (apps/cli; not `@gitrelic/cli`). The three apps are siblings; none depends on another at import time.

- `packages/core` must not import from `packages/scene`, `apps/cli`, `apps/web`, `apps/atlas`, or `apps/docs`
- `packages/scene` must not import from any `apps/*`
- `apps/cli` must not import from `apps/web` or `apps/atlas` (both `dist/`s are served as static files at runtime — copied in at build time, not imported)
- `apps/web` and `apps/atlas` must not import from each other or values from `apps/cli`
- Check `turbo.json` — the `build.dependsOn: ["^build"]` chain must reflect the direction via workspace dependencies
- Check `pnpm-workspace.yaml` — no circular workspace references

### 3. Bundled-Deps Mirror Invariant

`apps/cli` bundles `@gitrelic/core` inline via tsdown `deps.alwaysBundle`. Every runtime dep of core must also appear in `apps/cli/package.json` dependencies with matching version ranges — otherwise the bundled `require('...')` calls fail at install time.

- CI job `install-smoke` runs this check explicitly (`.github/workflows/ci.yml`). On every audit, confirm the job still runs and still diffs `jq -r '.dependencies | keys[]'` between core and cli
- Manually compare `packages/core/package.json` dependencies vs `apps/cli/package.json` dependencies — any core dep not mirrored in cli is a ticking bomb
- Current state: core declares `execa`; cli mirrors it. If any new runtime dep lands in core, cli must be updated in the same PR
- If a second package that bundles core is ever added, the install-smoke diff must include it too

### 4. Published-Package Asset Mirror Invariant

`apps/cli` also bundles both built dashboards into its own `dist/` via `tsdown.config.ts`'s `onSuccess`, which runs `scripts/copy-web-dist.mjs` (name predates Atlas): `apps/web/dist` → `apps/cli/dist/web/` (classic) and `apps/atlas/dist` → `apps/cli/dist/atlas/`. Without this, `npx gitrelic --web` crashes with `ENOENT` on `node_modules/web/dist/index.html` — the monorepo path `../../web/dist` only resolves in development.

- `apps/cli/package.json` has `files: ["dist"]` — only `dist/` lands in the tarball. Anything the CLI reads at runtime outside `dist/` is a latent crash
- `scripts/copy-web-dist.mjs` must fail loudly (`process.exit(1)`) when **either** dist or its `index.html` is missing, with a message that names the package to build (`pnpm --filter @gitrelic/web build` / `@gitrelic/atlas`)
- `apps/cli/package.json` declares both `@gitrelic/web` and `@gitrelic/atlas` as `devDependencies` with `workspace:*` — turbo uses these to order the builds so the copy script always finds both dists. Dropping either races the build
- `apps/web/vite.config.ts` must keep `base: './'`: `--ui atlas` serves classic under `/classic/`, and absolute asset URLs would 404 there
- CI `install-smoke` verifies `node_modules/gitrelic/dist/web/index.html` and `dist/atlas/index.html` exist after installing the packed tarball, probes `--web --no-open`, and has a `--ui atlas --no-open` step that checks Atlas at `/`, classic at `/classic/` (including one relative script), and the lite + commits endpoints

### 5. Exec Discipline Invariant

All git command execution MUST go through `packages/core/src/utils/git.ts`. See the `exec-discipline` skill for the full rule. This is an architectural invariant because it encodes the core package's boundary with the git subprocess.

- Run: `grep -r "from 'execa'" packages/core/src/ --include='*.ts' | grep -v 'utils/git.ts' | grep -v '.test.ts'` — must return zero
- `apps/cli` and `apps/web` must not import `execa` at all — all subprocess work belongs in core
- New git commands must be added to `utils/git.ts`, accept `repoPath` first, and return typed data — not raw stdout

### 6. Circular Dependencies Within Packages

- Run `pnpm --filter @gitrelic/core exec madge --circular src/` — must return no cycles
- Run `pnpm --filter gitrelic exec madge --circular src/` — same
- Run `pnpm --filter @gitrelic/web exec madge --circular src/` — same
- Run it on `packages/scene/src/` too. For Atlas, `.svelte` imports need a manual look — don't read a clean madge run over `apps/atlas/src` as proof
- Pay attention to `packages/core/src/analyzers/` — analyzers must not import from each other. Cross-analyzer composition belongs in `runner.ts` or in a dedicated consumer like `cursed-files.ts` (which takes other analyzers' output as arguments rather than importing them)

### 7. Type Export Discipline

- `packages/core/src/index.ts` — all public types re-exported here. Internal implementation (individual analyzer functions, git utils) should only be exported if intentionally public API
- `apps/cli`, `apps/web`, `apps/atlas` and `packages/scene` should import from `@gitrelic/core` (and the dashboards from `@gitrelic/scene`) via the package name (workspace import), not via relative paths like `../../../packages/core/src`. Relative path imports across packages bypass the build system and cause subtle bugs
- `apps/web`, `apps/atlas` and `packages/scene` imports from core must be `import type` only (see §1) — any value in the public export from core will eventually tempt someone to value-import it

### 8. Documentation Site (`apps/docs`)

VitePress site deployed to `nebulord-dev.github.io/gitrelic` via `.github/workflows/docs.yml`. Easy to forget because it's excluded from the root `pnpm build`.

- `apps/docs` is in `pnpm-workspace.yaml`
- Docs workflow triggers on `paths: ['apps/docs/**']` — changes to `apps/docs/` on `main` trigger a deploy, other changes don't
- Docs is NOT built by the CI `build` job or the `install-smoke` job — it deploys on its own workflow
- **Content-coupling check:** if a CLI flag, analyzer output, or dashboard section changed in this branch, verify the corresponding `apps/docs/guide/*.md` / `apps/docs/analyzers/*.md` / `apps/docs/dashboard/*.md` was updated. The `sync-docs` skill can generate a draft; architecture audit verifies the coupling isn't broken

### 9. TypeScript Configuration

- `tsconfig.base.json` is shared. Each package extends it via `{ "extends": "../../tsconfig.base.json" }` (or the right relative path)
- Per-package overrides that silently loosen strictness (`noImplicitAny: false`, `strict: false`, `skipLibCheck` added locally when it's already in base) are suspect — either fix the root cause or document why
- TypeScript 6 adopted in April 2026 via tsdown migration. If any package pins a different compiler version than the root catalog, flag it — version skew across workspaces is a silent footgun

### 10. Release Workflow Invariant

Only `gitrelic` (the CLI) publishes to npm via semantic-release. Core, scene, web and atlas are private, and this must not change without a plan.

- `packages/core/package.json` must stay `"private": true` — publishing it separately would break the bundled-deps invariant (users would end up with two copies of core's source)
- `apps/web/package.json` and `apps/atlas/package.json` must stay `"private": true` — they're served as static assets, not consumed as modules
- `packages/scene/package.json` must stay `"private": true` — it ships TS source (`exports` → `src/index.ts`) that only workspace bundlers can compile
- `apps/docs/package.json` must stay `"private": true`
- `.releaserc.json` has `pkgRoot: "apps/cli"` — only that path gets version-bumped and published
- **Pre-1.0 guard:** `.releaserc.json` reclassifies breaking changes as minor bumps (`"releaseRules": [{ "breaking": true, "release": "minor" }]`). Do not remove this rule outside a deliberate 1.0 cut — a single `chore!:` commit once shipped `v2.0.0` that had to be unpublished and reset

### 11. New Package Registration

If any new package was added since last audit:

- In `pnpm-workspace.yaml`?
- In `turbo.json` — does the default `build` pipeline pick it up via glob, or does it need a specific override?
- Own `tsconfig.json` extending `tsconfig.base.json`?
- Own `vitest.config.ts` (if tested)?
- Does `scripts/copy-web-dist.mjs` need updating? Does the `install-smoke` CI job need new assertions?
- `.releaserc.json` untouched (only cli publishes) — unless this is a deliberate multi-package release decision

### 12. Workflow and Script Hygiene

- `.github/workflows/ci.yml` — lint, typecheck, test, install-smoke. If a step was added or removed, understand why
- `.github/workflows/publish.yml` — semantic-release on push to main. Must not short-circuit build or smoke steps
- `.github/workflows/claude.yml` — Claude Code GitHub integration. Unrelated to release correctness, but verify it hasn't been broken by workflow changes
- Husky + lint-staged pre-commit hook still runs `oxlint --fix` and `oxfmt` on staged files — no silent bypass

## War Stories

Past architectural bugs that this audit exists to prevent from recurring. Each entry is a real failure mode — treat as worked examples of what goes wrong:

- **`workspace:*` protocol leak (v1.4.0)** — the CLI declared `@gitrelic/core: workspace:*` as a runtime dependency, but core was private. `pnpm publish` rewrote `workspace:*` to a real version, `npm install gitrelic` failed immediately because that version didn't exist. Fix: `tsdown.config.ts` sets `deps.alwaysBundle: ['@gitrelic/core']` and core is moved to devDependencies. `install-smoke` CI packs the tarball and installs it in a clean dir to catch regressions.
- **`--web` ENOENT through v1.4.2** — the CLI resolved the web dashboard via `../../web/dist` from `import.meta.url`. Worked in the monorepo, crashed with `ENOENT: node_modules/web/dist/index.html` on every published version. The CI smoke test only exercised `--json` and missed it. Fix: `scripts/copy-web-dist.mjs` copies `apps/web/dist/*` → `apps/cli/dist/web/*` at build time, and the smoke test now starts `--web` and probes the HTTP endpoint.
- **`chore!:` shipped v2.0.0 in pre-alpha** — a single commit with breaking-change footer caused semantic-release to jump from `v0.2.x` to `v2.0.0` on main. Had to be unpublished and reset. Fix: `.releaserc.json` releaseRules override reclassifies `breaking: true` as a minor bump during pre-1.0.
- **`URL#pathname` on Windows** — a runtime asset reference used `new URL('./web', import.meta.url).pathname`, which returns `/C:/Users/...` on Windows and the fs module can't open it. Never caught locally (macOS/Linux only). Fix: `fileURLToPath(new URL(..., import.meta.url))` is now the mandated pattern; see `apps/cli/src/index.tsx` and `apps/cli/scripts/copy-web-dist.mjs`.
- **Probe/listen host mismatch** — early `--web` code probed for a free port on `::` (default) then bound the real server to `127.0.0.1`. On macOS the IPv4 and IPv6 loopback sockets are independent, so the probe said "free" while the real bind crashed with `EADDRINUSE`. Fix: `getFreePort` and `server.listen` both bind to `127.0.0.1`.

## Key Files

```
turbo.json                              # Build pipeline dependency order
pnpm-workspace.yaml                     # Workspace members + catalog
tsconfig.base.json                      # Shared compiler settings
oxlint.config.ts, .oxfmtrc.json         # Linting/formatting
packages/core/package.json              # Private, dependency source-of-truth
packages/core/src/utils/git.ts          # Exec-discipline boundary
apps/cli/package.json                   # Must mirror core's runtime deps
apps/cli/tsdown.config.ts               # deps.alwaysBundle + copy-web-dist onSuccess
apps/cli/scripts/copy-web-dist.mjs      # Published-asset mirror (web + atlas dists)
apps/cli/src/server.ts                  # Dashboard mounts + JSON endpoints
packages/scene/src/                     # Framework-free browser derivations (TS source, no build)
apps/web/src/utils/                     # Classic-only styling helpers (cn, classMaps, colors)
apps/web/vite.config.ts                 # base: './' — classic must work under /classic/
apps/atlas/dev/devData.ts               # Node-side Vite dev plugin — the sanctioned core value import
apps/atlas/test/noRawHtml.test.ts       # Bans {@html}/innerHTML/outerHTML/insertAdjacentHTML in src
apps/docs/.vitepress/config.ts          # VitePress site — separate deploy
.releaserc.json                         # Publishing scope — CLI only, pre-1.0 guard
.github/workflows/                      # ci.yml (install-smoke), publish.yml, docs.yml
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file:123 (or <package boundary>)
What's wrong: <one-line description>
Why it matters: <impact on build, release, or runtime>
Suggested fix: <concrete change>
```

Skip style/formatting issues entirely — oxlint and oxfmt handle those.

## How to Run

Dispatch the `monorepo-architect` agent. Provide it this checklist plus the current state of: `turbo.json`, `pnpm-workspace.yaml`, `packages/core/package.json`, `apps/cli/package.json`, `apps/cli/tsdown.config.ts`, `apps/cli/scripts/copy-web-dist.mjs`, `.releaserc.json`, `apps/web/vite.config.ts`, `oxlint.config.ts`, and the results of grepping `apps/web/src/`, `apps/atlas/src/` and `packages/scene/src/` for value imports from core.

First action: diff `jq -r '.dependencies | keys[]' packages/core/package.json` against the same for `apps/cli/package.json` — any core dep not mirrored in cli is the highest-severity finding. Then walk the checklist, citing war stories when a finding maps to a recurring class of bug.

## Related Audits

- Findings in §1 (boundary violations) → run **audit-web**
- Findings in §3–§4 (bundled-deps / asset-mirror drift) → run **audit-cli**
- Findings in §5 (exec discipline) → run **audit-core**
- Findings in §8 (docs coupling) → run `/sync-docs`
