import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { beforeAll, describe, expect, it } from 'vitest';

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = path.join(cliDir, 'dist', 'index.mjs');
const repoRoot = path.resolve(cliDir, '..', '..');

beforeAll(() => {
  // Same rule as json-output.test.ts: fail loudly rather than skip.
  if (!existsSync(binary)) {
    throw new Error(
      `Built CLI not found at ${binary}. Run \`pnpm build\` before \`pnpm test\`.`,
    );
  }
});

describe('gitrelic --ui', () => {
  it('serves Atlas at / and classic at /classic/ without opening a browser', async () => {
    const child = execa(
      process.execPath,
      [binary, '--since', '1 month ago', '--ui', 'atlas', '--no-open'],
      { cwd: repoRoot, reject: false },
    );
    try {
      // GITRELIC_PORT=N is the CLI's machine-readable "server is up" line.
      const port = await new Promise<number>((resolve, reject) => {
        let stderr = '';
        child.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
          const match = /GITRELIC_PORT=(\d+)/.exec(stderr);
          if (match) resolve(Number(match[1]));
        });
        child.on('exit', (code) =>
          reject(new Error(`CLI exited (${code}) before serving:\n${stderr}`)),
        );
      });
      const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`);

      const atlas = await (await get('/')).text();
      expect(atlas).toContain('<title>Gitrelic Atlas</title>');

      const classic = await (await get('/classic/')).text();
      expect(classic).toContain('<title>Gitrelic — Git Archaeology</title>');
      // base: './' — the classic bundle must load from under /classic/.
      const script = /src="\.\/(assets\/[^"]+\.js)"/.exec(classic)?.[1];
      expect(script).toBeDefined();
      expect((await get(`/classic/${script}`)).status).toBe(200);

      const lite = (await (await get('/gitrelic-report.lite.json')).json()) as {
        commits: unknown[];
      };
      expect(lite.commits).toEqual([]);
      expect((await get('/gitrelic-commits.json')).status).toBe(200);
    } finally {
      child.kill();
      await child;
    }
  });

  it('rejects an unknown dashboard', async () => {
    const { exitCode, stderr } = await execa(
      process.execPath,
      [binary, '--ui', 'bogus'],
      { cwd: repoRoot, reject: false },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/Allowed choices are classic, atlas/);
  });

  it('refuses --ui together with --json', async () => {
    const { exitCode, stderr, stdout } = await execa(
      process.execPath,
      [binary, '--ui', 'atlas', '--json'],
      { cwd: repoRoot, reject: false },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/pick one/);
    expect(stdout).toBe('');
  });
});
