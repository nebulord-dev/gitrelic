import { existsSync } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';

// ─── Running git ───────────────────────────────────────────────────────────────

/** Limit for the quick lookups: rev-parse, branch, ls-tree, check-mailmap. */
export const GIT_QUICK_TIMEOUT_MS = 30_000;
/**
 * Default limit for the heavy reads (`git log`, the rename log, `cat-file
 * --batch`). Far above what a large repo's full history needs: it's there to
 * end a hung process, not to rush a slow one. `--git-timeout` overrides it.
 */
export const GIT_HEAVY_TIMEOUT_MS = 600_000;

let quickTimeoutMs = GIT_QUICK_TIMEOUT_MS;
/** @internal Tests only: shortens the quick limit; no argument restores it. */
export function setGitQuickTimeoutForTests(ms = GIT_QUICK_TIMEOUT_MS): void {
  quickTimeoutMs = ms;
}

// git must never wait for input: a credential prompt (or Git Credential
// Manager's dialog) would hang the run with nothing on screen. Merged into
// process.env (execa extends it by default).
const GIT_ENV = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };

/** A git process ran past its time limit and was killed. */
export class GitTimeoutError extends Error {
  constructor(
    /** The subcommand, e.g. `git log`. */
    readonly command: string,
    readonly repoPath: string,
    readonly timeoutMs: number,
    /** Whether `--git-timeout` raises this call's limit. */
    overridable: boolean,
  ) {
    super(
      `${command} timed out after ${formatSeconds(timeoutMs)} in ${repoPath}. ` +
        (overridable
          ? 'For a very large repository, raise the limit with --git-timeout <seconds>.'
          : 'git may be stuck on a lock file or a slow filesystem.'),
    );
    this.name = 'GitTimeoutError';
  }
}

function formatSeconds(ms: number): string {
  const s = ms / 1000;
  return `${Number.isInteger(s) ? s : s.toFixed(1)} s`;
}

interface GitCall {
  repoPath: string;
  timeoutMs: number;
  /** A heavy read, whose limit `--git-timeout` sets. */
  heavy?: boolean;
}

/** execa's failure, as a GitTimeoutError when the limit killed git. */
function timeoutOr(err: unknown, args: string[], call: GitCall): unknown {
  if ((err as { timedOut?: boolean }).timedOut !== true) return err;
  return new GitTimeoutError(
    `git ${args[0]}`,
    call.repoPath,
    call.timeoutMs,
    !!call.heavy,
  );
}

/**
 * Runs git and returns its stdout. Every git call goes through here (the
 * streaming `cat-file` uses the same options and `timeoutOr`), so none can
 * run without a time limit or wait on a prompt.
 */
async function runGit(args: string[], call: GitCall): Promise<string> {
  try {
    const { stdout } = await execa('git', args, {
      cwd: call.repoPath,
      timeout: call.timeoutMs,
      env: GIT_ENV,
      stdin: 'ignore',
    });
    return stdout;
  } catch (err) {
    throw timeoutOr(err, args, call);
  }
}

// ─── Raw git primitives ────────────────────────────────────────────────────────

export interface FileStats {
  file: string;
  insertions: number;
  deletions: number;
}

export interface CoAuthor {
  name: string;
  email: string;
}

export interface RawCommit {
  hash: string;
  authorEmail: string;
  authorName: string;
  date: string; // ISO
  message: string;
  coAuthors: CoAuthor[];
  files: string[];
  fileStats: FileStats[];
  insertions: number;
  deletions: number;
}

/**
 * Fetches all commits with their changed files using git log.
 * Format: COMMIT␟hash␟email␟name␟date (0x1F-separated — names can contain
 * '|', and a shifted field once corrupted every date), then MSG|subject, then
 * TRAILERS|<co-author values separated by 0x1F>, then numstat lines.
 * Co-author trailers live in commit bodies (not subjects), so we rely on
 * git's native trailer parser via %(trailers:...) instead of regexing %B.
 * %aE/%aN (not %ae/%an) apply the repo's .mailmap to author identity.
 * @see https://git-scm.com/docs/git-log
 * @param repoPath - The path to the git repository.
 * @param options - Optional parameters for filtering commits.
 * @returns An array of RawCommit objects representing the commits in the repository.
 */
