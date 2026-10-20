// Risk's Root causes (docs/atlas-views.md › Risk): the source files that keep
// changing together with the risky ones — what sits upstream of them.
//
// The risky end is the score stacks' set (cursed files and near misses), so a
// file travels between the two forms. Risky files that move as a family (one
// change made in each of them, like React's seven feature-flag forks) are one
// node: otherwise every hub touching the family reaches "seven risky files",
// and the ranking only measures the family's size.
//
// A family is joined like a lockstep group (churn/lockstep.ts), against the
// busier file's commits, at a looser bar: lockstep is "the same change", a
// family only "nearly always changes together". Hubs are source files coupled
// to a risky node (tests change with the code they test; that's a symptom,
// not a cause), ranked by risky nodes reached, then by commits shared.

import { makeFileKind } from '../files/fileKind';
import { riskStacksOf, type StackRow } from './stacks';
import type { CoupledPair, GitrelicReport } from '@gitrelic/core';

/** Risky files join a family when a pair shares this share of the busier file's commits… */
export const FAMILY_STRENGTH = 75;
/** …over at least this many commits. */
export const FAMILY_COMMITS = 5;
/** Hubs drawn, best first. */
export const MAX_HUBS = 8;
/** A family's shared name prefix needs this many characters, else it's named after its top member. */
const MIN_PREFIX = 4;

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export interface RiskNode {
  /** The file the node is drawn as: the family's highest score. */
  file: string;
  /** Every file in the node, highest score first (one, outside a family). */
  members: StackRow[];
  /** The family's name (`ReactFeatureFlags.*`); null for a single file. */
  family: string | null;
  /** The best member's score, and whether any member is cursed. */
  score: number;
  cursed: boolean;
}

export interface HubLink {
  /** The node's file (`RiskNode.file`). */
  node: string;
  /** Commits the hub shares with the node's most coupled member. */
  coCommits: number;
  /** That member. */
  member: string;
}

export interface Hub {
  file: string;
  /** The hub's commits in the window (from coupling). */
  commits: number;
  /** One per risky node it changes with, most shared commits first. */
  links: HubLink[];
  /** Risky files it reaches: a family counts every member. */
  files: number;
  /** The links' shared commits, summed. */
  shared: number;
}

export interface RootCauses {
  /** Every risky node, cursed families first, then by score. */
  nodes: RiskNode[];
  /** The top MAX_HUBS hubs, best first. */
  hubs: Hub[];
  /** Every hub found, before the cap. */
  hubCount: number;
}

/** A pair shares at least `strength`% of the busier file's commits over `commits`. */
function together(p: CoupledPair, strength: number, commits: number): boolean {
  return (
    p.coCommits >= commits &&
    p.coCommits * 100 >= strength * Math.max(p.totalCommitsA, p.totalCommitsB)
  );
}

/**
 * A family's name: the members' longest shared basename prefix, trimmed back
 * to a word boundary, plus `.*` (`ReactFeatureFlags.*`). Too short a prefix
 * names it after its top member instead (`api.ts +2`).
 */
export function familyName(files: readonly string[]): string {
  const names = files.map(baseName);
  let prefix = names[0];
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++;
    prefix = prefix.slice(0, i);
  }
  prefix = prefix.replace(/[.\-_]+$/, '');
  return prefix.length >= MIN_PREFIX
    ? `${prefix}.*`
    : `${names[0]} +${files.length - 1}`;
}

