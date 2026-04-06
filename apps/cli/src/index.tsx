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

// Interactive Ink mode
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
      .catch((err: Error) => setError(err.message));
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

render(<GitloreApp />);

async function serveWebDashboard(report: GitloreReport): Promise<void> {
  const webDist = new URL('../../web/dist', import.meta.url).pathname;
  const port = 7777;

  const server = createServer((req, res) => {
    if (req.url === '/gitlore-report.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
      return;
    }

    const filePath =
      req.url === '/' || req.url === ''
        ? path.join(webDist, 'index.html')
        : path.join(webDist, req.url ?? '');

    if (existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] ?? 'text/plain' });
      res.end(readFileSync(filePath));
    } else {
      // SPA fallback
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(path.join(webDist, 'index.html')));
    }
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  await open(`http://localhost:${port}`);
}
