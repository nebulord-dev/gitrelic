import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

import { useState, useEffect } from 'react';

import { runGitlore } from '@gitlore/core';
import { program } from 'commander';
import { render } from 'ink';
import open from 'open';

import { App } from './components/App.js';

import type { GitloreReport } from '@gitlore/core';

program
  .name('gitlore')
  .description('Git archaeology — understand the history and health of your codebase')
  .version('0.1.0')
  .option('-p, --path <path>', 'Path to the git repository', process.cwd())
  .option('-b, --branch <branch>', 'Branch to analyze (default: current branch)')
  .option(
    '-s, --since <date>',
    'Only analyze commits since this date (default: "12 months ago", use "all" for full history)',
    '12 months ago',
  )
  .option('--web', 'Open web dashboard after analysis')
  .option('--json', 'Output raw JSON report to stdout')
  .option('--shame', 'Show commit message forensics / shame leaderboard panel')
  .option('--parallel', 'Show parallel development leaderboard panel')
  .parse();

const opts = program.opts<{
  path: string;
  branch?: string;
  since?: string;
  web?: boolean;
  json?: boolean;
  shame?: boolean;
  parallel?: boolean;
}>();

const repoPath = path.resolve(opts.path);
const since = opts.since === 'all' ? undefined : opts.since;

// Validate the repo path up front so we can fail with a clean message instead
// of a buried git stderr trace from deep inside the analyzer stack.
if (!existsSync(repoPath)) {
  process.stderr.write(`Error: path does not exist: ${repoPath}\n`);
  process.exit(1);
}
if (!existsSync(path.join(repoPath, '.git'))) {
  process.stderr.write(`Error: not a git repository: ${repoPath}\n`);
  process.exit(1);
}

if (opts.json) {
  // Non-interactive JSON mode
  try {
    const report = await runGitlore({
      repoPath,
      branch: opts.branch,
      since,
    });
    process.stdout.write(JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

// Interactive Ink mode.
function GitloreApp() {
  const [report, setReport] = useState<GitloreReport | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runGitlore({
      repoPath,
      branch: opts.branch,
      since,
      onProgress: setProgress,
    })
      .then(async (result) => {
        setReport(result);
        if (opts.web) {
          setProgress('Opening web dashboard...');
          await serveWebDashboard(result);
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        // Render the error frame, then tear down Ink and exit non-zero so
        // shell consumers (CI, scripts) see the failure instead of a hang.
        setTimeout(() => {
          inkInstance.unmount();
          process.exit(1);
        }, 50);
      });
  }, []);

  return (
    <App
      report={report}
      progress={progress}
      error={error}
      showShame={opts.shame ?? false}
      showParallel={opts.parallel ?? false}
    />
  );
}

// Capture the render instance so the error path can unmount cleanly.
const inkInstance = render(<GitloreApp />);

async function serveWebDashboard(report: GitloreReport): Promise<void> {
  const webDist = new URL('../../web/dist', import.meta.url).pathname;
  const port = 7777;

  const server = createServer((req, res) => {
    if (req.url === '/gitlore-report.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
      return;
    }

    // Decode the URL and strip the query string. decodeURIComponent handles
    // percent-encoded traversal sequences (e.g. `/%2e%2e/etc/passwd`) so the
    // explicit `..` / null-byte check below sees them in normalized form.
    let decoded: string;
    try {
      const rawUrl = (req.url ?? '/').split('?')[0];
      decoded = decodeURIComponent(rawUrl);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    // Hard-reject any traversal indicator or null byte before touching the
    // filesystem. This is the primary sanitizer — `path.resolve` + boundary
    // check below is defense-in-depth.
    if (decoded.includes('..') || decoded.includes('\0')) {
      res.writeHead(400);
      res.end();
      return;
    }

    // Collapse to a safe relative segment, then join (not resolve) under the
    // dist root. `path.basename`-per-segment normalization ensures every
    // segment is a simple filename — no '.', no '..', no absolute anchors.
    const rel = decoded.replace(/^\/+/, '');
    const safeSegments = rel
      .split('/')
      .filter((seg) => seg.length > 0)
      .map((seg) => path.basename(seg));
    const safeRel = safeSegments.join('/');
    const candidate =
      safeRel === '' ? path.join(webDist, 'index.html') : path.join(webDist, safeRel);

    // Belt-and-braces boundary check. With the explicit rejections above this
    // should be unreachable, but keeping it protects against any future change
    // that relaxes the input validation.
    const boundary = webDist.endsWith(path.sep) ? webDist : webDist + path.sep;
    if (!candidate.startsWith(boundary) && candidate !== webDist) {
      res.writeHead(403);
      res.end();
      return;
    }

    if (existsSync(candidate)) {
      const ext = path.extname(candidate);
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.map': 'application/json',
        '.wasm': 'application/wasm',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] ?? 'text/plain' });
      res.end(readFileSync(candidate));
    } else {
      // SPA fallback
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(path.join(webDist, 'index.html')));
    }
  });

  // Surface listen errors (most commonly EADDRINUSE) with a clean message
  // instead of an uncaught exception stack trace.
  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new Error(`Port ${port} is already in use. Stop the other process or try again later.`),
        );
      } else {
        reject(err);
      }
    });
    server.listen(port, () => resolve());
  });
  await open(`http://localhost:${port}`);
}