export function rootCauses(report: GitrelicReport): RootCauses {
  const rows = riskStacksOf(report).rows;
  const rowOf = new Map(rows.map((r) => [r.file, r]));
  const pairs = report.coupling.pairs;

  // Families: union-find over risky pairs that nearly always change together.
  const parent = new Map(rows.map((r) => [r.file, r.file]));
  const find = (f: string): string => {
    let root = f;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(f, root);
    return root;
  };
  for (const p of pairs) {
    if (!rowOf.has(p.fileA) || !rowOf.has(p.fileB)) continue;
    if (!together(p, FAMILY_STRENGTH, FAMILY_COMMITS)) continue;
    parent.set(find(p.fileA), find(p.fileB));
  }
  const groups = new Map<string, StackRow[]>();
  for (const r of rows) {
    const root = find(r.file);
    groups.set(root, [...(groups.get(root) ?? []), r]);
  }
  const nodes: RiskNode[] = [...groups.values()].map((members) => {
    // Rows are already highest score first, cursed before near misses.
    const top = members[0];
    return {
      file: top.file,
      members,
      family:
        members.length > 1 ? familyName(members.map((m) => m.file)) : null,
      score: top.score,
      cursed: members.some((m) => m.cursed),
    };
  });
  const nodeOf = new Map<string, string>();
  for (const node of nodes)
    for (const m of node.members) nodeOf.set(m.file, node.file);

  // Hubs: source files outside the risky set, each with its strongest link
  // into every node it changes with.
  const kindOf = makeFileKind(report);
  const found = new Map<
    string,
    { commits: number; links: Map<string, HubLink> }
  >();
  for (const p of pairs) {
    for (const [hub, risky, hubCommits] of [
      [p.fileA, p.fileB, p.totalCommitsA],
      [p.fileB, p.fileA, p.totalCommitsB],
    ] as const) {
      const node = nodeOf.get(risky);
      if (!node || nodeOf.has(hub) || kindOf(hub) !== 'source') continue;
      let h = found.get(hub);
      if (!h) {
        h = { commits: hubCommits, links: new Map() };
        found.set(hub, h);
      }
      const prev = h.links.get(node);
      if (!prev || p.coCommits > prev.coCommits)
        h.links.set(node, { node, coCommits: p.coCommits, member: risky });
    }
  }
  const hubs: Hub[] = [...found].map(([file, h]) => {
    const links = [...h.links.values()].sort(
      (a, b) => b.coCommits - a.coCommits || a.node.localeCompare(b.node),
    );
    return {
      file,
      commits: h.commits,
      links,
      files: links.reduce(
        (n, l) => n + nodes.find((nd) => nd.file === l.node)!.members.length,
        0,
      ),
      shared: links.reduce((s, l) => s + l.coCommits, 0),
    };
  });
  hubs.sort(
    (a, b) =>
      b.links.length - a.links.length ||
      b.shared - a.shared ||
      a.file.localeCompare(b.file),
  );
  return { nodes, hubs: hubs.slice(0, MAX_HUBS), hubCount: hubs.length };
}

const cache = new WeakMap<GitrelicReport, RootCauses>();
/** `rootCauses`, computed once per report: the layout and the findings share it. */
export function rootCausesOf(report: GitrelicReport): RootCauses {
  let rc = cache.get(report);
  if (!rc) {
    rc = rootCauses(report);
    cache.set(report, rc);
  }
  return rc;
}

/** A hub's tooltip: what it changes with, and how often. */
export function hubTip(
  hub: Hub,
  name: string,
  nodeLabel: (node: string) => string,
): string[] {
  return [
    name,
    `Changes with ${hub.files} risky ${hub.files === 1 ? 'file' : 'files'}`,
    ...hub.links.map(
      (l) =>
        `${nodeLabel(l.node)} · ${l.coCommits} of its ${hub.commits} commits`,
    ),
  ];
}

/** A risky node's tooltip: its score, or a family's members with theirs. */
export function nodeTip(
  node: RiskNode,
  name: string,
  memberName: (file: string) => string,
  hubs: number,
): string[] {
  const status = (r: StackRow) =>
    r.cursed ? `${r.score} · cursed` : `${r.score} · ${r.short} short`;
  const tip =
    node.family === null
      ? [name, `Score ${status(node.members[0])}`]
      : [
          name,
          `${node.members.length} files that change together in nearly every commit`,
          ...node.members.map((m) => `${memberName(m.file)} · ${status(m)}`),
        ];
  tip.push(
    hubs === 0
      ? 'No source file here changes with it often'
      : `${hubs} ${hubs === 1 ? 'hub changes' : 'hubs change'} with it`,
  );
  return tip;
}
