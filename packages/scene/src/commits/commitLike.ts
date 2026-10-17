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
}

export function fromRawCommits(commits: readonly RawCommit[]): CommitLike[] {
  // `report.commits` is git-log order (newest first); the index is ascending.
  return commits
    .map((c) => ({
      timeMs: Date.parse(c.date),
      author: c.authorEmail,
      files: c.files,
    }))
    .sort((a, b) => a.timeMs - b.timeMs);
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
  }));
}
