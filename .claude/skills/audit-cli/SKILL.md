---
name: audit-cli
description: Use when auditing apps/cli for bundled-deps drift, published-package runtime parity, Ink component issues, Commander flag edge cases, web server path traversal / mount routing / port / error-listener correctness, child process cleanup, JSON mode correctness, or process exit behavior. Run before merging any change that touches apps/cli/.
---

# Audit: apps/cli

The published `gitrelic` package. Audit for correctness, robustness, and the two invariants that keep it installable — the bundled-deps mirror (cli's `node_modules` must satisfy core's `require(...)` calls) and the published-asset mirror (both dashboards must ship inside `dist/`: classic in `dist/web/`, Atlas in `dist/atlas/`).

## Checklist

### 1. Bundled-Deps Mirror

`@gitrelic/core` is bundled inline via tsdown `deps.alwaysBundle`. Every runtime dep of core must also appear in `apps/cli/package.json` dependencies — the bundled code does `require('execa')` (and anything else core declares) against cli's own `node_modules`.

- CI job `install-smoke` enforces this: `jq` diff between `packages/core/package.json` and `apps/cli/package.json`. Confirm the job is still present and still fails on drift
- Manually: `comm -23 <(jq -r '.dependencies|keys[]' packages/core/package.json | sort) <(jq -r '.dependencies|keys[]' apps/cli/package.json | sort)` must be empty
- Version ranges should match — a looser range in one side can resolve to different versions in production
- If a new dep is added to core in the same branch, `apps/cli/package.json` must be updated in the same commit

### 2. Published-Package Runtime Parity

The monorepo layout and the published tarball layout are **not the same**. Anything the CLI reads at runtime from a path relative to its own `dist/index.js` must exist in both layouts, or it works in development and crashes on `npx gitrelic`. This is the class of bug that caused `--web` to throw `ENOENT: node_modules/web/dist/index.html` through v1.4.2 — the original CI smoke test only exercised `--json` and missed it entirely.

- **`files` field in `apps/cli/package.json`** — currently `["dist"]`. Any runtime asset outside `dist/` is a latent crash. Grep `src/` for `readFileSync`, `existsSync`, `createReadStream`, dynamic `import()`, and every `new URL(..., import.meta.url)` — every resolved path must land under `dist/` after build
- **Every `new URL(..., import.meta.url)` in `src/`** — trace the resolved path in **both** layouts:
  - Monorepo: `apps/cli/dist/index.mjs`
  - Published: `node_modules/gitrelic/dist/index.mjs`
  - If they differ, the referenced asset must be bundled into `dist/` at build time via a tsdown `onSuccess` hook
- **`fileURLToPath` vs `URL#pathname`** — any runtime path derived from `import.meta.url` must go through `fileURLToPath`. On Windows, `pathname` returns `/C:/Users/...` with a leading slash before the drive letter, which `node:fs` can't open. Every such site must use `fileURLToPath(new URL(..., import.meta.url))`. This failure mode passes every macOS/Linux smoke test
- **tsdown `onSuccess` copy hooks** — `scripts/copy-web-dist.mjs` (name predates Atlas) copies `apps/web/dist` → `dist/web` and `apps/atlas/dist` → `dist/atlas`. It must **fail loudly** for each one when the dist or its `index.html` is missing, not silently skip. Verify each `existsSync` guard is followed by `process.exit(1)` with a message naming the package to build (`pnpm --filter @gitrelic/web build` / `@gitrelic/atlas`)
- **Turbo build ordering via workspace deps** — `apps/cli/package.json` declares `@gitrelic/web` and `@gitrelic/atlas` as `devDependencies` with `workspace:*` specifically so turbo orders both dashboard builds before the cli build. If either is removed, the builds race and the tarball ends up with missing or stale assets
- **Classic under a sub-path** — `--ui atlas` serves classic from `/classic/`, which only works because `apps/web/vite.config.ts` sets `base: './'`. A change there breaks classic's assets in that mode while `--web` keeps working
- **Install smoke test coverage** — CI `install-smoke` packs the tarball, installs it in a clean dir, runs `--json` (asserts every top-level analyzer field is populated), checks `dist/web/index.html` and `dist/atlas/index.html` exist, runs `--web --no-open` (probes the HTTP endpoint), and runs `--ui atlas --no-open` (Atlas `<title>` at `/`, classic at `/classic/` plus one of its relative scripts, the lite report with empty `commits`, and the commit index). Any newly-added flag, mode or mount must be added to this coverage
- **Pack-and-diff manually** — when in doubt, run `cd apps/cli && pnpm pack && tar -tzf gitrelic-*.tgz | sort > /tmp/tarball.txt` and compare against what `src/` references at runtime. Any `src/` file reference not in the tarball is a latent crash

