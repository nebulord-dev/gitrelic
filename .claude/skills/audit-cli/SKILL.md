---
name: audit-cli
description: Use when auditing apps/cli for bundled-deps drift, published-package runtime parity, Ink component issues, Commander flag edge cases, web server path traversal / port / error-listener correctness, child process cleanup, JSON mode correctness, or process exit behavior. Run before merging any change that touches apps/cli/.
---

# Audit: apps/cli

The published `gitrelic` package. Audit for correctness, robustness, and the two invariants that keep it installable — the bundled-deps mirror (cli's `node_modules` must satisfy core's `require(...)` calls) and the published-asset mirror (the web dashboard must ship inside `dist/web/`).

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
- **tsdown `onSuccess` copy hooks** — `scripts/copy-web-dist.mjs` must **fail loudly** when `apps/web/dist/` is missing, not silently skip. Verify the `existsSync` guard is followed by `process.exit(1)` with a helpful message mentioning the fix (`pnpm --filter @gitrelic/web build`)
- **Turbo build ordering via workspace deps** — `apps/cli/package.json` declares `@gitrelic/web` as a `devDependency` with `workspace:*` specifically so turbo orders the web build before the cli build. If that dependency is removed, the builds race and the tarball ends up with missing or stale web assets
- **Install smoke test coverage** — CI `install-smoke` packs the tarball, installs it in a clean dir, runs `--json` (asserts every top-level analyzer field is populated), and runs `--web` (probes the HTTP endpoint). Any newly-added flag or mode must be added to this coverage
- **Pack-and-diff manually** — when in doubt, run `cd apps/cli && pnpm pack && tar -tzf gitrelic-*.tgz | sort > /tmp/tarball.txt` and compare against what `src/` references at runtime. Any `src/` file reference not in the tarball is a latent crash

### 3. Commander Setup (`src/index.tsx`)

Flags: `--path`, `--branch`, `--since`, `--web`, `--json`, `--shame`, `--parallel`.

- `--path` must be validated as an existing directory AND containing a `.git/` before `runGitrelic` is called. Current code does both checks upfront with clean error messages — verify they stay in place
- `--branch` validation: a typo currently produces a git error buried inside an analyzer exception. Consider validating before the scan starts
- `--since` accepts arbitrary strings (including `"all"` for full history) and passes them to `git log --since=`. Malformed values fail late inside core — acceptable, but confirm the failure path is clean
- `--json` must suppress ALL non-JSON output, including Ink rendering and `ink-spinner`. Current code short-circuits with `process.stdout.write(JSON.stringify(...))` before `render(<GitrelicApp />)` — verify nothing else writes to stdout during the JSON path
- **Exit codes** — 0 on success, non-zero on error. CI consumers depend on this. The JSON path uses `process.exit(0/1)`; the Ink path uses `process.exitCode = 1` + `inkInstance.unmount()` + `waitUntilExit`. Verify the Ink error path actually exits non-zero, not just renders an error state and hangs
- **`-v` vs `-V`** — past bug: Commander's default uses `-V` for version. `.version(pkg.version, '-v, --version')` explicitly registers the lowercase alias. Don't let a refactor drop it

### 4. Web Server (`src/index.tsx` → `serveWebDashboard`)

The `--web` flag starts a local HTTP server serving `dist/web/` + the in-memory report. Review for:

- **Path traversal** — current code decodes `req.url`, rejects any segment containing `..` or null bytes, then normalizes every path segment through `path.basename` before joining under `webDist`. A belt-and-braces boundary check (`startsWith(webDist + path.sep)`) is the final gate. Verify each of these layers is still in place and in order
- **URL decoding order** — `decodeURIComponent` runs before the `..`/null-byte check, so encoded traversal like `/%2e%2e/etc/passwd` is caught in normalized form. If that order is ever reversed, encoded traversal slips through
- **Symlinks inside `webDist`** — `path.basename` + `startsWith` boundary checks don't catch symlinks that escape the directory. This is low-risk because `dist/web/` is produced by the build and contains only static assets, but worth noting if the build ever starts copying user content
- **Probe/listen host parity** — the `getFreePort` probe binds to `127.0.0.1` and the real `server.listen` also binds to `127.0.0.1`. These MUST match. On macOS, IPv4 and IPv6 loopback sockets are independent — probing `::` (default) and binding `127.0.0.1` produces false "port free" results. Verify both sites use `'127.0.0.1'`
- **Listen error handler** — every `http.Server` / `net.Server` has an `.once('error', reject)` listener attached **before** `server.listen()` is called. An unhandled `'error'` event crashes the process with a raw Node stack trace (EADDRINUSE, EACCES) instead of producing a rejection the UI can render. Grep every `.listen(` call in the package and confirm each has a sibling error listener
- **Port selection** — `getFreePort` starts at 7777 and walks forward up to 10 attempts. Verify the bailout after 10 attempts surfaces a useful error
- **Report endpoint** — `GET /gitrelic-report.json` sets `Content-Type: application/json` and returns the in-memory `GitrelicReport`. No other data (env vars, stack traces) must leak. Rate-limiting is unnecessary (localhost-only), but any future change that binds to `0.0.0.0` must revisit this
- **MIME map** — the hardcoded map covers `.html`, `.js`, `.css`, `.json`, `.svg`, `.woff`, `.woff2`, `.ttf`, `.map`, `.wasm`. New asset types introduced by the dashboard (e.g. `.ico`, `.webp`) fall through to `text/plain`; flag any gaps
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

Scans spawn `git log`, `git ls-files`, `git branch`, and `git diff` via execa inside `utils/git.ts`. The CLI owns the process lifecycle.

- On SIGINT mid-scan, are all spawned `git` processes killed? Orphaned node/git processes after Ctrl-C is a user-visible failure mode
- Does the Ink app unmount cleanly so the terminal isn't left broken (cursor hidden, alt-screen active, stdin in raw mode)? Ink handles most of this, but a thrown exception during render can leave the terminal in a bad state
- Any in-flight `execa` call should have its child's stdio drained — truncated reads from a `git log` pipe can manifest as partial reports rather than an error

### 8. Non-TTY / Piped Stdin

Ink and terminal libraries behave oddly when stdin isn't a TTY.

- `gitrelic --json | jq` — CLI skips the Ink render entirely (current code short-circuits on `opts.json`). Verify no stray `process.stdout.write` from core analyzers corrupts the JSON
- `gitrelic < /dev/null` without `--json` — Ink handles non-TTY stdin by rendering once and exiting. Verify this still holds
- `gitrelic --web` inside a CI runner — currently calls `open(\`http://localhost:${port}\`)` unconditionally. In a headless CI, `open` will either no-op or error. If this is ever run inside a container, suppress the `open` call when `CI=true`

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
├── scripts/copy-web-dist.mjs         # Published-asset mirror — must fail loudly
└── src/
    ├── index.tsx                     # Commander entry, JSON path, web server, GitrelicApp
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

- Changes to `apps/cli/src/index.tsx`'s web server → cross-check **audit-web** (report loading, CORS parity)
- Changes to `apps/cli/package.json` dependencies → run **audit-architecture** (bundled-deps invariant)
- Changes to report rendering or consumed types → run **audit-core** (upstream source of truth)
