import { isAiEmail } from '../authors/authorClassification';
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
  /**
   * The author's UTC offset at commit time, minutes (local = timeMs + tz·60
   * s): what local-time views (Commit Timing's punch card) need.
   */
  tz?: number;
  /**
   * AI in the commit: 0 none, 1 AI-assisted (an AI co-author), 2 authored
   * by an AI agent (core's `CommitIndex.ai`). Missing reads as 0.
   */
  ai?: 0 | 1 | 2;
}

/** Whether a commit had AI in it, assisted or authored. */
export const withAi = (c: Pick<CommitLike, 'ai'>) => (c.ai ?? 0) > 0;

/** `+05:30` → 330, `-08:00` → -480; `Z` or none → 0 (core's rule). */
export function utcOffsetMinutes(iso: string): number {
  const m = iso.match(/([+-])(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -minutes : minutes;
}

/** A commit's local day (0 = Sunday) and hour, in its author's time zone. */
export function localDayHour(c: Pick<CommitLike, 'timeMs' | 'tz'>): {
  day: number;
  hour: number;
} {
  const d = new Date(c.timeMs + (c.tz ?? 0) * 60_000);
  return { day: d.getUTCDay(), hour: d.getUTCHours() };
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
      tz: utcOffsetMinutes(c.date),
      ai: isAiEmail(c.authorEmail)
        ? 2
        : c.coAuthors.some((co) => isAiEmail(co.email))
          ? 1
          : 0,
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
    tz: index.tz[i],
    // Indexes from before RELIC-372 have no AI column.
    ai: (index.ai?.[i] ?? 0) as 0 | 1 | 2,
  }));
}
