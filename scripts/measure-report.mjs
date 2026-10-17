#!/usr/bin/env node
// Measures the size of a gitrelic report, broken down by top-level key, so
// decisions about what the dashboard loads up front are based on numbers.
//
// Usage: node scripts/measure-report.mjs <repo-path> [--since <date|all>]
// Requires a built CLI (`pnpm build`).

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'apps/cli/dist/index.mjs');

const [repo, ...rest] = process.argv.slice(2);
if (!repo) {
  console.error(
    'usage: node scripts/measure-report.mjs <repo-path> [--since <date|all>]',
  );
  process.exit(1);
}
if (!existsSync(cli)) {
  console.error(`Built CLI not found at ${cli}. Run \`pnpm build\` first.`);
  process.exit(1);
}

const json = execFileSync('node', [cli, '--path', repo, '--json', ...rest], {
  maxBuffer: 2 ** 31 - 1,
  stdio: ['ignore', 'pipe', 'inherit'],
});
const report = JSON.parse(json.toString('utf8'));

const kb = (n) => `${(n / 1024).toFixed(1).padStart(10)} KB`;
const size = (v) => Buffer.byteLength(JSON.stringify(v));
// The server sends compact JSON; --json pretty-prints, so measure compact.
const total = size(report);

const rows = Object.keys(report)
  .map((key) => ({ key, bytes: size(report[key]) }))
  .sort((a, b) => b.bytes - a.bytes);

console.log(
  `\n${report.repoName}: ${report.meta.totalCommits} commits, ${report.meta.totalFiles} files\n`,
);
for (const { key, bytes } of rows) {
  const pct = ((bytes / total) * 100).toFixed(1).padStart(5);
  console.log(`${key.padEnd(24)}${kb(bytes)}  ${pct}%`);
}
const lite = size({ ...report, commits: [] });
console.log(`${'─'.repeat(48)}`);
console.log(
  `${'total'.padEnd(24)}${kb(total)}   (gzip ${kb(gzipSync(JSON.stringify(report)).length).trim()})`,
);
console.log(`${'without commits'.padEnd(24)}${kb(lite)}`);
if (report.commits.length > 0) {
  console.log(
    `${'bytes per commit'.padEnd(24)}${String(Math.round(size(report.commits) / report.commits.length)).padStart(13)}`,
  );
}
