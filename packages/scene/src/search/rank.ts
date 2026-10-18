// Fuzzy ranking for the ⌘K palette. A query matches when its characters
// appear in order in the text (subsequence); the score rewards runs of
// consecutive characters and matches at word starts ("bf" → "Bus Factor",
// "rnr" → "runner.ts"), and slightly prefers shorter texts.

import type { EntityEntry, SearchKind } from '../entities';

const BOUNDARY = /[/._\-\s@:]/;

/** Score of `query` against `text`, or null when it isn't a subsequence. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return 0;
  let score = 0;
  let run = 0;
  let qi = 0;
  let last = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    const atStart =
      ti === 0 ||
      BOUNDARY.test(text[ti - 1]) ||
      (text[ti] !== text[ti].toLowerCase() &&
        text[ti - 1] === text[ti - 1].toLowerCase());
    run = ti === last + 1 ? run + 1 : 1;
    score += 1 + (atStart ? 4 : 0) + (run > 1 ? 3 * (run - 1) : 0);
    if (last >= 0) score -= Math.min(3, (ti - last - 1) * 0.1);
    last = ti;
    qi++;
  }
  if (qi < q.length) return null;
  return score - t.length * 0.01;
}

const KIND_ORDER: Record<SearchKind, number> = {
  analyzer: 0,
  person: 1,
  dir: 2,
  file: 3,
};

export interface Ranked {
  entry: EntityEntry;
  score: number;
}

/**
 * The best `limit` entries for `query`. Labels count fully; keywords (full
 * paths, emails, aliases) at a small discount. Ties go to analyzers, then
 * people, directories, files; then the shorter label.
 */
export function rankEntities(
  query: string,
  entries: readonly EntityEntry[],
  limit = 20,
): Ranked[] {
  const q = query.trim();
  if (!q) return [];
  const out: Ranked[] = [];
  for (const entry of entries) {
    let best = fuzzyScore(q, entry.label);
    for (const k of entry.keywords) {
      const s = fuzzyScore(q, k);
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
