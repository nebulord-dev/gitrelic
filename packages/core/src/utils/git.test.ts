import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterEach, vi } from 'vitest';

import {
  BlobLineCounter,
  parseGitLog,
  resolveCommit,
  isIgnored,
  renameTarget,
  resolveRepoRoot,
} from './git.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates an empty directory that git is forbidden from escaping, so
 * "not a repo" assertions can't be broken by an ancestor checkout — a real risk
 * on Windows (tmpdir lives under the user profile) and with TMPDIR overrides or
 * container CI mounts.
 *
 * Two subtleties, both verified against real git rather than assumed:
 * - The ceiling must be the *parent*. Setting it to the directory itself does
 *   not stop the upward search — git still walks past it and finds an ancestor
 *   repo, which would make these assertions pass vacuously.
 * - realpath matters: GIT_CEILING_DIRECTORIES entries are matched literally and
 *   are not resolved through symlinks, and macOS /tmp is a symlink to
 *   /private/tmp.
 */
async function makeSealedDir(): Promise<string> {
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), 'gitrelic-'));
  vi.stubEnv('GIT_CEILING_DIRECTORIES', path.dirname(dir));
  return dir;
}

/** Builds a getAllCommits header line (fields are 0x1F-separated). */
function header(hash: string, email: string, name: string, date: string) {
  return ['COMMIT', hash, email, name, date].join('\u001F');
}