export async function getAllCommits(
  repoPath: string,
  options: { since?: string; ref?: string; timeoutMs?: number } = {},
): Promise<RawCommit[]> {
  const args = [
    'log',
    '--format=COMMIT%x1F%H%x1F%aE%x1F%aN%x1F%aI%nMSG|%s%nTRAILERS|%(trailers:key=Co-authored-by,valueonly,separator=%x1F)',
    '--numstat',
    '--no-merges',
  ];

  if (options.since) args.push(`--since=${options.since}`);
  // `ref` should be a resolved commit id (see resolveCommit); `--end-of-options`
  // keeps even a hostile value from being parsed as a git flag.
  if (options.ref) args.push('--end-of-options', options.ref);

  const stdout = await runGit(args, {
    repoPath,
    timeoutMs: options.timeoutMs ?? GIT_HEAVY_TIMEOUT_MS,
    heavy: true,
  });
  const commits = parseGitLog(stdout);
  await mailmapCoAuthors(repoPath, commits);
  return commits;
}

// git applies .mailmap to %aE/%aN but not to %(trailers), so co-author
// identities would otherwise stay split from the same person's authorship.
// Argument form (not --stdin) keeps this working on git < 2.43.
const CHECK_MAILMAP_BATCH = 100;

async function mailmapCoAuthors(
  repoPath: string,
  commits: RawCommit[],
): Promise<void> {
  const contacts = new Set<string>();
  for (const c of commits) {
    for (const co of c.coAuthors) contacts.add(formatContact(co));
  }
  if (contacts.size === 0) return;

  let mapped: Map<string, CoAuthor>;
  try {
    mapped = await checkMailmap(repoPath, [...contacts]);
  } catch {
    // A trailer value git can't parse as a contact, or a check-mailmap that
    // timed out, shouldn't sink the whole analysis — unmapped co-authors are
    // still correct, just possibly split.
    return;
  }
  for (const c of commits) {
    c.coAuthors = c.coAuthors.map((co) => mapped.get(formatContact(co)) ?? co);
  }
}

function formatContact(co: CoAuthor): string {
  return co.name ? `${co.name} <${co.email}>` : `<${co.email}>`;
}

/**
 * Resolves contacts through the repo's mailmap via `git check-mailmap`.
 * Returns only contacts whose identity actually changed.
 */
export async function checkMailmap(
  repoPath: string,
  contacts: string[],
): Promise<Map<string, CoAuthor>> {
  const out = new Map<string, CoAuthor>();
  for (let i = 0; i < contacts.length; i += CHECK_MAILMAP_BATCH) {
    const batch = contacts.slice(i, i + CHECK_MAILMAP_BATCH);
    const stdout = await runGit(['check-mailmap', ...batch], {
      repoPath,
      timeoutMs: quickTimeoutMs,
    });
    // One output line per input contact, in order.
    stdout.split('\n').forEach((line, j) => {
      const parsed = parseCoAuthorValues(line)[0];
      if (parsed && line !== batch[j]) out.set(batch[j], parsed);
    });
  }
  return out;
}

const CO_AUTHOR_VALUE_REGEX = /^(.*?)\s*<([^>]+)>\s*$/;

function parseCoAuthorValues(raw: string): CoAuthor[] {
  if (!raw) return [];
  const out: CoAuthor[] = [];
  for (const entry of raw.split('\u001F')) {
    const match = CO_AUTHOR_VALUE_REGEX.exec(entry);
    if (match) {
      out.push({ name: match[1].trim(), email: match[2].trim() });
    }
  }
  return out;
}

const FIELD_SEP = '\u001F';
const HEADER_PREFIX = `COMMIT${FIELD_SEP}`;

// numstat reports a rename as `old => new` or, when the paths share a prefix
// or suffix, `pre/{old => new}/post` (either side of the braces may be empty).
const BRACE_RENAME_RE = /^(.*)\{(.*) => (.*)\}(.*)$/;

/**
 * Resolves a numstat path to the file that exists after the commit, so a
 * rename is attributed to the new name instead of being dropped (or kept as
 * a bogus "old => new" path). Plain paths, including ones with literal braces,
 * pass through unchanged.
 */