### 3. Commander Setup (`src/index.tsx`)

Flags: `--path`, `--branch`, `--since`, `--no-merge-identities`, `--include-fixtures`, `--web`, `--ui <classic|atlas>`, `--no-open`, `--json`, `--shame`, `--parallel`.

- `--path` must be validated as an existing directory AND containing a `.git/` before `runGitrelic` is called. Current code does both checks upfront with clean error messages — verify they stay in place
- `--branch` validation: a typo currently produces a git error buried inside an analyzer exception. Consider validating before the scan starts
- `--since` accepts arbitrary strings (including `"all"` for full history) and passes them to `git log --since=`. Malformed values fail late inside core — acceptable, but confirm the failure path is clean
- `--json` must suppress ALL non-JSON output, including Ink rendering and `ink-spinner`. Current code short-circuits with `process.stdout.write(JSON.stringify(...))` before `render(<GitrelicApp />)` — verify nothing else writes to stdout during the JSON path
- `--ui` uses Commander's `.choices(['classic', 'atlas'])`, implies `--web`, and is rejected together with `--json` before any scan starts (exit 1, message on stderr). `apps/cli/test/web-ui.test.ts` pins all three — keep it in step with any new dashboard value
- `--no-open` serves without launching a browser (`opts.open === false`); CI and the integration tests depend on it. It must not suppress the `GITRELIC_PORT=` line
- **Exit codes** — 0 on success, non-zero on error. CI consumers depend on this. The JSON path uses `process.exit(0/1)`; the Ink path uses `process.exitCode = 1` + `inkInstance.unmount()` + `waitUntilExit`. Verify the Ink error path actually exits non-zero, not just renders an error state and hangs
- **`-v` vs `-V`** — past bug: Commander's default uses `-V` for version. `.version(pkg.version, '-v, --version')` explicitly registers the lowercase alias. Don't let a refactor drop it

### 4. Web Server (`src/server.ts`, wired up by `serveWebDashboard` in `src/index.tsx`)

`--web` / `--ui` start a local HTTP server: `createDashboardServer({ report, mounts })` serves one or more built dashboards plus the in-memory report. Mounts are `{ prefix, dist }`; the default (and `--ui classic`) mounts `dist/web` at `/`, `--ui atlas` mounts `dist/atlas` at `/` and `dist/web` at `/classic/`. Review for:

