import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { useState, useEffect } from 'react';
import {
  GIT_HEAVY_TIMEOUT_MS,
  runGitrelic,
  resolveRepoRoot,
} from '@gitrelic/core';
import { InvalidArgumentError, Option, program } from 'commander';
import { render } from 'ink';
import open from 'open';

import { App } from './components/App.js';
import {
  createDashboardServer,
  listenOnFreePort,
  type DashboardMount,
} from './server.js';
import type { GitrelicReport } from '@gitrelic/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
);

/** `--git-timeout`: a positive number of seconds (fractions allowed). */
function parseSeconds(value: string): number {
  const seconds = Number(value);
  if (!value.trim() || !Number.isFinite(seconds) || seconds <= 0) {
    throw new InvalidArgumentError('expected a positive number of seconds.');
  }
  return seconds;
}

program
  .name('gitrelic')
  .description(
    'Git archaeology — understand the history and health of your codebase',
  )
  .version(pkg.version, '-v, --version')
  .option(
    '-p, --path <path>',
    'Path to the git repository, or any directory inside it',
    process.cwd(),
  )
  .option(
    '-b, --branch <branch>',
    'Branch to analyze (default: current branch)',
  )
  .option(
    '-s, --since <date>',
    'Only analyze commits since this date (default: "12 months ago", use "all" for full history)',
    '12 months ago',
  )
  .option(
    '--no-merge-identities',
    "Don't merge one person's split author emails (case variants, GitHub noreply, same full name)",
  )
  .option(
    '--include-fixtures',
    'Count test fixtures, snapshots and generated code in ownership metrics (bus factor, ghost files, knowledge silos)',
  )
  .option(
    '--git-timeout <seconds>',
    `Give up on each long git read (history, line counts) after this many seconds (default: ${GIT_HEAVY_TIMEOUT_MS / 1000})`,
    parseSeconds,
  )
  .option('--web', 'Open web dashboard after analysis')
  .addOption(
    new Option(
      '--ui <dashboard>',
      'Dashboard to serve (implies --web): classic, or the Atlas preview',
    ).choices(['classic', 'atlas']),
  )
  .option('--no-open', "Serve the dashboard but don't open a browser")
  .option('--json', 'Output raw JSON report to stdout')
  .option('--shame', 'Show commit message forensics / shame leaderboard panel')
  .option('--parallel', 'Show parallel development leaderboard panel')
  .parse();

const opts = program.opts<{
  path: string;
  branch?: string;
  since?: string;
  mergeIdentities: boolean;
  includeFixtures?: boolean;
  gitTimeout?: number;
  web?: boolean;
  ui?: 'classic' | 'atlas';
  open: boolean;
  json?: boolean;
  shame?: boolean;
  parallel?: boolean;
}>();

if (opts.json && opts.ui) {
  process.stderr.write(
    'Error: --ui serves a dashboard and --json prints a report; pick one.\n',
  );
  process.exit(1);
}
const web = opts.web || opts.ui !== undefined;

const inputPath = path.resolve(opts.path);
const since = opts.since === 'all' ? undefined : opts.since;
const gitTimeoutMs =
  opts.gitTimeout === undefined ? undefined : opts.gitTimeout * 1000;

// Validate the repo path up front so we can fail with a clean message instead
// of a buried git stderr trace from deep inside the analyzer stack.
if (!existsSync(inputPath)) {
  process.stderr.write(`Error: path does not exist: ${inputPath}\n`);
  process.exit(1);
}

// Resolve to the working-tree root so gitrelic can be run from any
// subdirectory, the way every other git command can. Checking for `.git`
// directly would only ever match the repo root.
let resolvedRoot: string | null = null;
try {
  resolvedRoot = await resolveRepoRoot(inputPath);
} catch (err) {
  // Thrown only when git itself is missing. Reporting that as "not a git
  // repository" would send the user to debug the one thing that isn't wrong.
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exit(1);
}
if (!resolvedRoot) {
  process.stderr.write(
    `Error: not a git repository: ${inputPath}\n` +
      'Run gitrelic from inside a git repository, or point it at one with --path <repo>.\n',
  );
  process.exit(1);
}
// Re-bound so the non-null type reaches the React callbacks below — control-flow
// narrowing from the process.exit() guard doesn't survive into those closures.
const repoPath: string = resolvedRoot;

// Analysis is always whole-repo, so a subdirectory silently becomes something
// broader than what was asked for. Say so. stderr specifically: stdout has to
// stay parseable in --json mode.
if (repoPath !== inputPath) {
  process.stderr.write(`Analyzing repository root: ${repoPath}\n`);
}

