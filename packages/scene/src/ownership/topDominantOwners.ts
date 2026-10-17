import type { FileBusFactor } from '@gitrelic/core';

export interface DominantOwnerRow {
  author: string;
  count: number;
  share: number;
}

/**
 * Groups a set of files by their `dominantAuthor`, returning each owner's
 * file count and share of the input. Sorted by count desc, ties broken
 * alphabetically. Share is computed against the input length, not against
 * the repo total — so callers should pass the slice they want the share
 * to be relative to (typically `criticalFiles`).
 */
export function topDominantOwners(
  files: ReadonlyArray<FileBusFactor>,
): DominantOwnerRow[] {
  if (files.length === 0) return [];

  const counts = new Map<string, number>();
  for (const f of files) {
    counts.set(f.dominantAuthor, (counts.get(f.dominantAuthor) ?? 0) + 1);
  }

  const total = files.length;
  const rows: DominantOwnerRow[] = [];
  for (const [author, count] of counts) {
    rows.push({ author, count, share: count / total });
  }

  rows.sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
  return rows;
}
