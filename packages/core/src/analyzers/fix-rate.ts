/**
 * Fix rate — how often a file's changes are followed by a fix of the lines
 * they wrote.
 *
 * ## Method (a lightweight SZZ)
 *
 * 1. A fix is a human commit whose subject says so (`fix`, `bug`, `hotfix`,
 *    `regression`, `oops`, `broke`…) or a revert (`Revert "…"`). Bots are
 *    left out on both sides; merges never reach the analyzers.
 * 2. For each file a fix changed, `git blame` on the lines it changed or
 *    removed (in the fix's parent) names the commits that wrote them.
 * 3. A change is *fixed-after* when a fix within `FIX_WINDOW_DAYS` traced back
 *    to it. Only changes at least that old are rated, so a fresh change isn't
 *    counted clean before it has had the chance to be fixed.
 * 4. Rate = fixed-after / changes, given only from `MIN_CHANGES` rated
 *    changes up: below that one fix swings it by 20 points or more.
 *
 * Why blame and not "any fix touching the file within N days": on React's
 * history that file-level rule blamed the right change 15% of the time (11% on
 * busy files), since a busy file has several innocent changes before every
 * fix. A fix touching more than `MAX_FIX_FILES` files (a sweeping rename or a
 * snapshot update) is left untraced: it would blame every file it passed.
 */

import { classifyAuthor } from '../utils/authorClassification.js';
import { blameFixedLines } from '../utils/git.js';
import type {
  FileFixRate,
  FixRateFix,
  FixRateMonth,
  FixRateReport,
} from '../types.js';
import type { BlameOrigin, RawCommit } from '../utils/git.js';

export const FIX_WINDOW_DAYS = 30;
export const MIN_CHANGES = 8;
export const MAX_FIX_FILES = 20;
const MAX_FIXES_LISTED = 5;
/** Blames run at once: enough to hide git's startup, few enough to stay polite. */
const CONCURRENCY = 6;

const DAY_MS = 86_400_000;
const FIX_WORDS =
  /\b(fix|fixes|fixed|fixing|bugfix|bug|bugs|hotfix|regression|oops|broke|broken)\b/i;
const REVERT = /^revert(s|ed|ing)?\b/i;

/** Whether a subject line marks a fix, a revert, or neither. */
export function fixKind(message: string): 'fix' | 'revert' | null {
  if (REVERT.test(message.trim())) return 'revert';
  return FIX_WORDS.test(message) ? 'fix' : null;
}

/** Blame results: per fix commit, the commits whose lines it changed. */
export type FixOrigins = Map<string, BlameOrigin[]>;

interface Plan {
  human: RawCommit[];
  traced: RawCommit[];
  sweepingSkipped: number;
}

function plan(commits: RawCommit[]): Plan {
  const human = commits.filter((c) => classifyAuthor(c.authorEmail) !== 'bot');
  const fixes = human.filter((c) => fixKind(c.message) !== null);
  const traced = fixes.filter((c) => c.files.length <= MAX_FIX_FILES);
  return { human, traced, sweepingSkipped: fixes.length - traced.length };
}

/**
 * The report from blame results already gathered. Pure; `analyzeFixRate`
 * runs the blames.
 * @param rated - the files to rate: tracked, less fixtures and generated code.
 */
