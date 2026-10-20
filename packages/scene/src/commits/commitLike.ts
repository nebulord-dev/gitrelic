import type { CommitIndex, RawCommit } from '@gitrelic/core';

/**
 * The slice of a commit that history views need. The classic dashboard loads
 * full `RawCommit[]`; Atlas loads the columnar `CommitIndex`. Both adapt to
 * this shape so each derivation is written once. Both adapters return commits
 * oldest first, so derivations that break ties by first appearance agree.
 */
export interface CommitLike {
  /** Commit instant, epoch milliseconds. */
  timeMs: number;
  /** Canonical author email. */
  author: string;
  files: readonly string[];
  /** 12-character abbreviated hash (the index's length), to match a commit by. */
  hash?: string;
}

export function fromRawCommits(commits: readonly RawCommit[]): CommitLike[] {
  // `report.commits` is git-log order (newest first). Sort the way
  // buildCommitIndex does — by instant, then hash — so same-second commits
  // (rebases, cherry-picks, imports) land in the same order as the index.
  return commits
    .map((c) => ({ c, timeMs: Date.parse(c.date) }))
    .sort((a, b) => a.timeMs - b.timeMs || a.c.hash.localeCompare(b.c.hash))
    .map(({ c, timeMs }) => ({
      timeMs,
      author: c.authorEmail,
      files: c.files,
      hash: c.hash.slice(0, 12),
    }));
}

export function fromCommitIndex(index: CommitIndex): CommitLike[] {
  if (index.version !== 1) {
    throw new Error(`Unsupported commit index version ${index.version}`);
  }
  return index.time.map((seconds, i) => ({
    timeMs: seconds * 1000,
    author: index.authors[index.author[i]],
    files: index.fileIds
      .slice(index.fileOffsets[i], index.fileOffsets[i + 1])
      .map((id) => index.files[id]),
    hash: index.hash[i],
  }));
}
