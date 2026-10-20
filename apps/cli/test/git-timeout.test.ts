import { existsSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = path.join(cliDir, 'dist', 'index.mjs');

// A fake git that answers the quick lookups at once and hangs on `git log`.
// `exec sleep` replaces the shell, so the kill reaches the sleeping process.
const STUB = `#!/bin/sh
case "$1" in
  log) exec sleep 5 ;;
  rev-parse)
    if [ "$2" = "--show-toplevel" ]; then pwd; else echo 0123456789abcdef0123456789abcdef01234567; fi ;;
esac
`;

describe('gitrelic --git-timeout', () => {
  let dir: string;
  let bin: string;

  beforeAll(async () => {
    if (!existsSync(binary)) {
      throw new Error(
        `Built CLI not found at ${binary}. Run \`pnpm build\` before \`pnpm test\`.`,
      );
    }
    dir = await mkdtemp(path.join(await realpath(tmpdir()), 'gitrelic-stub-'));
    bin = path.join(dir, 'bin');
    await mkdir(bin);
    await writeFile(path.join(bin, 'git'), STUB);
    await chmod(path.join(bin, 'git'), 0o755);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it.each(['0', '-5', 'abc'])('rejects %s', async (value) => {
    const { exitCode, stderr } = await execa(
      process.execPath,
      [binary, '--json', '--git-timeout', value],
      { reject: false },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('expected a positive number of seconds');
  });

  it('rejects a limit past what a Node timer holds', async () => {
    // 2,147,484 s is 2^31 ms and change: a timer that long fires at once.
    const { exitCode, stderr } = await execa(
      process.execPath,
      [binary, '--json', '--git-timeout', '2147484'],
      { reject: false },
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('expected at most 2147483 seconds');
  });

  it.skipIf(process.platform === 'win32')(
    'accepts a fractional limit and applies it',
    async () => {
      const { exitCode, stderr } = await execa(
        process.execPath,
        [binary, '--json', '--path', dir, '--git-timeout', '0.5'],
        {
          reject: false,
          env: { PATH: `${bin}${path.delimiter}${process.env.PATH}` },
        },
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain('git log timed out after 0.5 s');
    },
  );

  it.skipIf(process.platform === 'win32')(
    'fails a hung git log with its limit on stderr, stdout left empty',
    async () => {
      const { exitCode, stdout, stderr } = await execa(
        process.execPath,
        [binary, '--json', '--path', dir, '--git-timeout', '0.2'],
        {
          reject: false,
          env: { PATH: `${bin}${path.delimiter}${process.env.PATH}` },
        },
      );
      expect(exitCode).toBe(1);
      expect(stdout).toBe('');
      expect(stderr).toContain(
        `Error: git log timed out after 0.2 s in ${dir}. For a very large repository, raise the limit with --git-timeout <seconds>.`,
      );
    },
  );
});
