import type { ContributorReport, Contributor } from '../types.js';
import type { RawCommit } from '../utils/git.js';

/**
 * Analyzes the contributors of the repository based on the provided commits and repository age in days.
 * @param commits - The raw commits from the repository.
 * @param repoAgeDays - The age of the repository in days.
 * @Returns a report with the top 20 contributors by commit count, the number of active contributors, and a summary.
 */
export function analyzeContributors(commits: RawCommit[], repoAgeDays: number): ContributorReport {
  const authorMap: Map<
    string,
    {
      name: string;
      commits: RawCommit[];
      files: Set<string>;
      dirs: Record<string, number>;
    }
  > = new Map();

  for (const commit of commits) {
    const email = commit.authorEmail;
    if (!authorMap.has(email)) {
      authorMap.set(email, { name: commit.authorName, commits: [], files: new Set(), dirs: {} });
    }
    const entry = authorMap.get(email)!;
    entry.commits.push(commit);
    for (const file of commit.files) {
      entry.files.add(file);
      const dir = file.includes('/') ? file.split('/').slice(0, 2).join('/') : '.';
      entry.dirs[dir] = (entry.dirs[dir] ?? 0) + 1;
    }
  }

  const now = Date.now();
  const MIN_ACTIVE_DAYS = 90;
  const MIN_GHOST_DAYS = 180;
  const activeWindowDays = Math.max(MIN_ACTIVE_DAYS, Math.round(repoAgeDays * 0.25));
  const ghostWindowDays = Math.max(MIN_GHOST_DAYS, Math.round(repoAgeDays * 0.5));
  const activeCutoff = now - activeWindowDays * 86_400_000;
  const ghostCutoff = now - ghostWindowDays * 86_400_000;

  const contributors: Contributor[] = Array.from(authorMap.entries())
    .map(([email, data]) => {
      const sorted = [...data.commits].sort((a, b) => a.date.localeCompare(b.date));
      const firstCommit = sorted[0].date;
      const lastCommit = sorted[sorted.length - 1].date;
      const activeDays = new Set(data.commits.map((c) => c.date.slice(0, 10))).size;
      const linesChanged = data.commits.reduce((sum, c) => sum + c.insertions + c.deletions, 0);
      const focusAreas = Object.entries(data.dirs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([dir]) => dir);

      return {
        email,
        name: data.name,
        commitCount: data.commits.length,
        firstCommit,
        lastCommit,
        filesOwned: 0, // filled in by runner after bus factor analysis
        linesChanged,
        activeDays,
        focusAreas,
        isActive: new Date(lastCommit).getTime() > activeCutoff,
      };
    })
    .sort((a, b) => b.commitCount - a.commitCount);

  const activeContributors = contributors.filter((c) => c.isActive);
  const ghostContributors = contributors.filter(
    (c) => !c.isActive && new Date(c.lastCommit).getTime() < ghostCutoff,
  );

  // Guard against an empty commit list when called as a library — the runner
  // rejects zero-commit repos earlier, but analyzeContributors is exported
  // and shouldn't return an invalid `topContributor: undefined` shape.
  const topContributor: Contributor = contributors[0] ?? {
    email: '',
    name: '',
    commitCount: 0,
    firstCommit: '',
    lastCommit: '',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 0,
    focusAreas: [],
    isActive: false,
  };

  const summary =
    contributors.length === 0
      ? 'No contributors found'
      : ghostContributors.length > 0
        ? `${contributors.length} contributors total — ${activeContributors.length} active, ${ghostContributors.length} ghosts who haven't committed in ${ghostWindowDays}+ days`
        : `${contributors.length} contributors — ${activeContributors.length} actively committing`;

  return { contributors, activeContributors, ghostContributors, topContributor, summary };
}
