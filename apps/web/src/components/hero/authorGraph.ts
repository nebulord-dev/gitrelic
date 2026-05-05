import type { AuthorClass, Contributor, GitrelicReport } from '@gitrelic/core';

// Inlined from packages/core/src/utils/authorClassification.ts
// to avoid pulling core's bundled dist (which transitively includes execa
// and other Node-only deps) into the browser build. Per CLAUDE.md the web
// app may only `import type` from @gitrelic/core. Until core ships a
// browser-safe subpath export, this small duplication preserves the
// import-discipline invariant. Keep these patterns in sync with
// packages/core/src/utils/authorClassification.ts.
const AI_PATTERNS: { match: RegExp; productName: string }[] = [
  { match: /^noreply@anthropic\.com$/i, productName: 'Claude' },
  {
    match: /^copilot(\[bot\])?@.*\.noreply\.github\.com$/i,
    productName: 'GitHub Copilot',
  },
  { match: /^aider@aider\.chat$/i, productName: 'Aider' },
  {
    match: /^devin-ai-integration\[bot\]@.*\.noreply\.github\.com$/i,
    productName: 'Devin',
  },
  { match: /@cursor\.sh$/i, productName: 'Cursor' },
];

const BOT_PATTERNS: RegExp[] = [
  /^dependabot/i,
  /^renovate/i,
  /^semantic-release/i,
  /\[bot\]@.*\.noreply\.github\.com$/i,
  /^github-actions\[bot\]@/i,
];

function isAiEmail(email: string): boolean {
  return AI_PATTERNS.some((p) => p.match.test(email));
}

function isBotEmail(email: string): boolean {
  return BOT_PATTERNS.some((p) => p.test(email));
}

function classifyAuthor(email: string): AuthorClass {
  if (isAiEmail(email)) return 'ai';
  if (isBotEmail(email)) return 'bot';
  return 'human';
}

function aiProductName(email: string): string | null {
  for (const pattern of AI_PATTERNS) {
    if (pattern.match.test(email)) return pattern.productName;
  }
  return null;
}

export interface AuthorGraphNode {
  id: string;
  label: string;
  displayName: string;
  classification: AuthorClass;
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
  if (!match) return { name: id, email: '' };
  return { name: match[1].trim(), email: match[2].trim() };
}

function resolveDisplayName(
  id: string,
  contributorsByEmail: Map<string, Contributor>,
): string {
  const { name, email } = parseAuthorId(id);
  if (email) {
    const product = aiProductName(email);
    if (product) return product;
  }
  if (email) {
    const contrib = contributorsByEmail.get(email.toLowerCase());
    if (contrib && contrib.name && contrib.name.trim().length > 0) {
      return contrib.name;
    }
  }
  return name || id;
}

export function buildAuthorGraph(report: GitrelicReport): AuthorGraphResult {
  const pairs = report.coAuthors.pairs;

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

  const contributorsByEmail = new Map<string, Contributor>();
  const contributors = report.contributors?.contributors ?? [];
  for (const c of contributors) {
    if (c.email) {
      contributorsByEmail.set(c.email.toLowerCase(), c);
    }
  }

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
      const { email } = parseAuthorId(id);
      return {
        id,
        label: id.split(' <')[0],
        displayName: resolveDisplayName(id, contributorsByEmail),
        classification: classifyAuthor(email),
        coAuthoredCommits:
          stats?.coAuthoredCommits ?? derivedCommits.get(id) ?? 0,
        partnerCount: partnerCounts.get(id) ?? 0,
        primaryPartner: stats?.primaryPartner ?? null,
      };
    },
  );

  return { nodes, links, filteredSingleCommitEdges };
}
