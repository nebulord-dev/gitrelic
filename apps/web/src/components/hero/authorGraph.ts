import type { GitrelicReport } from '@gitrelic/core';

export interface AuthorGraphNode {
  id: string;
  label: string;
  coAuthoredCommits: number;
  partnerCount: number;
  primaryPartner: string | null;
}

export interface AuthorGraphLink {
  source: string;
  target: string;
  coAuthoredCommits: number;
  sharedFiles: number;
}

export function buildAuthorGraph(report: GitrelicReport): {
  nodes: AuthorGraphNode[];
  links: AuthorGraphLink[];
} {
  const pairs = report.coAuthors.pairs;

  const links: AuthorGraphLink[] = pairs.map((p) => ({
    source: p.authorA,
    target: p.authorB,
    coAuthoredCommits: p.coAuthoredCommits,
    sharedFiles: p.files.length,
  }));

  const statsMap = new Map(report.coAuthors.authorStats.map((s) => [s.author, s]));

  const derivedCommits = new Map<string, number>();
  const partnerCounts = new Map<string, number>();
  for (const p of pairs) {
    derivedCommits.set(p.authorA, (derivedCommits.get(p.authorA) ?? 0) + p.coAuthoredCommits);
    derivedCommits.set(p.authorB, (derivedCommits.get(p.authorB) ?? 0) + p.coAuthoredCommits);
    partnerCounts.set(p.authorA, (partnerCounts.get(p.authorA) ?? 0) + 1);
    partnerCounts.set(p.authorB, (partnerCounts.get(p.authorB) ?? 0) + 1);
  }

  const nodes: AuthorGraphNode[] = Array.from(derivedCommits.keys()).map((id) => {
    const stats = statsMap.get(id);
    return {
      id,
      label: id.split(' <')[0],
      coAuthoredCommits: stats?.coAuthoredCommits ?? derivedCommits.get(id) ?? 0,
      partnerCount: partnerCounts.get(id) ?? 0,
      primaryPartner: stats?.primaryPartner ?? null,
    };
  });

  return { nodes, links };
}
