import {
  classifyAuthor,
  resolveAuthorDisplayName,
} from '../../utils/authorClassification';
import type { GitrelicReport } from '@gitrelic/core';

// Bots are stripped from pairs[] upstream by the analyzer, so the graph
// only ever renders human or AI nodes. Narrowing the type makes the
// invariant explicit and lets render branches elide a dead 'bot' case.
export type GraphAuthorClass = 'human' | 'ai';

export interface AuthorGraphNode {
  id: string;
  label: string;
  displayName: string;
  classification: GraphAuthorClass;
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

export interface AuthorGraphResult {
  nodes: AuthorGraphNode[];
  links: AuthorGraphLink[];
  filteredSingleCommitEdges: number;
}

const AUTHOR_ID_RE = /^(.*) <(.+)>$/;

function parseAuthorId(id: string): { name: string; email: string } {
  const match = AUTHOR_ID_RE.exec(id);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  // Co-author analyzer emits bare lowercased emails as pair.authorA/authorB.
  // Treat any id containing `@` as the email (no name component).
  if (id.includes('@')) return { name: '', email: id };
  return { name: id, email: '' };
}

export function buildAuthorGraph(report: GitrelicReport): AuthorGraphResult {
  const pairs = report.coAuthors.pairs;
  const contributors = report.contributors?.contributors ?? [];

  const filteredSingleCommitEdges = pairs.filter(
    (p) => p.coAuthoredCommits === 1,
  ).length;
  const visiblePairs = pairs.filter((p) => p.coAuthoredCommits > 1);

  const links: AuthorGraphLink[] = visiblePairs.map((p) => ({
    source: p.authorA,
    target: p.authorB,
    coAuthoredCommits: p.coAuthoredCommits,
    sharedFiles: p.files.length,
  }));

  const statsMap = new Map(
    report.coAuthors.authorStats.map((s) => [s.author, s]),
  );

  const derivedCommits = new Map<string, number>();
  const partnerCounts = new Map<string, number>();
  for (const p of visiblePairs) {
    derivedCommits.set(
      p.authorA,
      (derivedCommits.get(p.authorA) ?? 0) + p.coAuthoredCommits,
    );
    derivedCommits.set(
      p.authorB,
      (derivedCommits.get(p.authorB) ?? 0) + p.coAuthoredCommits,
    );
    partnerCounts.set(p.authorA, (partnerCounts.get(p.authorA) ?? 0) + 1);
    partnerCounts.set(p.authorB, (partnerCounts.get(p.authorB) ?? 0) + 1);
  }

  const nodes: AuthorGraphNode[] = Array.from(derivedCommits.keys()).map(
    (id) => {
      const stats = statsMap.get(id);
      const { name, email } = parseAuthorId(id);
      const lookupKey = email || id;
      let displayName = resolveAuthorDisplayName(lookupKey, contributors);
      // Legacy "Name <email>" id format: when AI/contributor lookup falls
      // through to the email, prefer the parsed name. Bare-email ids skip
      // this branch (name === '') and surface the email as the fallback.
      if (displayName === lookupKey && name) {
        displayName = name;
      }
      // Bots can't appear here (analyzer-filtered), so coerce to the narrow type.
      const cls = classifyAuthor(email || id);
      return {
        id,
        label: displayName,
        displayName,
        classification: cls === 'bot' ? 'human' : cls,
        coAuthoredCommits:
          stats?.coAuthoredCommits ?? derivedCommits.get(id) ?? 0,
        partnerCount: partnerCounts.get(id) ?? 0,
        primaryPartner: stats?.primaryPartner ?? null,
      };
    },
  );

  return { nodes, links, filteredSingleCommitEdges };
}
