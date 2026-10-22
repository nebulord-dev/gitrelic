/**
 * Parallel development analyzer — detects temporal concurrency per file.
 *
 * ## How it works
 *
 * Builds an author-week matrix: for each file, which distinct authors
 * committed in each ISO calendar week (Monday-start). Weeks with 2+
 * authors count as "parallel development" — a social signal that
 * correlates with increased defect rates.
 *
 * Reference: Meneely & Williams, "Secure open source collaboration:
 * an empirical study of Linus' law" — found that Linux modules with
 * the most parallel work showed increased security-related bugs.
 *
 * ## Scoring formula
 *
 *   baseScore = (parallelWeeks / totalActiveWeeks) * 100
 *   severityMultiplier = max(1.0, min(avg(authorsPerParallelWeek) / 2, 2.0))
 *   parallelScore = min(baseScore * severityMultiplier, 100)
 *
 * Files with fewer than 3 active weeks are excluded (insufficient history),
 * and so are files with a single collision week: one overlap is chance.
 *
 * ## What counts
 *
 * A commit touching more than `SWEEPING_COMMIT_FILES` files (a mass rename,
 * a codemod, a port) is left out: two of those in one week put hundreds of
 * files in "parallel development" with nobody coordinating anything. On
 * React's last 12 months they made 327 of 426 collisions (a 175-file fix,
 * its revert and its re-land; a 461-file port). Bot commits are left out
 * too, as are files that aren't source (tests, fixtures, generated: the
 * runner's file classes). How many commits were left out is reported.
 *
 * ## Pairs
 *
 * `pairs` counts, for each two people, the weeks they committed to the same
 * file: weeks, not file-weeks, so a flag flipped across eight forks in one
 * week counts once.
 *
 * `pairs` and `byMonth` count every collision, including files with a single
 * one, which `MIN_COLLISION_WEEKS` keeps off the file list. That floor is
 * about files: one overlap on a file is chance. A pair who overlapped once on
 * each of four files met four times, which is the pattern pairs exist to show.
 */