export function renameTarget(file: string): string {
  if (!file.includes(' => ')) return file;
  const brace = file.match(BRACE_RENAME_RE);
  if (brace) {
    const [, prefix, , to, suffix] = brace;
    return `${prefix}${to}${suffix}`.replace(/\/{2,}/g, '/').replace(/^\//, '');
  }
  return file.slice(file.lastIndexOf(' => ') + 4);
}

export function parseGitLog(raw: string): RawCommit[] {
  const commits: RawCommit[] = [];
  let current: RawCommit | null = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith(HEADER_PREFIX)) {
      if (current) commits.push(current);
      const [, hash, authorEmail, authorName, date] = line.split(FIELD_SEP);
      current = {
        hash,
        authorEmail,
        authorName,
        date,
        message: '',
        coAuthors: [],
        files: [],
        fileStats: [],
        insertions: 0,
        deletions: 0,
      };
    } else if (current && line.startsWith('MSG|')) {
      current.message = line.slice(4); // everything after "MSG|"
    } else if (current && line.startsWith('TRAILERS|')) {
      current.coAuthors = parseCoAuthorValues(line.slice(9));
    } else if (current && line.trim()) {
      // numstat lines: "insertions\tdeletions\tfilepath"
      const parts = line.split('\t');
      if (parts.length === 3) {
        const [ins, del, rawFile] = parts;
        const file = rawFile ? renameTarget(rawFile) : '';
        if (file) {
          current.files.push(file);
          current.fileStats.push({
            file,
            insertions: parseInt(ins, 10) || 0,
            deletions: parseInt(del, 10) || 0,
          });
          current.insertions += parseInt(ins, 10) || 0;
          current.deletions += parseInt(del, 10) || 0;
        }
      }
    }
  }

  if (current) commits.push(current);
  return commits;
}

// ─── Noise file filtering ──────────────────────────────────────────────────────

const IGNORED_PATTERNS = {
  exact: new Set([
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
    'next-env.d.ts',
    'vite-env.d.ts',
    'CONTRIBUTING.md',
    'CLAUDE.md',
  ]),
  // Binary / generated / vendored extensions that would pollute LOC counts
  // and churn analysis if treated as source.
  extensions: new Set([
    '.ico',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.avif',
    '.pdf',
    '.wasm',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.min.js',
    '.min.css',
    '.map',
  ]),
  // Note: `docs/` is deliberately NOT filtered. Many projects keep real,
  // actively-maintained source under docs/ (MDX, generated API references,
  // ADRs) and silently excluding those skews every analyzer.
  prefixes: ['.next/', 'dist/', 'coverage/', '.claude/'],
};

export function isIgnored(file: string): boolean {
  const basename = file.split('/').pop() ?? file;

  if (IGNORED_PATTERNS.exact.has(basename)) return true;

  for (const ext of IGNORED_PATTERNS.extensions) {
    if (file.endsWith(ext)) return true;
  }

  for (const prefix of IGNORED_PATTERNS.prefixes) {
    if (file.startsWith(prefix)) return true;
  }

  return false;
}

// ─── Analyzed tree ─────────────────────────────────────────────────────────────
//
// Everything about "the files" — which exist, how long they are — is read from
// the analyzed commit's tree, never the working copy. Otherwise `--branch other`
// pairs other's history with the checked-out branch's files, and uncommitted
// edits leak into LOC.

/**
 * Resolves a branch, tag or revision to a commit id, failing with a readable
 * message instead of a buried git error. All later git calls use the returned
 * id, so commits, files and LOC are guaranteed to describe the same snapshot.
 */
