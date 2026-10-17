import type { CommitIndex } from '../types.js';
import type { RawCommit } from './git.js';

// ─── Commit index ──────────────────────────────────────────────────────────────
//
// `RawCommit[]` costs ~1 KB per commit as JSON — every path is spelled out
// twice (files + fileStats) on every commit. The dashboard only needs who,
// when (in the author's own time zone, for the clock view), which files and
// how much changed, so this stores each field as a column and each author and
// path once.

const HASH_LENGTH = 12;
const OFFSET_RE = /([+-])(\d{2}):?(\d{2})$/;

/** UTC offset of an ISO-8601 timestamp, in minutes (`Z` → 0). */
export function parseUtcOffsetMinutes(iso: string): number {
  const m = iso.match(OFFSET_RE);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -minutes : minutes;
}

export function buildCommitIndex(commits: RawCommit[]): CommitIndex {
  const sorted = commits
    .map((c) => ({ c, t: Date.parse(c.date) }))
    // Hash breaks ties so the output doesn't depend on input order.
    .sort((a, b) => a.t - b.t || a.c.hash.localeCompare(b.c.hash));

  const ix: CommitIndex = {
    version: 1,
    authors: [],
    authorNames: [],
    files: [],
    time: [],
    tz: [],
    author: [],
    fileOffsets: [0],
    fileIds: [],
    insertions: [],
    deletions: [],
    hash: [],
  };
  const authorIds = new Map<string, number>();
  const fileIds = new Map<string, number>();

  for (const { c, t } of sorted) {
    let a = authorIds.get(c.authorEmail);
    if (a === undefined) {
      a = ix.authors.length;
      authorIds.set(c.authorEmail, a);
      ix.authors.push(c.authorEmail);
      ix.authorNames.push(c.authorName);
    }
    for (const file of c.files) {
      let f = fileIds.get(file);
      if (f === undefined) {
        f = ix.files.length;
        fileIds.set(file, f);
        ix.files.push(file);
      }
      ix.fileIds.push(f);
    }
    ix.fileOffsets.push(ix.fileIds.length);
    ix.time.push(Math.floor(t / 1000));
    ix.tz.push(parseUtcOffsetMinutes(c.date));
    ix.author.push(a);
    ix.insertions.push(c.insertions);
    ix.deletions.push(c.deletions);
    ix.hash.push(c.hash.slice(0, HASH_LENGTH));
  }
  return ix;
}
