import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runGitrelic } from '../runner.js';
import {
  BlobLineCounter,
  countBlobLines,
  getAllCommits,
  getCurrentBranch,
  getRenameLog,
  GitTimeoutError,
  resolveCommit,
  resolveRepoRoot,
  setGitQuickTimeoutForTests,
} from './git.js';

// A fake git, first on PATH. GITSTUB picks its behaviour:
// - hang: every subcommand sleeps (cat-file writes a byte first, so the
//   timeout lands mid-stream);
// - env: prints the prompt-suppressing variables git was given;
// - log-hang: everything else answers at once (rev-parse with a commit id),
//   and only `log` sleeps;
// - mailmap-hang: `log` returns one commit with a co-author, and only
//   `check-mailmap` sleeps.
// `exec sleep` replaces the shell, so the kill reaches the sleeping process and
// no orphan keeps the output pipe open.
const STUB = `#!/bin/sh
case "$GITSTUB" in
  env) echo "$GIT_TERMINAL_PROMPT/$GCM_INTERACTIVE"; exit 0 ;;
  log-hang)
    if [ "$1" = "log" ]; then exec sleep 5; fi
    echo 0123456789abcdef0123456789abcdef01234567; exit 0 ;;
  mailmap-hang)
    if [ "$1" = "log" ]; then
      printf 'COMMIT\\037abc\\037a@x.com\\037Ann\\0372024-01-01T00:00:00Z\\nMSG|m\\nTRAILERS|Bo <b@x.com>\\n'
      exit 0
    fi
    exec sleep 5 ;;
  *)
    if [ "$1" = "cat-file" ]; then printf 'x'; fi
    exec sleep 5 ;;
esac
`;

const LIMIT = 200;
let dir: string;

describe.skipIf(process.platform === 'win32')('git time limits', () => {
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'gitrelic-stub-'));
    const bin = path.join(dir, 'bin');
    await mkdir(bin);
    await writeFile(path.join(bin, 'git'), STUB);
    await chmod(path.join(bin, 'git'), 0o755);
    vi.stubEnv('PATH', `${bin}${path.delimiter}${process.env.PATH}`);
    vi.stubEnv('GITSTUB', 'hang');
    setGitQuickTimeoutForTests(LIMIT);
  });

  afterEach(async () => {
    setGitQuickTimeoutForTests();
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it('kills a hung quick lookup with an error naming it', async () => {
    const err = await resolveCommit(dir).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitTimeoutError);
    expect(err).toMatchObject({
      command: 'git rev-parse',
      repoPath: dir,
      timeoutMs: LIMIT,
    });
    // --git-timeout only sets the heavy limit, so it isn't offered here.
    expect((err as Error).message).not.toContain('--git-timeout');
  });

  it('honours the heavy limit it is given, and points at --git-timeout', async () => {
    const start = Date.now();
    const err = await getAllCommits(dir, { timeoutMs: LIMIT }).catch(
      (e: unknown) => e,
    );
    expect(Date.now() - start).toBeLessThan(3000);
    expect(err).toMatchObject({ command: 'git log', timeoutMs: LIMIT });
    expect((err as Error).message).toBe(
      `git log timed out after 0.2 s in ${dir}. For a very large repository, raise the limit with --git-timeout <seconds>.`,
    );
  });

  it('kills a cat-file stream mid-read and rejects', async () => {
    const err = await countBlobLines(dir, ['abc'], LIMIT).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(GitTimeoutError);
    expect(err).toMatchObject({ command: 'git cat-file' });
  });

  it('kills cat-file when counting throws, instead of waiting it out', async () => {
    // The stub writes a byte, then sleeps 5 s; the limit is far beyond that.
    const boom = new Error('counting failed');
    const push = vi
      .spyOn(BlobLineCounter.prototype, 'push')
      .mockImplementation(() => {
        throw boom;
      });
    try {
      const start = Date.now();
      const err = await countBlobLines(dir, ['abc'], 60_000).catch(
        (e: unknown) => e,
      );
      expect(Date.now() - start).toBeLessThan(2000);
      expect(err).toBe(boom);
    } finally {
      push.mockRestore();
    }
  });

  it('reports a hung repo-root lookup instead of "not a repository"', async () => {
    await expect(resolveRepoRoot(dir)).rejects.toBeInstanceOf(GitTimeoutError);
  });

  it('throws a rename-log timeout rather than reporting no renames', async () => {
    await expect(
      getRenameLog(dir, { timeoutMs: LIMIT }),
    ).rejects.toBeInstanceOf(GitTimeoutError);
  });

  it('falls back to the current branch being HEAD', async () => {
    await expect(getCurrentBranch(dir)).resolves.toBe('HEAD');
  });

  it('keeps unmapped co-authors when check-mailmap hangs', async () => {
    vi.stubEnv('GITSTUB', 'mailmap-hang');
    const [commit] = await getAllCommits(dir, { timeoutMs: 5000 });
    expect(commit.coAuthors).toEqual([{ name: 'Bo', email: 'b@x.com' }]);
  });

  it('never lets git wait on a prompt', async () => {
    vi.stubEnv('GITSTUB', 'env');
    await expect(getCurrentBranch(dir)).resolves.toBe('0/never');
  });

  it('fails the run on a hung git log, at the limit it was given', async () => {
    // History is fatal: no analyzer fallback may swallow its timeout.
    vi.stubEnv('GITSTUB', 'log-hang');
    await expect(
      runGitrelic({ repoPath: dir, gitTimeoutMs: LIMIT }),
    ).rejects.toMatchObject({
      name: 'GitTimeoutError',
      command: 'git log',
      timeoutMs: LIMIT,
    });
  });
});
