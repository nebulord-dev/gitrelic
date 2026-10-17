import { startOfUtcWeek, WEEK_MS } from '../time/week';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

export interface SwimCommit {
  date: Date;
  files: readonly string[];
  isHotspot: boolean;
}

export interface SwimLane {
  email: string;
  name: string;
  commitCount: number;
  commits: SwimCommit[];
  weeklyIntensity: number[];
  isGhost: boolean;
  lastActiveDate: Date | null;
}

export function prepareSwimlaneData(
  report: Pick<GitrelicReport, 'hotspots' | 'ghostFiles' | 'contributors'>,
  commits: readonly CommitLike[],
): SwimLane[] {
  if (commits.length === 0) return [];

  const hotspotFiles = new Set(
    report.hotspots.files
      .filter((h) => h.category === 'critical' || h.category === 'warning')
      .map((h) => h.file),
  );
  const ghostAuthors = new Set(
    report.ghostFiles.files.map((g) => g.dominantAuthor),
  );

  // Group commits by author
  const byAuthor = new Map<string, SwimCommit[]>();
  let minMs = commits[0].timeMs;
  let maxMs = minMs;
  for (const c of commits) {
    if (c.timeMs < minMs) minMs = c.timeMs;
    if (c.timeMs > maxMs) maxMs = c.timeMs;
    const entry: SwimCommit = {
      date: new Date(c.timeMs),
      files: c.files,
      isHotspot: c.files.some((f) => hotspotFiles.has(f)),
    };
    const arr = byAuthor.get(c.author) ?? [];
    arr.push(entry);
    byAuthor.set(c.author, arr);
  }

  // Weekly binning
  const startMonday = startOfUtcWeek(minMs);
  const totalWeeks = Math.ceil((maxMs - startMonday) / WEEK_MS) + 1;

  // Build lanes from contributor report (sorted by commit count)
  const sorted = [...report.contributors.contributors].sort(
    (a, b) => b.commitCount - a.commitCount,
  );

  return sorted.map((contrib) => {
    const authorCommits = byAuthor.get(contrib.email) ?? [];
    const weekly = new Array<number>(totalWeeks).fill(0);
    let lastMs = -Infinity;
    for (const c of authorCommits) {
      const t = c.date.getTime();
      const idx = Math.floor((t - startMonday) / WEEK_MS);
      if (idx >= 0 && idx < totalWeeks) weekly[idx]++;
      if (t > lastMs) lastMs = t;
    }

    return {
      email: contrib.email,
      name: contrib.name,
      commitCount: contrib.commitCount,
      commits: authorCommits.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      ),
      weeklyIntensity: weekly,
      isGhost: ghostAuthors.has(contrib.email) || contrib.isGhost,
      lastActiveDate: authorCommits.length > 0 ? new Date(lastMs) : null,
    };
  });
}
