import type { RawCommit } from '../utils/git.js';
import type { ContributorReport, Contributor } from '../types.js';

export function analyzeContributors(commits: RawCommit[], repoAgeDays: number): ContributorReport {
  const authorMap: Map<string, {
    name: string;
    commits: RawCommit[];
    files: Set<string>;
    dirs: Record<string, number>;
  }> = new Map();

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
  const activeWindow = Math.round(repoAgeDays * 0.25) * 86_400_000;
  const ghostWindow = Math.round(repoAgeDays * 0.50) * 86_400_000;
  const activeCutoff = now - activeWindow;
  const ghostCutoff = now - ghostWindow;

  const contributors: Contributor[] = Array.from(authorMap.entries()).map(([email, data]) => {
    const sorted = [...data.commits].sort((a, b) => a.date.localeCompare(b.date));
    const firstCommit = sorted[0].date;
    const lastCommit = sorted[sorted.length - 1].date;
    const activeDays = new Set(data.commits.map(c => c.date.slice(0, 10))).size;
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
      filesOwned: 0,  // filled in by runner after bus factor analysis
      linesChanged,
      activeDays,
      focusAreas,
      isActive: new Date(lastCommit).getTime() > activeCutoff,
    };
  }).sort((a, b) => b.commitCount - a.commitCount);

  const activeContributors = contributors.filter(c => c.isActive);
  const ghostContributors = contributors.filter(
    c => !c.isActive && new Date(c.lastCommit).getTime() < ghostCutoff
  );
  const topContributor = contributors[0];

  const summary = ghostContributors.length > 0
    ? `${contributors.length} contributors total — ${activeContributors.length} active, ${ghostContributors.length} ghosts who haven't committed in ${Math.round(repoAgeDays * 0.50)}+ days`
    : `${contributors.length} contributors — ${activeContributors.length} actively committing`;

  return { contributors, activeContributors, ghostContributors, topContributor, summary };
}
