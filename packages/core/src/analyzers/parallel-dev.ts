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
 * Files with fewer than 3 active weeks are excluded (insufficient history).
 */

import type { RawCommit } from '../utils/git.js';
import type { ParallelDevReport, FileParallelDev, ParallelWindow } from '../types.js';

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

function buildWeekMatrix(commits: RawCommit[], trackedSet: Set<string>): WeekMatrix {
  const matrix: WeekMatrix = new Map();

  for (const commit of commits) {
    const weekKey = getISOWeekMonday(commit.date);

    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;

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
const MIN_PARALLEL_SCORE = 20;

function scoreFile(
  file: string,
  weeks: Map<string, WeekBucket>
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
  if (parallelWeeks === 0) return null;

  // Base score: percentage of active weeks that were parallel
  const baseScore = (parallelWeeks / totalActiveWeeks) * 100;

  // Severity: weight by average number of overlapping authors
  const avgAuthors = parallelEntries.reduce((sum, e) => sum + e.bucket.authors.size, 0) / parallelWeeks;
  const severityMultiplier = Math.max(1.0, Math.min(avgAuthors / 2, 2.0));

  const parallelScore = Math.min(Math.round(baseScore * severityMultiplier), 100);

  if (parallelScore < MIN_PARALLEL_SCORE) return null;

  // Sort parallel entries by author count desc, then commit count desc
  parallelEntries.sort((a, b) =>
    b.bucket.authors.size - a.bucket.authors.size || b.bucket.commitCount - a.bucket.commitCount
  );

  const toWindow = (entry: { weekStart: string; bucket: WeekBucket }): ParallelWindow => ({
    weekStart: entry.weekStart,
    authors: [...entry.bucket.authors],
    commitCount: entry.bucket.commitCount,
  });

  const peakWindow = toWindow(parallelEntries[0]);
  const topWindows = parallelEntries.slice(0, 3).map(toWindow);
  const peakAuthors = peakWindow.authors.length;

  const narrative = buildNarrative(file, parallelScore, parallelWeeks, totalActiveWeeks, peakWindow);

  return {
    file,
    parallelScore,
    totalActiveWeeks,
    parallelWeeks,
    peakAuthors,
    peakWindow,
    topWindows,
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

export function analyzeParallelDev(
  commits: RawCommit[],
  trackedFiles: string[],
): ParallelDevReport {
  const trackedSet = new Set(trackedFiles);
  const matrix = buildWeekMatrix(commits, trackedSet);

  const files: FileParallelDev[] = [];

  for (const [file, weeks] of matrix) {
    const scored = scoreFile(file, weeks);
    if (scored) files.push(scored);
  }

  files.sort((a, b) => b.parallelScore - a.parallelScore);
  const hotFiles = files.slice(0, 10);
  const totalParallelFiles = files.length;

  const summary = hotFiles.length === 0
    ? 'No significant parallel development detected.'
    : `${totalParallelFiles} file${totalParallelFiles === 1 ? '' : 's'} show${totalParallelFiles === 1 ? 's' : ''} signs of parallel development. ${hotFiles[0].file} is the most contested.`;

  return { files, hotFiles, totalParallelFiles, summary };
}
