/**
 * Commit message forensics — shame scoring per file.
 *
 * ## How shame scoring works
 *
 * Each commit message is scanned for keywords in three tiers:
 *
 * | Weight | Keywords                                                    |
 * |--------|-------------------------------------------------------------|
 * | 3 — Critical | revert, hotfix, oops, fixup, broke                  |
 * | 2 — Moderate | hack, workaround, temporary, temp, kludge, band-aid |
 * | 1 — Mild     | fix, bug, wrong, mistake, typo, cleanup             |
 *
 * Matching is case-insensitive and whole-word only ("fixing" ≠ "fix").
 *
 * ## Shame score formula
 *
 *   rawScore   = (rawShamePoints / totalCommitsForFile) * 100
 *   confidence = min(1, totalCommitsForFile / CONFIDENCE_FLOOR)
 *   shameScore = min(round(rawScore * confidence), 100)
 *
 * Ratio-based: a file with 1 revert in 2 commits has a higher raw ratio than
 * 1 revert in 100 commits, because the percentage of "bad" commits is higher.
 *
 * The confidence multiplier dampens scores for files with very few commits.
 * Without it, a one-commit YAML whose only message says "fix" would tie at 100
 * with a long-suffering file that has a sustained pattern of shame. After the
 * multiplier, that one-commit file scores 20; only files with at least
 * `CONFIDENCE_FLOOR` commits can reach the full ratio. The floor also gates
 * the leaderboard — `shameLeaderboard` only contains files that meet it.
 */

import type { FileForensics, ForensicsReport, ShamefulCommit } from '../types.js';
import type { RawCommit } from '../utils/git.js';

/**
 * Below this many commits, a file's shame score is dampened proportionally.
 * Prevents single-commit files (e.g. a YAML whose only commit message says "fix")
 * from tying at 100 with files that have a sustained pattern of shame.
 */
export const CONFIDENCE_FLOOR = 5;

const SHAME_KEYWORDS: Array<{ weight: number; entries: Array<{ word: string; re: RegExp }> }> = [
  {
    weight: 3,
    entries: ['revert', 'hotfix', 'oops', 'fixup', 'broke'].map((word) => ({
      word,
      re: new RegExp(`\\b${word}\\b`),
    })),
  },
  {
    weight: 2,
    entries: ['hack', 'workaround', 'temporary', 'temp', 'kludge', 'band-aid'].map((word) => ({
      word,
      re: new RegExp(`\\b${word}\\b`),
    })),
  },
  {
    weight: 1,
    entries: ['fix', 'bug', 'wrong', 'mistake', 'typo', 'cleanup'].map((word) => ({
      word,
      re: new RegExp(`\\b${word}\\b`),
    })),
  },
];

type ShameTier = 'critical' | 'moderate' | 'mild';
const TIER_BY_WEIGHT: Record<number, ShameTier> = { 3: 'critical', 2: 'moderate', 1: 'mild' };

function tierForCommit(message: string): ShameTier | null {
  const lower = message.toLowerCase();
  for (const { weight, entries } of SHAME_KEYWORDS) {
    if (entries.some(({ re }) => re.test(lower))) return TIER_BY_WEIGHT[weight];
  }
  return null;
}

function scoreMessage(message: string): { points: number; keywords: string[] } {
  const lower = message.toLowerCase();
  let points = 0;
  const keywords: string[] = [];

  for (const { weight, entries } of SHAME_KEYWORDS) {
    for (const { word, re } of entries) {
      if (re.test(lower)) {
        points += weight;
        keywords.push(word);
      }
    }
  }

  return { points, keywords };
}

export function analyzeForensics(commits: RawCommit[], trackedFiles: string[]): ForensicsReport {
  const trackedSet = new Set(trackedFiles);

  // Map file → all commits that touched it
  const fileCommits = new Map<string, RawCommit[]>(trackedFiles.map((f) => [f, []]));

  for (const commit of commits) {
    for (const file of commit.files) {
      if (trackedSet.has(file)) {
        fileCommits.get(file)!.push(commit);
      }
    }
  }

  const files: FileForensics[] = [];
  const allShameHashes = new Set<string>();

  for (const [file, fileCommitList] of fileCommits) {
    if (fileCommitList.length === 0) continue;

    let rawShamePoints = 0;
    let shameCommitCount = 0;
    const shamefulCommits: ShamefulCommit[] = [];
    const keywordFreq = new Map<string, number>();

    for (const commit of fileCommitList) {
      const { points, keywords } = scoreMessage(commit.message);
      if (points === 0) continue;

      shameCommitCount++;
      rawShamePoints += points;
      allShameHashes.add(commit.hash);
      shamefulCommits.push({
        hash: commit.hash,
        message: commit.message,
        date: commit.date,
        shamePoints: points,
        keywords,
      });

      for (const kw of keywords) {
        keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
      }
    }

    if (rawShamePoints === 0) continue;

    const rawScore = (rawShamePoints / fileCommitList.length) * 100;
    const confidence = Math.min(1, fileCommitList.length / CONFIDENCE_FLOOR);
    const shameScore = Math.min(Math.round(rawScore * confidence), 100);

    const topShameCommits = [...shamefulCommits]
      .sort((a, b) => b.shamePoints - a.shamePoints)
      .slice(0, 3);

    const dominantKeywords = [...keywordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kw]) => kw);

    files.push({
      file,
      shameScore,
      rawShamePoints,
      shameCommitCount,
      topShameCommits,
      dominantKeywords,
    });
  }

  files.sort((a, b) => b.shameScore - a.shameScore);
  const shameLeaderboard = files
    .filter((f) => fileCommits.get(f.file)!.length >= CONFIDENCE_FLOOR)
    .slice(0, 10);

  const keywordTiers = { critical: 0, moderate: 0, mild: 0 };
  const seenHashes = new Set<string>();
  for (const commit of commits) {
    if (seenHashes.has(commit.hash) || !allShameHashes.has(commit.hash)) continue;
    seenHashes.add(commit.hash);
    const tier = tierForCommit(commit.message);
    if (tier !== null) keywordTiers[tier]++;
  }

  const summary =
    shameLeaderboard.length === 0
      ? 'No commit message red flags detected.'
      : `${shameLeaderboard[0].file} has the highest shame score (${shameLeaderboard[0].shameScore}/100) with ${shameLeaderboard[0].shameCommitCount} flagged commits.`;

  return { files, shameLeaderboard, totalShameCommits: allShameHashes.size, keywordTiers, summary };
}