export function computeFixRate(
  commits: RawCommit[],
  origins: FixOrigins,
  rated: Set<string>,
): FixRateReport {
  const { human, traced, sweepingSkipped } = plan(commits);
  const windowMs = FIX_WINDOW_DAYS * DAY_MS;
  const time = new Map(human.map((c) => [c.hash, Date.parse(c.date)]));
  let end = -Infinity;
  for (const c of commits) end = Math.max(end, Date.parse(c.date));

  // `${change}\0${file}` → the fixes that traced back to it in time.
  const fixedBy = new Map<string, RawCommit[]>();
  for (const fix of traced) {
    const fixAt = Date.parse(fix.date);
    for (const o of origins.get(fix.hash) ?? []) {
      const at = time.get(o.hash);
      // Blame names only ancestors, so a change "after" its fix is clock
      // skew, not a mistake: keep it.
      if (at === undefined || o.hash === fix.hash || fixAt - at > windowMs)
        continue;
      const key = `${o.hash}\0${o.file}`;
      const list = fixedBy.get(key) ?? [];
      list.push(fix);
      fixedBy.set(key, list);
    }
  }

  const perFile = new Map<
    string,
    { changes: number; fixedAfter: number; fixes: Map<string, FixRateFix> }
  >();
  const months = new Map<string, FixRateMonth>();
  let changes = 0;
  let fixedAfter = 0;
  for (const c of human) {
    const at = time.get(c.hash)!;
    if (at + windowMs > end) continue;
    const month = c.date.slice(0, 7);
    for (const file of c.files) {
      if (!rated.has(file)) continue;
      const row = perFile.get(file) ?? {
        changes: 0,
        fixedAfter: 0,
        fixes: new Map<string, FixRateFix>(),
      };
      perFile.set(file, row);
      const m = months.get(month) ?? { month, changes: 0, fixedAfter: 0 };
      months.set(month, m);
      row.changes++;
      m.changes++;
      changes++;
      const by = fixedBy.get(`${c.hash}\0${file}`);
      if (!by) continue;
      row.fixedAfter++;
      m.fixedAfter++;
      fixedAfter++;
      for (const fix of by) {
        const entry = row.fixes.get(fix.hash) ?? {
          hash: fix.hash,
          message: fix.message,
          date: fix.date,
          revert: fixKind(fix.message) === 'revert',
          causes: [],
        };
        entry.causes.push(c.hash);
        row.fixes.set(fix.hash, entry);
      }
    }
  }

  const files: FileFixRate[] = [];
  let unratedFiles = 0;
  for (const [file, row] of perFile) {
    if (row.changes < MIN_CHANGES) {
      unratedFiles++;
      continue;
    }
    files.push({
      file,
      changes: row.changes,
      fixedAfter: row.fixedAfter,
      rate: row.fixedAfter / row.changes,
      fixes: [...row.fixes.values()]
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, MAX_FIXES_LISTED),
    });
  }
  files.sort(
    (a, b) =>
      b.rate - a.rate || b.changes - a.changes || a.file.localeCompare(b.file),
  );

  const rate = changes > 0 ? fixedAfter / changes : null;
  return {
    files,
    unratedFiles,
    changes,
    fixedAfter,
    rate,
    byMonth: [...months.values()].sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    fixCommits: traced.length,
    reverts: traced.filter((c) => fixKind(c.message) === 'revert').length,
    sweepingSkipped,
    windowDays: FIX_WINDOW_DAYS,
    minChanges: MIN_CHANGES,
    summary: summarize(rate, changes, fixedAfter, files.length),
  };
}

function summarize(
  rate: number | null,
  changes: number,
  fixedAfter: number,
  ratedFiles: number,
): string {
  if (rate === null)
    return `No change is older than ${FIX_WINDOW_DAYS} days yet, so none can be rated.`;
  const pct = Math.round(rate * 1000) / 10;
  return (
    `${pct}% of changes (${fixedAfter} of ${changes}) had their lines fixed ` +
    `within ${FIX_WINDOW_DAYS} days; ${ratedFiles} ` +
    `${ratedFiles === 1 ? 'file has' : 'files have'} the ${MIN_CHANGES}+ changes a rate needs.`
  );
}

/**
 * Blames every traceable fix (`CONCURRENCY` at a time), then rates. Each
 * blame is a quick lookup with its own limit; one that hits it fails the
 * analyzer (the runner's fallback reports it) rather than rating on a gap.
 * @param rated - the files to rate: tracked, less fixtures and generated code.
 */
export async function analyzeFixRate(
  repoPath: string,
  commits: RawCommit[],
  rated: Set<string>,
): Promise<FixRateReport> {
  const { traced } = plan(commits);
  const jobs = traced.flatMap((fix) =>
    fix.files.filter((f) => rated.has(f)).map((file) => ({ fix, file })),
  );
  const origins: FixOrigins = new Map();
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { fix, file } = jobs[next++];
      const found = await blameFixedLines(repoPath, fix.hash, file);
      if (found.length === 0) continue;
      origins.set(fix.hash, [...(origins.get(fix.hash) ?? []), ...found]);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return computeFixRate(commits, origins, rated);
}
