import type { CommitIndex, RawCommit } from '@gitrelic/core';

/**
 * The slice of a commit that history views need. The classic dashboard loads
 * full `RawCommit[]`; Atlas loads the columnar `CommitIndex`. Both adapt to
 * this shape so each derivation is written once.
 */
export interface CommitLike {
  /** Commit instant, epoch milliseconds. */
  timeMs: number;
  /** Canonical author email. */
  author: string;
  files: readonly string[];
}

export function fromRawCommits(commits: readonly RawCommit[]): CommitLike[] {
  return commits.map((c) => ({
    timeMs: Date.parse(c.date),
    author: c.authorEmail,
    files: c.files,
  }));
}

export function fromCommitIndex(index: CommitIndex): CommitLike[] {
  return index.time.map((seconds, i) => ({
    timeMs: seconds * 1000,
    author: index.authors[index.author[i]],
    files: index.fileIds
      .slice(index.fileOffsets[i], index.fileOffsets[i + 1])
      .map((id) => index.files[id]),
  }));
}