export async function resolveCommit(
  repoPath: string,
  rev = 'HEAD',
): Promise<string> {
  const unknown = () =>
    new Error(
      rev === 'HEAD'
        ? 'This repository has no commits yet.'
        : `Unknown branch or revision: "${rev}" (expected a single branch, tag or commit — ranges like a..b aren't supported)`,
    );
  // A leading dash would be read as a git option. Rejected up front rather
  // than via `--end-of-options`, which rev-parse only accepts from git 2.30.
  if (rev.startsWith('-')) throw unknown();
  try {
    const stdout = await runGit(
      ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`],
      { repoPath, timeoutMs: quickTimeoutMs },
    );
    return stdout.trim();
  } catch (err) {
    // `--verify --quiet` exits 1 with no output for an unknown revision. Any
    // other failure (git missing, not a repo, permissions) is a real error
    // and must not be reported as a typo.
    if ((err as { exitCode?: number }).exitCode === 1) throw unknown();
    throw err;
  }
}

export interface TreeBlob {
  path: string;
  /** Git object id of the file's contents at the analyzed commit. */
  oid: string;
  isSymlink: boolean;
}

/**
 * Lists the files in a commit's tree (excluding noise per isIgnored).
 * Submodules (gitlinks) are skipped — they aren't files in this repo.
 */
export async function getTreeBlobs(
  repoPath: string,
  ref: string,
): Promise<TreeBlob[]> {
  const stdout = await runGit(
    ['ls-tree', '-r', '-z', '--full-tree', '--end-of-options', ref],
    { repoPath, timeoutMs: quickTimeoutMs },
  );
  return parseLsTree(stdout).filter((b) => !isIgnored(b.path));
}

/** Parses `git ls-tree -r -z` output: `<mode> <type> <oid>\t<path>\0`. */
export function parseLsTree(raw: string): TreeBlob[] {
  const out: TreeBlob[] = [];
  for (const entry of raw.split('\0')) {
    if (!entry) continue;
    const tab = entry.indexOf('\t');
    const [mode, type, oid] = entry.slice(0, tab).split(' ');
    if (type !== 'blob') continue;
    out.push({ path: entry.slice(tab + 1), oid, isSymlink: mode === '120000' });
  }
  return out;
}

// git's own binary heuristic: a NUL byte in the first 8000 bytes.
const BINARY_SNIFF_BYTES = 8000;
const NEWLINE = 0x0a;

/**
 * Incrementally parses `git cat-file --batch` output into a line count per
 * object id. Fed raw chunks, which may split a header or body anywhere, so a
 * whole repository's contents never have to sit in memory at once.
 * Binary and missing objects map to null.
 */
export class BlobLineCounter {
  readonly results = new Map<string, number | null>();
  private header: number[] = [];
  private oid = '';
  private remaining = -1; // bytes of body left; -1 = reading a header
  private bodyOffset = 0;
  private newlines = 0;
  private binary = false;
  private lastByte = NEWLINE;
  private skipTerminator = false;

  push(chunk: Buffer): void {
    let i = 0;
    while (i < chunk.length) {
      if (this.skipTerminator) {
        // Each body is followed by one LF that isn't part of the blob.
        this.skipTerminator = false;
        i++;
        continue;
      }
      if (this.remaining < 0) {
        const lf = chunk.indexOf(NEWLINE, i);
        if (lf === -1) {
          for (; i < chunk.length; i++) this.header.push(chunk[i]);
          return;
        }
        for (; i < lf; i++) this.header.push(chunk[i]);
        i++; // the header's LF
        this.startBlob(Buffer.from(this.header).toString('utf8'));
        this.header = [];
        continue;
      }
      const end = Math.min(chunk.length, i + this.remaining);
      // Byte-by-byte only while still inside the binary sniff window; past it,
      // native indexOf finds newlines far faster than a JS loop.
      const sniffEnd = Math.min(
        end,
        i + Math.max(0, BINARY_SNIFF_BYTES - this.bodyOffset),
      );
      for (let j = i; j < sniffEnd; j++) {
        const byte = chunk[j];
        if (byte === NEWLINE) this.newlines++;
        else if (byte === 0) this.binary = true;
      }
      // Bounded view, so the search can't run past this blob into the next
      // object's header.
      const body = chunk.subarray(0, end);
      for (
        let j = body.indexOf(NEWLINE, sniffEnd);
        j !== -1;
        j = body.indexOf(NEWLINE, j + 1)
      ) {
        this.newlines++;
      }
      if (end > i) this.lastByte = chunk[end - 1];
      this.bodyOffset += end - i;
      this.remaining -= end - i;
      i = end;
      if (this.remaining === 0) this.finishBlob();
    }
  }

  private startBlob(header: string): void {
    const [oid, type, size] = header.split(' ');
    if (type === 'missing' || size === undefined) {
      this.results.set(oid, null);
      return;
    }
    this.oid = oid;
    this.remaining = Number(size);
    this.bodyOffset = 0;
    this.newlines = 0;
    this.binary = false;
    this.lastByte = NEWLINE;
    if (this.remaining === 0) this.finishBlob();
  }

  private finishBlob(): void {
    const size = this.bodyOffset;
    // Same rule as counting a file's text: a final line without a trailing
    // newline still counts.
    const lines =
      size === 0 ? 0 : this.newlines + (this.lastByte === NEWLINE ? 0 : 1);
    this.results.set(this.oid, this.binary ? null : lines);
    this.remaining = -1;
    this.skipTerminator = true;
  }
}

/**
 * Counts lines for each object id by streaming one `git cat-file --batch`
 * process — no working-copy reads, one subprocess for the whole tree.
 */
export async function countBlobLines(
  repoPath: string,
  oids: string[],
  timeoutMs = GIT_HEAVY_TIMEOUT_MS,
): Promise<Map<string, number | null>> {
  const unique = [...new Set(oids)];
  const counter = new BlobLineCounter();
  if (unique.length === 0) return counter.results;
  const args = ['cat-file', '--batch'];
  const proc = execa('git', args, {
    cwd: repoPath,
    input: unique.join('\n') + '\n',
    buffer: false,
    timeout: timeoutMs,
    env: GIT_ENV,
  });
  try {
    for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
      counter.push(chunk);
    }
    await proc;
  } catch (err) {
    // The read loop can fail while git still runs (counting threw): kill it,
    // or the wait below lasts as long as git does. `kill` is false when git
    // has already exited, e.g. after the time limit killed it.
    const killedHere = proc.kill();
    // Wait for `proc` (so its rejection is never left unhandled) and report
    // its error when the limit was hit or git failed on its own; when we
    // killed it, the read loop's error is the real cause.
    const final = await proc.then(
      () => err,
      (procErr: unknown) => procErr,
    );
    const timedOut = (final as { timedOut?: boolean }).timedOut === true;
    throw timeoutOr(killedHere && !timedOut ? err : final, args, {
      repoPath,
      timeoutMs,
      heavy: true,
    });
  }
  return counter.results;
}

/**
 * Resolves the root of the working tree containing `startPath`, the same way a
 * bare `git` command does — so gitrelic can be invoked from any subdirectory
 * rather than only from the repo root.
 *
 * Delegating to `git rev-parse` rather than walking up looking for `.git` also
 * gets worktrees, submodules (where `.git` is a file, not a directory) and
 * `GIT_CEILING_DIRECTORIES` right for free.
 *
 * @param startPath - Any path inside the repository.
 * @returns The absolute path to the working-tree root, normalized to native
 *   separators, or null if `startPath` is not inside a git working tree (which
 *   includes bare repos) or does not exist.
 * @throws If the git binary is not on PATH — callers must not report that as
 *   "not a git repository", which would send the user to fix the wrong thing.
 */
export async function resolveRepoRoot(
  startPath: string,
): Promise<string | null> {
  try {
    const stdout = await runGit(['rev-parse', '--show-toplevel'], {
      repoPath: startPath,
      timeoutMs: quickTimeoutMs,
    });
    // `--show-toplevel` always emits forward slashes, even on Windows. Normalize
    // so `repoPath` keeps the native separators the old path.resolve() produced,
    // since it gets serialized into the report the dashboard renders.
    return stdout.trim() ? path.normalize(stdout.trim()) : null;
  } catch (err) {
    // A hung git isn't "not a repository" either.
    if (err instanceof GitTimeoutError) throw err;
    // ENOENT covers two very different causes: a missing git binary, and a cwd
    // that does not exist. Only the former is worth surfacing — if startPath
    // itself is gone, null is the honest answer.
    if ((err as { code?: string }).code === 'ENOENT' && existsSync(startPath)) {
      throw new Error(
        'git was not found on PATH — gitrelic requires git to be installed.',
      );
    }
    return null;
  }
}

/**
 * Returns the current branch name.
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const stdout = await runGit(['branch', '--show-current'], {
      repoPath,
      timeoutMs: quickTimeoutMs,
    });
    return stdout.trim() || 'HEAD';
  } catch {
    return 'HEAD';
  }
}

/**
 * Returns all local branch names.
 */
export async function getBranches(repoPath: string): Promise<string[]> {
  const stdout = await runGit(['branch', '--format=%(refname:short)'], {
    repoPath,
    timeoutMs: quickTimeoutMs,
  });
  return stdout.split('\n').filter(Boolean);
}

/**
 * Fetches the raw rename log for a repo. Returns an empty string if git fails,
 * so the rename-tracking analyzer can degrade gracefully. A timeout is thrown
 * instead, so the runner's fallback reports it rather than "no renames".
 */
export async function getRenameLog(
  repoPath: string,
  options: { since?: string; ref?: string; timeoutMs?: number } = {},
): Promise<string> {
  const args = [
    'log',
    '--diff-filter=R',
    '--find-renames',
    '--name-status',
    '--format=COMMIT|%H|%aI',
    '--no-merges',
  ];

  if (options.since) args.push(`--since=${options.since}`);
  if (options.ref) args.push('--end-of-options', options.ref);

  try {
    return await runGit(args, {
      repoPath,
      timeoutMs: options.timeoutMs ?? GIT_HEAVY_TIMEOUT_MS,
      heavy: true,
    });
  } catch (err) {
    if (err instanceof GitTimeoutError) throw err;
    return '';
  }
}

/**
 * Detects the primary language by counting file extensions.
 */
export function detectPrimaryLanguage(files: string[]): string {
  const extCounts: Record<string, number> = {};
  const langMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    py: 'Python',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    cs: 'C#',
    cpp: 'C++',
    c: 'C',
    php: 'PHP',
    swift: 'Swift',
    kt: 'Kotlin',
  };

  for (const file of files) {
    const ext = file.split('.').pop()?.toLowerCase() ?? '';
    if (langMap[ext]) extCounts[ext] = (extCounts[ext] ?? 0) + 1;
  }

  const top = Object.entries(extCounts).sort((a, b) => b[1] - a[1])[0];
  return top ? (langMap[top[0]] ?? top[0]) : 'Unknown';
}
