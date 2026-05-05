import type { PerAuthorMixEntry } from '@gitrelic/core';

const TOP_BY_TOTAL = 20;
const HARD_CAP = 30;

/**
 * Selection rule: top-20 humans by totalCommits ∪ all humans with personalRatio > 0,
 * hard-capped at 30. Preserves the input's personalRatio-desc sort order.
 *
 * The union ensures AI users always appear in the chart even when they're not in
 * the most-active 20 — without a low-volume AI experimenter being silently dropped
 * on a large repo.
 */
export function perAuthorAiMix(
  entries: PerAuthorMixEntry[],
): PerAuthorMixEntry[] {
  if (entries.length === 0) return [];

  // Top-N by totalCommits.
  const byTotalDesc = [...entries].sort(
    (a, b) => b.totalCommits - a.totalCommits,
  );
  const topByTotal = byTotalDesc.slice(0, TOP_BY_TOTAL);

  // All AI users.
  const aiUsers = entries.filter((e) => e.personalRatio > 0);

  // Union (dedup by author email).
  const seen = new Set<string>();
  const merged: PerAuthorMixEntry[] = [];
  for (const e of [...topByTotal, ...aiUsers]) {
    if (seen.has(e.author)) continue;
    seen.add(e.author);
    merged.push(e);
  }

  // Re-sort by personalRatio desc (matches analyzer ordering); enforce cap.
  return merged
    .sort((a, b) => {
      if (b.personalRatio !== a.personalRatio)
        return b.personalRatio - a.personalRatio;
      if (b.totalCommits !== a.totalCommits)
        return b.totalCommits - a.totalCommits;
      return a.author.localeCompare(b.author);
    })
    .slice(0, HARD_CAP);
}