- **Host-header check** — `isAllowedHost` rejects (403) any request whose `Host` isn't `localhost`/`127.0.0.1`/`[::1]` on our port, before anything else runs. This is the DNS-rebinding defense; it must apply to every route, static and JSON alike. Routing uses only `pathname` from the parsed URL — never `URL#host`, which an absolute-form request target controls
- **Mount routing** — `findMount` picks the longest matching prefix; prefixes must start and end with `/` (the handler throws at construction otherwise). A bare `/classic` 308-redirects to `/classic/` so relative asset URLs resolve against the mount. Only a mount's root serves its `index.html`: other extensionless paths 302 to the mount root (both dashboards keep state in the hash and load assets relative to the page, so a shell at `/a/b` would render blank), and missing asset-looking paths are 404. Verify a new mount can't shadow the JSON endpoints or another mount's assets
- **JSON endpoints at the root** — `/gitrelic-report.json` (full), `/gitrelic-report.lite.json` (`commits: []`) and `/gitrelic-commits.json` (`buildCommitIndex`) are matched before any mount, whatever the mounts are. Each is serialized and gzipped once on first request, then cached; `Cache-Control: no-store`, `Vary: Accept-Encoding`. No other data (env vars, stack traces) must leak. Rate-limiting is unnecessary (localhost-only), but any future change that binds to `0.0.0.0` must revisit this
- **Path traversal** — `resolveStaticPath(dist, pathname)` runs per mount on the path *after* the prefix is stripped. It decodes each segment with `decodeURIComponent` (a decode failure → 400), then rejects `.`, `..`, null bytes, `/` and `\` inside a segment, so encoded traversal like `/%2e%2e/etc/passwd` or `%2f` is caught in decoded form. A belt-and-braces boundary check (`startsWith(dist + path.sep)`) is the final gate. Verify each layer is still in place and in order — if decoding ever moves after the checks, encoded traversal slips through
- **Symlinks inside a dist** — the boundary check doesn't catch symlinks that escape the directory. Low-risk because both dists are produced by the build and contain only static assets, but worth noting if the build ever starts copying user content
- **Listen host and retry** — `listenOnFreePort(server, 7777)` binds the real server to `127.0.0.1` and walks forward on `EADDRINUSE` (10 attempts), with no separate probe — so there's no gap between "port is free" and "we own it". Verify it still binds `127.0.0.1` and the bailout surfaces a useful error
- **Listen error handler** — every `http.Server` / `net.Server` has an `.once('error', reject)` listener attached **before** `server.listen()` is called, and `serveWebDashboard` adds a persistent `'error'` listener once listening. An unhandled `'error'` event crashes the process with a raw Node stack trace (EADDRINUSE, EACCES) instead of producing a rejection the UI can render. Grep every `.listen(` call in the package and confirm each has a sibling error listener
- **Request errors** — the handler wraps everything in try/catch: 500 (or `res.destroy()` once headers are sent) and a stderr line, never a crash. Only `GET`/`HEAD` are served (405 otherwise)
- **MIME map** — covers the common web asset types (html/js/mjs/css/json/map/svg/png/jpg/webp/avif/ico/woff/woff2/ttf/wasm, …); unknown extensions fall back to `application/octet-stream` with `X-Content-Type-Options: nosniff`. Flag asset types either dashboard ships that the map lacks
- **Server shutdown** — pressing Ctrl-C currently relies on Ink tearing down and the Node default SIGINT handler killing the process. There's no explicit SIGINT/SIGTERM listener that calls `server.close()`. Orphaned server sockets are the risk; verify with a manual test (Ctrl-C the CLI and check `lsof -i :7777`)
- **Structured port line** — `process.stderr.write('GITRELIC_PORT=${port}\n')` emits a machine-parseable line so CI and scripts don't have to parse Ink's ANSI output. Don't let a refactor drop it — the install-smoke job relies on it

### 5. Ink Component Patterns

Ink (React for terminals) has specific rules that differ from browser React. Review `apps/cli/src/components/App.tsx` and `src/index.tsx`'s inline `GitrelicApp`:

- `useEffect` with async operations must handle unmount. The current `useEffect(() => { runGitrelic(...).then(...).catch(...) }, [])` has no cleanup — if the user Ctrl-C's mid-scan, the spawned `git log` processes may outlive the CLI. Verify behavior with a manual test
- `runGitrelic` can take several minutes on large repos. Currently there is no way to cancel it mid-scan. Out of scope for most audits, but flag if a cancellation token is ever partially added
- `setProgress(string)` is called frequently from inside `runGitrelic`. Verify it doesn't trigger full tree re-renders (shouldn't, because the progress string is a single scalar state)
- Components rendering large data (all 22 analyzer reports) should not re-render excessively — check for unstabilized object/array props passed to memoized children

### 6. `App.tsx` Phases and Exit Flow

- `loading` — progress string updates while `runGitrelic` runs. If progress stops updating for >30s, user-facing feedback is poor; consider a dots animation
- `results` — displays the report summary. In `--web` mode, waits for `serveWebDashboard` to return a port before transitioning
- `error` — surfaces errors from `runGitrelic`. Must set `process.exitCode = 1` and trigger unmount via `setShouldExit(true)` — not just render the error forever
- The `shouldExit` / `inkInstance.unmount()` dance exists because calling `unmount()` synchronously after `setReport(...)` can race the final render. A `useEffect` watching `shouldExit` ensures the final frame flushes first. Don't let a refactor collapse this back into a synchronous unmount

### 7. Child Process Cleanup

Scans spawn `git log`, `git rev-parse`, `git ls-tree`, `git cat-file --batch`, `git branch` and `git check-mailmap` via execa inside `utils/git.ts`. The CLI owns the process lifecycle.

- On SIGINT mid-scan, are all spawned `git` processes killed? Orphaned node/git processes after Ctrl-C is a user-visible failure mode
- Does the Ink app unmount cleanly so the terminal isn't left broken (cursor hidden, alt-screen active, stdin in raw mode)? Ink handles most of this, but a thrown exception during render can leave the terminal in a bad state
- Any in-flight `execa` call should have its child's stdio drained — truncated reads from a `git log` pipe can manifest as partial reports rather than an error

### 8. Non-TTY / Piped Stdin

Ink and terminal libraries behave oddly when stdin isn't a TTY.

- `gitrelic --json | jq` — CLI skips the Ink render entirely (current code short-circuits on `opts.json`). Verify no stray `process.stdout.write` from core analyzers corrupts the JSON
- `gitrelic < /dev/null` without `--json` — Ink handles non-TTY stdin by rendering once and exiting. Verify this still holds
- `gitrelic --web` inside a CI runner — `open(url)` runs unless `--no-open` is passed; a failed launch is caught and turned into a stderr hint (`could not open a browser; visit <url>`), not a crash. CI and tests pass `--no-open`. Verify the `.catch` stays — an unhandled rejection from `open` on a headless box would kill the server

### 9. Process Hygiene

- After Ink renders results (non-`--web` path), does the process exit cleanly? The current code relies on `setShouldExit(true)` + `inkInstance.unmount()` + `await inkInstance.waitUntilExit()`. Verify the node process actually exits — not just the Ink UI
- Any stray `console.log` or `process.stdout.write` from core analyzers corrupts the Ink UI and the `--json` output. Grep `packages/core/src` for any stdout writes
- `process.exitCode` vs `process.exit(N)` — the JSON path uses `process.exit(0/1)`; the Ink path uses `process.exitCode`. Both are acceptable, but mixing them (set exitCode, then call `process.exit()` with a different value) produces inconsistent results

### 10. Error Surfacing

- Unhandled rejection during the scan: the current catch handler sets `error` state and `process.exitCode = 1`. Verify the error phase shows the full error message (not just `err.message` — the stack can be valuable for bug reports) and doesn't hang
- `--json` errors write to stderr and exit non-zero. Verify stderr output is valid text (no partial JSON chunks) so CI consumers can distinguish stdout JSON from stderr diagnostics

## Key Files

```
apps/cli/
├── package.json                      # Mirrors core deps — publishing invariant
├── tsdown.config.ts                  # deps.alwaysBundle + onSuccess copy
├── scripts/copy-web-dist.mjs         # Published-asset mirror (web + atlas) — must fail loudly
├── test/web-ui.test.ts               # --ui / --no-open integration tests (spawn the built binary)
└── src/
    ├── index.tsx                     # Commander entry, JSON path, serveWebDashboard (mounts), GitrelicApp
    ├── server.ts                     # createDashboardServer: Host check, mounts, JSON endpoints, traversal guard
    └── components/
        └── App.tsx                   # Root Ink component — phases, error, panel gating
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file.ts:123
What's wrong: <one-line description>
Why it matters: <impact on users or maintainers>
Suggested fix: <concrete change>
```

Skip style issues entirely. Prioritize in this order: bundled-deps drift → published-package runtime parity → web server security → child-process / Ink cleanup → everything else.

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. First action: run the bundled-deps diff (see §1) and surface the result. Second action: enumerate every `new URL(..., import.meta.url)` in `src/` and every `readFileSync`/`existsSync`/`createReadStream` call (see §2) and trace each to its runtime-resolved path. Then work through the web server checklist, then Commander, then Ink.

When §2 flags anything that changes what ships in the tarball, verify the fix with a real pack-and-install cycle: `cd apps/cli && pnpm pack && cd /tmp/newdir && npm install /path/to/gitrelic-*.tgz && ./node_modules/.bin/gitrelic --path /some/repo --web`. Don't trust the monorepo build alone — it's precisely the layouts-are-different bugs that §2 exists to catch.

## Related Audits

- Changes to `apps/cli/src/server.ts` or the mounts in `index.tsx` → cross-check **audit-web** (report loading, classic under `/classic/`)
- Changes to `apps/cli/package.json` dependencies → run **audit-architecture** (bundled-deps invariant)
- Changes to report rendering or consumed types → run **audit-core** (upstream source of truth)