import { classifyAuthor } from '../utils/authorClassification.js';
import { MAX_FIX_FILES } from './fix-rate.js';
import type {
  ParallelDevReport,
  FileParallelDev,
  ParallelWindow,
  ParallelByMonth,
  ParallelPair,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';

/**
 * Commits touching more files than this are sweeping, and left out: Fix
 * rate's rule, shared so the two can't drift apart. It counts every path the
 * commit touched, source or not: a commit is sweeping by its breadth.
 */
export const SWEEPING_COMMIT_FILES = MAX_FIX_FILES;
/** A file needs this many collision weeks to be listed. */
export const MIN_COLLISION_WEEKS = 2;
/** Files a pair lists, most shared first. */
const PAIR_FILES_LISTED = 5;

/** Returns the Monday of the ISO week containing the given date, as an ISO string. */
function getISOWeekMonday(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // offset to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

interface WeekBucket {
  authors: Set<string>;
  commitCount: number;
}

type WeekMatrix = Map<string, Map<string, WeekBucket>>;
// file → weekKey → { authors, commitCount }

function buildWeekMatrix(
  commits: RawCommit[],
  trackedSet: Set<string>,
  nonSource: ReadonlySet<string>,
): WeekMatrix {
  const matrix: WeekMatrix = new Map();

  for (const commit of commits) {
    const weekKey = getISOWeekMonday(commit.date);

    for (const file of commit.files) {
      if (!trackedSet.has(file) || nonSource.has(file)) continue;

      if (!matrix.has(file)) matrix.set(file, new Map());
      const fileWeeks = matrix.get(file)!;

      if (!fileWeeks.has(weekKey)) {
        fileWeeks.set(weekKey, { authors: new Set(), commitCount: 0 });
      }
      const bucket = fileWeeks.get(weekKey)!;
      bucket.authors.add(commit.authorEmail);
      bucket.commitCount++;
    }
  }

  return matrix;
}

const MIN_ACTIVE_WEEKS = 3;

function scoreFile(
  file: string,
  weeks: Map<string, WeekBucket>,
): FileParallelDev | null {
  const totalActiveWeeks = weeks.size;
  if (totalActiveWeeks < MIN_ACTIVE_WEEKS) return null;

  // Find parallel weeks (2+ authors)
  const parallelEntries: Array<{ weekStart: string; bucket: WeekBucket }> = [];
  for (const [weekStart, bucket] of weeks) {
    if (bucket.authors.size >= 2) {
      parallelEntries.push({ weekStart, bucket });
    }
  }

  const parallelWeeks = parallelEntries.length;
  if (parallelWeeks < MIN_COLLISION_WEEKS) return null;

  // Base score: percentage of active weeks that were parallel
  const baseScore = (parallelWeeks / totalActiveWeeks) * 100;

  // Severity: weight by average number of overlapping authors
  const avgAuthors =
    parallelEntries.reduce((sum, e) => sum + e.bucket.authors.size, 0) /
    parallelWeeks;
  const severityMultiplier = Math.max(1.0, Math.min(avgAuthors / 2, 2.0));

  const parallelScore = Math.min(
    Math.round(baseScore * severityMultiplier),
    100,
  );

  // Sort parallel entries by author count desc, then commit count desc
  parallelEntries.sort(
    (a, b) =>
      b.bucket.authors.size - a.bucket.authors.size ||
      b.bucket.commitCount - a.bucket.commitCount,
  );

  const toWindow = (entry: {
    weekStart: string;
    bucket: WeekBucket;
  }): ParallelWindow => ({
    weekStart: entry.weekStart,
    authors: [...entry.bucket.authors],
    commitCount: entry.bucket.commitCount,
  });

  const peakWindow = toWindow(parallelEntries[0]);
  const topWindows = parallelEntries.slice(0, 3).map(toWindow);
  const windows = [...parallelEntries]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map(toWindow);
  const peakAuthors = peakWindow.authors.length;

  const narrative = buildNarrative(
    file,
    parallelScore,
    parallelWeeks,
    totalActiveWeeks,
    peakWindow,
  );

  return {
    file,
    parallelScore,
    totalActiveWeeks,
    parallelWeeks,
    peakAuthors,
    peakWindow,
    topWindows,
    windows,
    narrative,
  };
}

function buildNarrative(
  file: string,
  score: number,
  parallelWeeks: number,
  totalActiveWeeks: number,
  peakWindow: ParallelWindow,
): string {
  const peakNames = peakWindow.authors.join(', ');
  const weekOf = peakWindow.weekStart.slice(0, 10); // YYYY-MM-DD

  if (score >= 70) {
    return `${file} had parallel development in ${parallelWeeks} of ${totalActiveWeeks} active weeks. Peak: ${peakNames} all committed the week of ${weekOf}. This level of concurrent work correlates with increased defect risk.`;
  }
  if (score >= 40) {
    return `${file} saw 2+ authors in the same week ${parallelWeeks} times. Worth monitoring for coordination issues.`;
  }
  return `${file} had occasional parallel work — minor coordination overhead.`;
}

interface MonthAccumulator {
  parallelEvents: number;
  files: Set<string>;
  totalAuthors: number;
}

/**
 * People who committed to the same file in the same week, by pair: the
 * distinct weeks they shared and the files they shared most.
 */
function collisionPairs(matrix: WeekMatrix): ParallelPair[] {
  const pairs = new Map<
    string,
    { a: string; b: string; weeks: Set<string>; files: Map<string, number> }
  >();
  for (const [file, weeks] of matrix) {
    for (const [weekKey, bucket] of weeks) {
      if (bucket.authors.size < 2) continue;
      const people = [...bucket.authors].sort();
      for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
          const key = `${people[i]}\u0000${people[j]}`;
          let pair = pairs.get(key);
          if (!pair) {
            pair = {
              a: people[i],
              b: people[j],
              weeks: new Set(),
              files: new Map(),
            };
            pairs.set(key, pair);
          }
          pair.weeks.add(weekKey);
          pair.files.set(file, (pair.files.get(file) ?? 0) + 1);
        }
      }
    }
  }
  return [...pairs.values()]
    .map((p) => ({
      a: p.a,
      b: p.b,
      weeks: p.weeks.size,
      files: [...p.files]
        .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
        .slice(0, PAIR_FILES_LISTED)
        .map(([f]) => f),
    }))
    .sort(
      (x, y) =>
        y.weeks - x.weeks || x.a.localeCompare(y.a) || x.b.localeCompare(y.b),
    );
}

