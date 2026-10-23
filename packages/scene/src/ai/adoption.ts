// AI & Co-authors' Adoption lanes (docs/atlas-views.md › AI & Co-authors):
// one row per person, their commits bin by bin over the time strip's weeks,
// with the part that had AI in it, so who started using AI, and when, reads
// across everyone at once (the time strip shows one selection's weeks).
//
// Rows: everyone with an AI commit (most first), AI agents included under
// their own row, then the busiest of the rest, up to ADOPTION_ROWS. Bots are
// left out, as core leaves them out of adoption.

import { aiProductName, classifyAuthor } from '../authors/authorClassification';
import { ids, type EntityId } from '../ids';
import { timeBins } from '../time/bins';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

export const ADOPTION_ROWS = 14;

export interface AdoptionRow {
  id: EntityId;
  name: string;
  /** The AI product for an agent's own row; null for a person. */
  agent: string | null;
  commits: number;
  /** Commits with AI in them (for an agent, all of its own). */
  ai: number;
  /** Their first commit with AI in it, epoch ms; null with none. */
  firstAi: number | null;
  /** Commits per bin, aligned with `AdoptionLanes.binStarts`. */
  bins: number[];
  /** Of those, with AI in them. */
  aiBins: number[];
}

export interface AdoptionLanes {
  unit: 'week' | 'month';
  binStarts: number[];
  rows: AdoptionRow[];
  /** People with commits who aren't drawn. */
  others: number;
  /** How many of those used AI. */
  othersWithAi: number;
}

export function adoptionLanes(
  report: GitrelicReport,
  commits: readonly CommitLike[],
): AdoptionLanes {
  const counted = commits.filter((c) => classifyAuthor(c.author) !== 'bot');
  const { unit, binStarts, binOf } = timeBins(counted);
  const names = new Map(
    report.contributors.contributors.map((c) => [c.email, c.name]),
  );
  const people = new Map<string, AdoptionRow>();
  for (const c of counted) {
    let p = people.get(c.author);
    if (!p) {
      const product =
        classifyAuthor(c.author) === 'ai'
          ? (aiProductName(c.author) ?? 'AI')
          : null;
      p = {
        id: ids.person(c.author),
        name: product
          ? `${product} (agent)`
          : (names.get(c.author) ?? c.author),
        agent: product,
        commits: 0,
        ai: 0,
        firstAi: null,
        bins: new Array<number>(binStarts.length).fill(0),
        aiBins: new Array<number>(binStarts.length).fill(0),
      };
      people.set(c.author, p);
    }
    const b = binOf(c.timeMs);
    p.commits++;
    p.bins[b]++;
    if ((c.ai ?? 0) > 0) {
      p.ai++;
      p.aiBins[b]++;
      if (p.firstAi === null || c.timeMs < p.firstAi) p.firstAi = c.timeMs;
    }
  }

  const all = [...people.values()];
  const withAi = all
    .filter((p) => p.ai > 0)
    .sort(
      (a, b) =>
        b.ai - a.ai || b.commits - a.commits || a.name.localeCompare(b.name),
    );
  const rest = all
    .filter((p) => p.ai === 0)
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
  const rows = [...withAi, ...rest].slice(0, ADOPTION_ROWS);
  const drawn = new Set(rows);
  const left = all.filter((p) => !drawn.has(p));
  return {
    unit,
    binStarts,
    rows,
    others: left.length,
    othersWithAi: left.filter((p) => p.ai > 0).length,
  };
}

const cache = new WeakMap<
  GitrelicReport,
  WeakMap<readonly CommitLike[], AdoptionLanes>
>();
/** `adoptionLanes`, computed once per report and commit list. */
export function adoptionLanesOf(
  report: GitrelicReport,
  commits: readonly CommitLike[],
): AdoptionLanes {
  let byCommits = cache.get(report);
  if (!byCommits) {
    byCommits = new WeakMap();
    cache.set(report, byCommits);
  }
  let lanes = byCommits.get(commits);
  if (!lanes) {
    lanes = adoptionLanes(report, commits);
    byCommits.set(commits, lanes);
  }
  return lanes;
}