if (opts.json) {
  // Non-interactive JSON mode
  try {
    const report = await runGitrelic({
      repoPath,
      branch: opts.branch,
      since,
      mergeIdentities: opts.mergeIdentities,
      includeFixtures: opts.includeFixtures,
      gitTimeoutMs,
      version: pkg.version,
    });
    // A consumer that stops reading early (`gitrelic --json | head`) makes Node
    // emit 'error' on stdout, which is fatal if unhandled. Awaiting the flush
    // below is what makes that reachable — the old synchronous exit killed the
    // process before the event could fire. Closing early is normal shell usage,
    // not a failure, so exit 0.
    process.stdout.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPIPE') process.exit(0);
      process.stderr.write(`Error: failed to write report: ${err.message}\n`);
      process.exit(1);
    });

    // process.exit() discards whatever is still queued in Node's userspace
    // write buffer. On a TTY stdout is synchronous so that never shows, but on
    // a pipe — the whole point of --json — writes are async, and exiting
    // immediately truncated the report at the pipe capacity (64KB) while still
    // reporting success. Wait for the flush before exiting.
    //
    // write()'s callback receives an Error as its first argument on failure.
    // Dropping it would reintroduce this PR's own bug by another route: a short
    // write to a full disk would exit 0 with partial output.
    const writeError = await new Promise<Error | null | undefined>(
      (resolve) => {
        process.stdout.write(JSON.stringify(report, null, 2), (err) =>
          resolve(err),
        );
      },
    );
    if (writeError) {
      process.stderr.write(
        `Error: failed to write report: ${writeError.message}\n`,
      );
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

// Interactive Ink mode.
function GitrelicApp() {
  const [report, setReport] = useState<GitrelicReport | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [webPort, setWebPort] = useState<number | undefined>(undefined);
  // Drives unmount from a useEffect so React has a full render cycle to flush
  // the final frame (report or error) before Ink tears down. Setting this to
  // true triggers the effect *after* the state update that caused it has been
  // painted, avoiding the race where unmount() fires before the output appears.
  const [shouldExit, setShouldExit] = useState(false);

  useEffect(() => {
    if (shouldExit) inkInstance.unmount();
  }, [shouldExit]);

  useEffect(() => {
    runGitrelic({
      repoPath,
      branch: opts.branch,
      since,
      mergeIdentities: opts.mergeIdentities,
      includeFixtures: opts.includeFixtures,
      gitTimeoutMs,
      version: pkg.version,
      onProgress: setProgress,
    })
      .then(async (result) => {
        setReport(result);
        if (web) {
          const port = await serveWebDashboard(result);
          setWebPort(port);
        } else {
          setShouldExit(true);
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        process.exitCode = 1;
        setShouldExit(true);
      });
  }, []);

  return (
    <App
      report={report}
      progress={progress}
      error={error}
      version={pkg.version}
      showShame={opts.shame ?? false}
      showParallel={opts.parallel ?? false}
      webPort={webPort}
    />
  );
}

// Capture the render instance so success/error paths can unmount cleanly.
// waitUntilExit() resolves once unmount() is called, allowing the process
// to exit naturally without fragile setTimeout delays.
const inkInstance = render(<GitrelicApp />);
await inkInstance.waitUntilExit();

async function serveWebDashboard(report: GitrelicReport): Promise<number> {
  // The dashboards are copied into the cli's own dist/ at build time
  // (see scripts/copy-web-dist.mjs) so they ship inside the published package
  // and resolves identically in the monorepo and in node_modules installs.
  //
  // Use fileURLToPath rather than URL#pathname: on Windows, pathname returns
  // `/C:/Users/...` with a leading slash before the drive letter, which the
  // fs module can't open. fileURLToPath normalizes it to a real OS path.
  const dist = (name: string) =>
    fileURLToPath(new URL(`./${name}`, import.meta.url));
  // Atlas takes the root and keeps classic one link away, for the analyzers
  // it doesn't cover yet.
  const mounts: DashboardMount[] =
    opts.ui === 'atlas'
      ? [
          { prefix: '/', dist: dist('atlas') },
          { prefix: '/classic/', dist: dist('web') },
        ]
      : [{ prefix: '/', dist: dist('web') }];
  const server = createDashboardServer({ report, mounts });
  const port = await listenOnFreePort(server, 7777);
  // Once listening, a later server error would otherwise be an unhandled
  // 'error' event and kill the CLI. Report it and keep serving.
  server.on('error', (err) => {
    process.stderr.write(`gitrelic: dashboard server error: ${err.message}\n`);
  });
  // Structured line for machine consumption (CI, scripts). Ink's colored
  // output can embed ANSI codes that break naive grep; this is always clean.
  process.stderr.write(`GITRELIC_PORT=${port}\n`);
  // 127.0.0.1, not localhost: the server binds IPv4 loopback only, and
  // localhost can resolve to ::1 first. A missing browser (CI, SSH) is not a
  // failure — the dashboard is still reachable at the printed URL.
  const url = `http://127.0.0.1:${port}`;
  if (!opts.open) return port;
  open(url).catch(() => {
    process.stderr.write(`gitrelic: could not open a browser; visit ${url}\n`);
  });
  return port;
}