export function analyzeParallelDev(
  commits: RawCommit[],
  trackedFiles: string[],
  // Files that aren't source (tests, fixtures, generated: the runner's file
  // classes) are left out: two people updating snapshots isn't coordination.
  nonSource: ReadonlySet<string> = new Set(),
): ParallelDevReport {
  const trackedSet = new Set(trackedFiles);
  let botCommits = 0;
  let sweepingCommits = 0;
  const counted = commits.filter((c) => {
    if (classifyAuthor(c.authorEmail) === 'bot') {
      botCommits++;
      return false;
    }
    if (c.files.length > SWEEPING_COMMIT_FILES) {
      sweepingCommits++;
      return false;
    }
    return true;
  });
  const matrix = buildWeekMatrix(counted, trackedSet, nonSource);

  const files: FileParallelDev[] = [];

  for (const [file, weeks] of matrix) {
    const scored = scoreFile(file, weeks);
    if (scored) files.push(scored);
  }

  files.sort((a, b) => b.parallelScore - a.parallelScore);
  const hotFiles = files.slice(0, 10);
  const totalParallelFiles = files.length;

  // ── highParallel ────────────────────────────────────────────────────────
  const highParallel = files.filter((f) => f.parallelScore >= 70).length;

  // ── tierMix ─────────────────────────────────────────────────────────────
  // 0-24 = low, 25-49 = medium, 50-74 = high, 75-100 = critical
  const tierMix = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of files) {
    if (f.parallelScore >= 75) tierMix.critical++;
    else if (f.parallelScore >= 50) tierMix.high++;
    else if (f.parallelScore >= 25) tierMix.medium++;
    else tierMix.low++;
  }

  // ── byMonth ─────────────────────────────────────────────────────────────
  // Derive from the week matrix: for each (file, week) parallel event,
  // bucket by the calendar month of weekStart (YYYY-MM).
  // Only count weeks that actually had parallel activity (2+ authors).
  const monthMap = new Map<string, MonthAccumulator>();

  for (const [file, weeks] of matrix) {
    for (const [weekKey, bucket] of weeks) {
      if (bucket.authors.size < 2) continue;
      // weekKey is a full ISO date string; extract YYYY-MM
      const month = weekKey.slice(0, 7);
      if (!monthMap.has(month)) {
        monthMap.set(month, {
          parallelEvents: 0,
          files: new Set(),
          totalAuthors: 0,
        });
      }
      const acc = monthMap.get(month)!;
      acc.parallelEvents++;
      acc.files.add(file);
      acc.totalAuthors += bucket.authors.size;
    }
  }

  const byMonth: ParallelByMonth[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, acc]) => ({
      month,
      parallelEvents: acc.parallelEvents,
      uniqueFiles: acc.files.size,
      avgAuthors: Math.round((acc.totalAuthors / acc.parallelEvents) * 10) / 10,
    }));

  const summary =
    hotFiles.length === 0
      ? 'No significant parallel development detected.'
      : `${totalParallelFiles} file${totalParallelFiles === 1 ? '' : 's'} show${totalParallelFiles === 1 ? 's' : ''} signs of parallel development. ${hotFiles[0].file} is the most contested.`;

  return {
    files,
    hotFiles,
    totalParallelFiles,
    highParallel,
    tierMix,
    byMonth,
    pairs: collisionPairs(matrix),
    leftOut: { sweepingCommits, botCommits },
    summary,
  };
}