describe('parseGitLog', () => {
  it('parses a single commit with numstat', () => {
    const raw = [
      header('abc123', 'alice@example.com', 'Alice', '2025-01-15T10:00:00Z'),
      'MSG|fix: handle edge case',
      '10\t2\tsrc/index.ts',
      '5\t0\tsrc/utils.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(1);
    expect(commits[0].hash).toBe('abc123');
    expect(commits[0].authorEmail).toBe('alice@example.com');
    expect(commits[0].authorName).toBe('Alice');
    expect(commits[0].message).toBe('fix: handle edge case');
    expect(commits[0].files).toEqual(['src/index.ts', 'src/utils.ts']);
    expect(commits[0].insertions).toBe(15);
    expect(commits[0].deletions).toBe(2);
  });

  it('parses multiple commits', () => {
    const raw = [
      header('aaa', 'alice@example.com', 'Alice', '2025-01-15T10:00:00Z'),
      'MSG|feat: new thing',
      '1\t0\tfile-a.ts',
      '',
      header('bbb', 'bob@example.com', 'Bob', '2025-01-16T10:00:00Z'),
      'MSG|revert: undo bad change',
      '2\t1\tfile-b.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(2);
    expect(commits[0].message).toBe('feat: new thing');
    expect(commits[1].message).toBe('revert: undo bad change');
  });

  it('returns empty array for empty input', () => {
    expect(parseGitLog('')).toEqual([]);
  });

  it('attributes a whole-path rename to the new path', () => {
    const raw = [
      header('abc', 'a@b.com', 'A', '2025-01-15T10:00:00Z'),
      'MSG|chore: rename',
      '2\t1\told.ts => new.ts',
    ].join('\n');

    const [commit] = parseGitLog(raw);
    expect(commit.files).toEqual(['new.ts']);
    expect(commit.fileStats).toEqual([
      { file: 'new.ts', insertions: 2, deletions: 1 },
    ]);
  });

  it('expands brace-style renames to the new path', () => {
    const raw = [
      header('abc', 'a@b.com', 'A', '2025-01-15T10:00:00Z'),
      'MSG|chore: rename files',
      '5\t3\tsrc/{old => new}/file.ts',
      '0\t0\tsrc/{a.ts => b.ts}',
      '1\t0\tsrc/{ => nested}/x.ts',
      '1\t0\tsrc/{flat => }/y.ts',
      '1\t0\tsrc/clean.ts',
    ].join('\n');

    const [commit] = parseGitLog(raw);
    expect(commit.files).toEqual([
      'src/new/file.ts',
      'src/b.ts',
      'src/nested/x.ts',
      'src/y.ts',
      'src/clean.ts',
    ]);
    expect(commit.insertions).toBe(8);
    expect(commit.message).toBe('chore: rename files');
  });

  it('keeps files whose names contain braces', () => {
    const raw = [
      header('abc', 'a@b.com', 'A', '2025-01-15T10:00:00Z'),
      'MSG|feat: templates',
      '4\t0\tsrc/{slug}.tsx',
    ].join('\n');

    expect(parseGitLog(raw)[0].files).toEqual(['src/{slug}.tsx']);
  });

  it('handles pipe characters in author names', () => {
    // %aN is user-controlled; with a '|' delimiter "Jane | Corp" used to shift
    // the date field and crash commit-timing downstream.
    const raw = [
      header('abc', 'jane@corp.com', 'Jane | Corp', '2025-01-15T10:00:00Z'),
      'MSG|feat: x',
      '1\t0\ta.ts',
    ].join('\n');

    const [commit] = parseGitLog(raw);
    expect(commit.authorName).toBe('Jane | Corp');
    expect(commit.date).toBe('2025-01-15T10:00:00Z');
  });

  it('handles pipe characters in commit messages', () => {
    const raw = [
      header('abc', 'a@b.com', 'A', '2025-01-15T10:00:00Z'),
      'MSG|fix: handle a|b edge case',
      '1\t0\tsrc/a.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits[0].message).toBe('fix: handle a|b edge case');
  });

  it('parses Co-authored-by trailers from the TRAILERS line', () => {
    const raw = [
      header('abc', 'alice@co.com', 'Alice', '2025-01-15T10:00:00Z'),
      'MSG|feat: collab',
      'TRAILERS|Bob <bob@co.com>\u001FCarol <carol@co.com>',
      '1\t0\tshared.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits[0].coAuthors).toEqual([
      { name: 'Bob', email: 'bob@co.com' },
      { name: 'Carol', email: 'carol@co.com' },
    ]);
  });

  it('returns an empty coAuthors array when the TRAILERS line has no values', () => {
    const raw = [
      header('abc', 'alice@co.com', 'Alice', '2025-01-15T10:00:00Z'),
      'MSG|feat: solo',
      'TRAILERS|',
      '1\t0\ta.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits[0].coAuthors).toEqual([]);
  });

  it('skips malformed trailer values', () => {
    const raw = [
      header('abc', 'alice@co.com', 'Alice', '2025-01-15T10:00:00Z'),
      'MSG|feat: weird',
      'TRAILERS|just some text\u001FBob <bob@co.com>',
      '1\t0\ta.ts',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits[0].coAuthors).toEqual([
      { name: 'Bob', email: 'bob@co.com' },
    ]);
  });
});

describe('renameTarget', () => {
  it.each([
    ['src/a.ts', 'src/a.ts'],
    ['old.ts => new.ts', 'new.ts'],
    ['src/{a => b}/c.ts', 'src/b/c.ts'],
    ['{lib => src}/c.ts', 'src/c.ts'],
    ['{nested => }/c.ts', 'c.ts'],
    ['src/{ => deep}/c.ts', 'src/deep/c.ts'],
    ['src/{old.ts => new.ts}', 'src/new.ts'],
    ['src/{slug}.tsx', 'src/{slug}.tsx'],
  ])('%s → %s', (input, expected) => {
    expect(renameTarget(input)).toBe(expected);
  });
});

describe('isIgnored', () => {
  it('ignores lock files by exact name', () => {
    expect(isIgnored('package-lock.json')).toBe(true);
    expect(isIgnored('pnpm-lock.yaml')).toBe(true);
    expect(isIgnored('yarn.lock')).toBe(true);
    expect(isIgnored('bun.lockb')).toBe(true);
  });

  it('ignores lock files in subdirectories', () => {
    expect(isIgnored('packages/app/package-lock.json')).toBe(true);
  });

  it('ignores asset files by extension', () => {
    expect(isIgnored('public/favicon.ico')).toBe(true);
    expect(isIgnored('src/logo.png')).toBe(true);
    expect(isIgnored('assets/icon.svg')).toBe(true);
    expect(isIgnored('fonts/inter.woff2')).toBe(true);
  });

  it('ignores generated files by extension', () => {
    expect(isIgnored('dist/bundle.min.js')).toBe(true);
    expect(isIgnored('styles/app.min.css')).toBe(true);
    expect(isIgnored('dist/index.js.map')).toBe(true);
  });

  it('ignores framework generated files', () => {
    expect(isIgnored('next-env.d.ts')).toBe(true);
    expect(isIgnored('vite-env.d.ts')).toBe(true);
  });

  it('ignores directory prefixes', () => {
    expect(isIgnored('.next/cache/webpack.js')).toBe(true);
    expect(isIgnored('dist/index.js')).toBe(true);
    expect(isIgnored('coverage/lcov.info')).toBe(true);
  });

  it('passes through normal source files', () => {
    expect(isIgnored('src/index.ts')).toBe(false);
    expect(isIgnored('src/components/App.tsx')).toBe(false);
    expect(isIgnored('package.json')).toBe(false);
    expect(isIgnored('README.md')).toBe(false);
    expect(isIgnored('tsconfig.json')).toBe(false);
  });
});

describe('resolveRepoRoot', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the repo root from a nested subdirectory', async () => {
    // This test file lives several levels deep inside the gitrelic repo, so a
    // correct implementation walks up to the same root a bare `git` command
    // would. The single-level `.git` existsSync check this replaced returned
    // null here.
    const fromNested = await resolveRepoRoot(thisDir);
    expect(fromNested).not.toBeNull();
    expect(thisDir.startsWith(fromNested as string)).toBe(true);
  });

  it('is stable regardless of where inside the repo it starts', async () => {
    const fromNested = await resolveRepoRoot(thisDir);
    const fromRoot = await resolveRepoRoot(fromNested as string);
    expect(fromRoot).toBe(fromNested);
  });

  it('returns null outside a git repository', async () => {
    const dir = await makeSealedDir();
    try {
      expect(await resolveRepoRoot(dir)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('honours a ceiling that blocks the repo root', async () => {
    // Guards the test above from silently going vacuous. thisDir is definitely
    // inside a working tree, so this can only pass if the ceiling genuinely
    // stops the search — if sealing ever breaks, this fails instead of the
    // tmpdir assertion quietly passing for the wrong reason. No I/O needed.
    vi.stubEnv('GIT_CEILING_DIRECTORIES', path.dirname(thisDir));
    expect(await resolveRepoRoot(thisDir)).toBeNull();
  });

  it('returns null for a path that does not exist', async () => {
    // Spawning with a missing cwd also raises ENOENT, so this guards against
    // that being mistaken for a missing git binary.
    const missing = path.join(tmpdir(), 'gitrelic-does-not-exist-1a2b3c');
    expect(await resolveRepoRoot(missing)).toBeNull();
  });

  it('throws instead of reporting "not a repository" when git is missing', async () => {
    // An empty PATH makes the git lookup fail with ENOENT while startPath still
    // exists — telling a user their repo isn't a repo would send them to debug
    // the one thing that was never wrong.
    vi.stubEnv('PATH', '');
    await expect(resolveRepoRoot(thisDir)).rejects.toThrow(/not found on PATH/);
  });
});

describe('BlobLineCounter', () => {
  /** Encodes blobs the way `git cat-file --batch` emits them. */
  function batch(blobs: { oid: string; body?: Buffer | string }[]): Buffer {
    const parts: Buffer[] = [];
    for (const { oid, body } of blobs) {
      if (body === undefined) {
        parts.push(Buffer.from(`${oid} missing\n`));
        continue;
      }
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      parts.push(
        Buffer.from(`${oid} blob ${bytes.length}\n`),
        bytes,
        Buffer.from('\n'),
      );
    }
    return Buffer.concat(parts);
  }

  const input = [
    { oid: 'a1', body: 'one\ntwo\nthree\n' }, // 3
    { oid: 'b2', body: 'no trailing newline\nsecond' }, // 2
    { oid: 'c3', body: '' }, // 0
    { oid: 'd4', body: Buffer.from([0x50, 0x4e, 0x00, 0x0a, 0x0a]) }, // binary
    { oid: 'e5' }, // missing
    { oid: 'f6', body: 'ünïcödé\nlines\n' }, // 2 — counts bytes, not chars
  ];
  const expected = new Map<string, number | null>([
    ['a1', 3],
    ['b2', 2],
    ['c3', 0],
    ['d4', null],
    ['e5', null],
    ['f6', 2],
  ]);

  it('counts lines per blob from a single chunk', () => {
    const counter = new BlobLineCounter();
    counter.push(batch(input));
    expect(counter.results).toEqual(expected);
  });

  it('gives identical results however the stream is chunked', () => {
    const whole = batch(input);
    for (const size of [1, 2, 3, 7, 16]) {
      const counter = new BlobLineCounter();
      for (let i = 0; i < whole.length; i += size) {
        counter.push(whole.subarray(i, i + size));
      }
      expect(counter.results).toEqual(expected);
    }
  });

  it('counts identically when chunks straddle the sniff boundary', () => {
    const body = Buffer.concat([
      Buffer.from('ab\n'.repeat(4000)), // 12000 bytes, crosses 8000
      Buffer.from('tail'),
    ]);
    const whole = batch([
      { oid: 'x', body },
      { oid: 'y', body: 'z\n' },
    ]);
    for (const size of [997, 4093, 7999, 8001]) {
      const counter = new BlobLineCounter();
      for (let i = 0; i < whole.length; i += size) {
        counter.push(whole.subarray(i, i + size));
      }
      expect(counter.results.get('x')).toBe(4001);
      expect(counter.results.get('y')).toBe(1);
    }
  });

  it('only sniffs the start of a blob for NUL bytes, like git', () => {
    const body = Buffer.concat([
      Buffer.from('x\n'.repeat(5000)),
      Buffer.from([0x00]),
    ]);
    const counter = new BlobLineCounter();
    counter.push(batch([{ oid: 'big', body }]));
    expect(counter.results.get('big')).toBe(5001);
  });
});

describe('resolveCommit', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('surfaces the real git error outside a repository', async () => {
    // Used to report every failure as "no commits yet" — misleading when the
    // problem is git itself, or not being in a repo at all.
    const dir = await makeSealedDir();
    try {
      await expect(resolveCommit(dir)).rejects.not.toThrow(/no commits yet/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects option-looking revisions without running git', async () => {
    await expect(resolveCommit('/nonexistent', '--output=x')).rejects.toThrow(
      /Unknown branch or revision/,
    );
  });
});
