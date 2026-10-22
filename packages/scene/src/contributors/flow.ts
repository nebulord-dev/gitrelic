// Contributors' Flow (docs/atlas-views.md › Contributors): who commits into
// which package. The people with the most commits on one side, the packages
// with the most commits on the other, and everyone and everything else in
// an "others" node on each side, so the two sides add up to the same total.
//
// A link counts the commits a person made that touch a package; a commit
// touching two packages counts once in each, so a person's links can add up
// to more than their commit count. Packages are `packageOf`'s (the grouping
// Hotspots and Churn use). Statuses come from the contributors report, which
// measures them from the analyzed commit.

import { packageOf } from '../hotspots/points';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

/** People drawn on their own; the rest share the others' node. */
export const FLOW_PEOPLE = 14;
/** Packages drawn on their own; the rest share the other packages' node. */
export const FLOW_PACKAGES = 11;
/**
 * A package is flagged as left behind when at least this share of its
 * commits came from people no longer active (quiet or gone).
 */
export const LEFT_BEHIND_SHARE = 0.5;

export type PersonStatus = 'active' | 'quiet' | 'ghost';

export interface FlowPerson {
  email: string;
  name: string;
  status: PersonStatus;
  /** Commits in the window (the contributors report's count). */
  commits: number;
  filesOwned: number;
  lastCommit: string;
  /** Their commits into each package, most first. */
  packages: { dir: string; commits: number }[];
}

export interface FlowPackage {
  /** `packageOf`'s path; '' for files at the repository root. */
  dir: string;
  /** Commits touching it. */
  commits: number;
  people: number;
  /** Its commits by the author's status. */
  byStatus: Record<PersonStatus, number>;
  /** The person with the most commits into it. */
  top: { email: string; name: string; commits: number } | null;
}

/** One side's "everyone else" node. */
export interface FlowOthers {
  /** People (or packages) it stands for. */
  count: number;
  /** Their commits along the flow. */
  commits: number;
}

export interface FlowLink {
  /** A drawn person's email, or null for the others' node. */
  email: string | null;
  /** A drawn package, or null for the other packages' node. */
  dir: string | null;
  commits: number;
}

export interface ContributorFlow {
  people: FlowPerson[];
  packages: FlowPackage[];
  otherPeople: FlowOthers;
  otherPackages: FlowOthers;
  /** People with exactly one commit in the window. */
  oneCommit: number;
  links: FlowLink[];
}

export function personStatus(c: {
  isActive: boolean;
  isGhost: boolean;
}): PersonStatus {
  return c.isActive ? 'active' : c.isGhost ? 'ghost' : 'quiet';
}

/** Share of a package's commits made by people no longer active. */
export function notActiveShare(p: FlowPackage): number {
  return p.commits === 0
    ? 0
    : (p.byStatus.quiet + p.byStatus.ghost) / p.commits;
}

export function contributorFlow(
  report: GitrelicReport,
  commits: readonly CommitLike[],
): ContributorFlow {
  const contributors = report.contributors.contributors;
  const statusOf = new Map(contributors.map((c) => [c.email, personStatus(c)]));
  const nameOf = new Map(contributors.map((c) => [c.email, c.name]));

  // person → package → commits, and package totals, in one pass.
  const byPerson = new Map<string, Map<string, number>>();
  const pkgCommits = new Map<string, number>();
  const pkgPeople = new Map<string, Map<string, number>>();
  for (const c of commits) {
    const dirs = new Set(c.files.map(packageOf));
    let mine = byPerson.get(c.author);
    if (!mine) byPerson.set(c.author, (mine = new Map()));
    for (const d of dirs) {
      mine.set(d, (mine.get(d) ?? 0) + 1);
      pkgCommits.set(d, (pkgCommits.get(d) ?? 0) + 1);
      let who = pkgPeople.get(d);
      if (!who) pkgPeople.set(d, (who = new Map()));
      who.set(c.author, (who.get(c.author) ?? 0) + 1);
    }
  }

  // The report's order: most commits first (its own tie-break).
  const people: FlowPerson[] = contributors.slice(0, FLOW_PEOPLE).map((c) => ({
    email: c.email,
    name: c.name,
    status: personStatus(c),
    commits: c.commitCount,
    filesOwned: c.filesOwned,
    lastCommit: c.lastCommit,
    packages: [...(byPerson.get(c.email) ?? [])]
      .map(([dir, n]) => ({ dir, commits: n }))
      .sort((a, b) => b.commits - a.commits || (a.dir < b.dir ? -1 : 1)),
  }));
  const drawn = new Set(people.map((p) => p.email));

  const allPackages: FlowPackage[] = [...pkgCommits]
    .map(([dir, n]) => {
      const byStatus: Record<PersonStatus, number> = {
        active: 0,
        quiet: 0,
        ghost: 0,
      };
      let top: FlowPackage['top'] = null;
      for (const [email, k] of pkgPeople.get(dir)!) {
        // Someone the report doesn't list (it always should) counts as quiet.
        byStatus[statusOf.get(email) ?? 'quiet'] += k;
        if (!top || k > top.commits || (k === top.commits && email < top.email))
          top = { email, name: nameOf.get(email) ?? email, commits: k };
      }
      return {
        dir,
        commits: n,
        people: pkgPeople.get(dir)!.size,
        byStatus,
        top,
      };
    })
    .sort((a, b) => b.commits - a.commits || (a.dir < b.dir ? -1 : 1));
  const packages = allPackages.slice(0, FLOW_PACKAGES);
  const shown = new Set(packages.map((p) => p.dir));

  // Links, folding the undrawn ends into the others' nodes.
  const merged = new Map<string, FlowLink>();
  for (const [email, mine] of byPerson) {
    const who = drawn.has(email) ? email : null;
    for (const [d, n] of mine) {
      const dir = shown.has(d) ? d : null;
      const key = `${who ?? ''}\u0000${dir ?? '\u0000'}`;
      const link = merged.get(key);
      if (link) link.commits += n;
      else merged.set(key, { email: who, dir, commits: n });
    }
  }
  const links = [...merged.values()];

  const sum = (pred: (l: FlowLink) => boolean) =>
    links.filter(pred).reduce((s, l) => s + l.commits, 0);
  return {
    people,
    packages,
    otherPeople: {
      count: Math.max(0, contributors.length - people.length),
      commits: sum((l) => l.email === null),
    },
    otherPackages: {
      count: allPackages.length - packages.length,
      commits: sum((l) => l.dir === null),
    },
    oneCommit: contributors.filter((c) => c.commitCount === 1).length,
    links,
  };
}

// Commits arrive as one array per load; the report and that array together
// key the result, so switching forms back and forth doesn't recount.
const cache = new WeakMap<
  GitrelicReport,
  WeakMap<readonly CommitLike[], ContributorFlow>
>();
/** `contributorFlow`, computed once per report and commit list. */
export function contributorFlowOf(
  report: GitrelicReport,
  commits: readonly CommitLike[],
): ContributorFlow {
  let byCommits = cache.get(report);
  if (!byCommits) {
    byCommits = new WeakMap();
    cache.set(report, byCommits);
  }
  let flow = byCommits.get(commits);
  if (!flow) {
    flow = contributorFlow(report, commits);
    byCommits.set(commits, flow);
  }
  return flow;
}
