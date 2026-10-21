// Fuzzy ranking for the ⌘K palette. A query matches when its characters
// appear in order in the text (subsequence); the score rewards runs of
// consecutive characters and matches at word starts ("bf" → "Bus Factor",
// "rnr" → "runner.ts"), and slightly prefers shorter texts.

import type { EntityEntry, SearchKind } from '../entities';

const BOUNDARY = /[/._\-\s@:]/;

/**
 * Score of `query` against `text`, or null when it isn't a subsequence.
 * Greedy: each query character takes its first occurrence, so a better
 * match later in the text (a word start, a longer run) isn't searched for.
 * Cheap and good enough for names and paths; a DP over all alignments is
 * the upgrade if ranking ever needs it.
 */
export function fuzzyScore(query: string, text: string): number | null {
  // Both sides go code point by code point, each lowercased to its first
  // code point: 'İ' lowercases to 'i̇' (a combining dot follows that could
  // never match), and an emoji is two UTF-16 units that must match whole.
  const q = [...query].map(fold);
  if (q.length === 0) return 0;
  return scorePrepared(q, prepare(text));
}

/** A text split into code points and folded once, for scoring many queries. */
interface Prepared {
  chars: string[];
  folded: string[];
}

function prepare(text: string): Prepared {
  const chars = [...text];
  return { chars, folded: chars.map(fold) };
}

function scorePrepared(
  q: string[],
  { chars, folded }: Prepared,
): number | null {
  let score = 0;
  let run = 0;
  let qi = 0;
  let last = -1;
  for (let ti = 0; ti < chars.length && qi < q.length; ti++) {
    const ch = chars[ti];
    const lower = folded[ti];
    if (lower !== q[qi]) continue;
    const prev = chars[ti - 1];
    const atStart =
      ti === 0 ||
      BOUNDARY.test(prev) ||
      (ch !== lower && prev === prev.toLowerCase());
    run = ti === last + 1 ? run + 1 : 1;
    score += 1 + (atStart ? 4 : 0) + (run > 1 ? 3 * (run - 1) : 0);
    if (last >= 0) score -= Math.min(3, (ti - last - 1) * 0.1);
    last = ti;
    qi++;
  }
  if (qi < q.length) return null;
  return score - chars.length * 0.01;
}

/** One code point, lowercased, cut back to a single code point. */
function fold(ch: string): string {
  return String.fromCodePoint(ch.toLowerCase().codePointAt(0) ?? 0);
}

// Each entry's label and keywords, split and folded on first search and
// reused for every keystroke after: on a big repo that's tens of thousands
// of paths, which shouldn't be re-split per key.
const PREPARED = new WeakMap<EntityEntry, Prepared[]>();

function prepared(entry: EntityEntry): Prepared[] {
  let p = PREPARED.get(entry);
  if (!p) {
    p = [entry.label, ...entry.keywords].map(prepare);
    PREPARED.set(entry, p);
  }
  return p;
}

const KIND_ORDER: Record<SearchKind, number> = {
  view: 0,
  analyzer: 1,
  person: 2,
  dir: 3,
  file: 4,
};

export interface Ranked {
  entry: EntityEntry;
  score: number;
}

/**
 * The best `limit` entries for `query`. Labels count fully; keywords (full
 * paths, emails, aliases) at a small discount. Ties go to views, then
 * analyzers, people, directories, files; then the shorter label.
 */
export function rankEntities(
  query: string,
  entries: readonly EntityEntry[],
  limit = 20,
): Ranked[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const q = [...trimmed].map(fold);
  const out: Ranked[] = [];
  for (const entry of entries) {
    const [label, ...keywords] = prepared(entry);
    let best = scorePrepared(q, label);
    for (const k of keywords) {
      const s = scorePrepared(q, k);
      if (s !== null && (best === null || s - 1 > best)) best = s - 1;
    }
    if (best !== null) out.push({ entry, score: best });
  }
  out.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] ||
      a.entry.label.length - b.entry.label.length ||
      (a.entry.label < b.entry.label ? -1 : 1),
  );
  return out.slice(0, limit);
}
