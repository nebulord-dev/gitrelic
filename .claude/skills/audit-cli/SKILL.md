---
name: audit-cli
description: Use when auditing apps/cli for Ink component issues, Commander flag edge cases, web server path traversal, JSON mode correctness, or process exit behavior.
---

# Audit: apps/cli

The published `gitlore` package. Audit for correctness, robustness, and the invariants that keep it installable and safe when serving the web dashboard.

## Checklist

### 1. Packaging Invariant

The published `gitlore` package has `@gitlore/core: workspace:*` as a runtime dependency, but `@gitlore/core` is `private: true` in its `package.json`. This is a latent publishing bug — once `pnpm publish` rewrites `workspace:*` to a real version, npm install will fail because core was never published.

Verify on every audit:

- Is `packages/core/package.json` still `"private": true`?
- Is there any bundling configured in `apps/cli/tsup.config.ts` (e.g. `noExternal: ['@gitlore/core']`) that would inline core's source?
- Has the cli been published to npm? If yes, how does it actually resolve core at install time?

This is the single highest-priority finding — fix direction is either: make core public, bundle core into cli via tsup's `noExternal`, or stop publishing cli.

### 2. Commander Setup (`src/index.tsx`)

Flags: `--path`, `--branch`, `--since`, `--web`, `--json`, `--shame`, `--parallel`.

- Does `--path` get validated as an existing directory before `runGitlore` is called? What happens with a path that exists but isn't a git repo?
- Does `--branch` get validated as an existing branch? A typo currently produces a git error buried in an exception
- Does `--since` accept arbitrary strings and pass them to `git log --since=`? Malformed values fail late
- Does `--json` suppress ALL non-JSON output, including Ink rendering and `ink-spinner` output? Currently the JSON path short-circuits before `render(<GitloreApp />)` — verify nothing else writes to stdout during the run
- Are exit codes correct? (0 = success, non-zero = error — CI consumers depend on this.) The JSON path uses `process.exit(0/1)`; the Ink path relies on Ink's natural exit. Does an analyzer throw in Ink mode leave the process hanging or exit cleanly?

### 3. Web Server Security (`src/index.tsx` → `serveWebDashboard`)

The `--web` flag starts an HTTP server on port 7777 serving `apps/web/dist` + the in-memory report. Review for:

- **Path traversal** — the current check is `resolved.startsWith(webDist + path.sep)`. Verify:
  - On Windows, `path.sep` is `\` — does `webDist` include a trailing separator mismatch?
  - What about `req.url` containing encoded `%2e%2e` sequences? `path.resolve` will decode them, but the URL parser may not
  - Symlinks inside `webDist` that escape the directory — `path.resolve` won't catch these
- **Port 7777 hardcoded** — if the port is in use, `server.listen(7777)` throws. No fallback to the next free port. At minimum, the error message should be helpful
- **Server shutdown** — there is no SIGINT/SIGTERM handler. Pressing Ctrl+C leaves the server orphaned (Ink may swallow the signal). Verify the process actually dies
- **Report endpoint** — `GET /gitlore-report.json` serves the in-memory `GitloreReport`. Verify `Content-Type` is set and no other data (e.g. env vars, stack traces) can leak
- **MIME map** — the hardcoded map covers `.html/.js/.css/.json/.svg`. Fonts, images, source maps, and WASM fall through to `text/plain`. Is that a problem for the dashboard?

### 4. Ink Component Patterns

Ink (React for terminals) has specific rules that differ from browser React. Review `apps/cli/src/components/App.tsx` and `src/index.tsx`'s inline `GitloreApp`:

- `useEffect` with async operations must handle unmount. The current `useEffect(() => { runGitlore(...).then(...).catch(...) }, [])` has no cleanup — if the user Ctrl-C's mid-scan, does anything leak?
- `runGitlore` can take several minutes on large repos. Is there any way to cancel it? Currently no
- Components rendering large data (all 22 analyzer reports) should not re-render excessively — check for unstabilized object/array props passed to memoized children
- `setProgress(string)` is called frequently from inside `runGitlore`. Verify it doesn't trigger full tree re-renders

### 5. `App.tsx` Phases

- `loading` — progress string updates while `runGitlore` runs
- `results` — displays the report
- `error` — surfaces errors from `runGitlore`
- `--web` transition — "Opening web dashboard..." is set, then `serveWebDashboard` blocks forever on `server.listen`. Does the UI show anything useful during that wait?

Verify:

- Error phase shows the full error message and exits non-zero (currently it only `setError(err.message)` and the UI keeps running forever)
- `showShame` and `showParallel` flags correctly gate their panels

### 6. Process Hygiene

- After Ink renders results, does the process exit cleanly? Ink can leave stdin in raw mode if not shut down properly
- Any stray `console.log` or `process.stdout.write` from core analyzers will corrupt the Ink UI — grep `packages/core/src` for any stdout writes

## Key Files

```
apps/cli/
├── package.json            # Dep on @gitlore/core — publishing invariant
├── tsup.config.ts          # Bundling config — check for noExternal
└── src/
    ├── index.tsx           # Commander entry, JSON path, web server, GitloreApp
    └── components/
        └── App.tsx         # Root Ink component — phases, error, panel gating
```

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. Start with the packaging invariant (§1), then web server security (§3), then Commander flag validation (§2). Skip style issues entirely.
