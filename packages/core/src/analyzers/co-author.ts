import type { RawCommit } from '../utils/git.js';
import type { CoAuthorReport, CoAuthorPair, CoAuthorStats } from '../types.js';

const CO_AUTHOR_REGEX = /Co-authored-by:\s*(.+?)\s*<([^>]+)>/gi;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

export function analyzeCoAuthors(commits: RawCommit[]): CoAuthorReport {
  const pairMap = new Map<string, { authorA: string; authorB: string; commits: number; files: Set<string> }>();
  const authorCoAuthorCount = new Map<string, number>();
  let totalCoAuthoredCommits = 0;

  for (const commit of commits) {
    const coAuthors: string[] = [];
    let match;
    CO_AUTHOR_REGEX.lastIndex = 0;
    while ((match = CO_AUTHOR_REGEX.exec(commit.message)) !== null) {
      coAuthors.push(match[2].toLowerCase());
    }

    if (coAuthors.length === 0) continue;
    totalCoAuthoredCommits++;

    // All participants: commit author + co-authors
    const allAuthors = [commit.authorEmail.toLowerCase(), ...coAuthors];
    const uniqueAuthors = [...new Set(allAuthors)];

    // Record pairs between all participants
    for (let i = 0; i < uniqueAuthors.length; i++) {
      for (let j = i + 1; j < uniqueAuthors.length; j++) {
        const key = pairKey(uniqueAuthors[i], uniqueAuthors[j]);
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            authorA: uniqueAuthors[i] < uniqueAuthors[j] ? uniqueAuthors[i] : uniqueAuthors[j],
            authorB: uniqueAuthors[i] < uniqueAuthors[j] ? uniqueAuthors[j] : uniqueAuthors[i],
            commits: 0,
            files: new Set(),
          });
        }
        const pair = pairMap.get(key)!;
        pair.commits++;
        for (const file of commit.files) pair.files.add(file);
      }
    }

    // Count co-author appearances
    for (const coAuthor of coAuthors) {
      authorCoAuthorCount.set(coAuthor, (authorCoAuthorCount.get(coAuthor) ?? 0) + 1);
    }
  }

  const pairs: CoAuthorPair[] = [...pairMap.values()]
    .map(p => ({
      authorA: p.authorA,
      authorB: p.authorB,
      coAuthoredCommits: p.commits,
      files: [...p.files],
    }))
    .sort((a, b) => b.coAuthoredCommits - a.coAuthoredCommits);

  // Build per-author stats
  const authorPairCounts = new Map<string, { total: number; partners: Map<string, number> }>();
  for (const pair of pairs) {
    for (const author of [pair.authorA, pair.authorB]) {
      if (!authorPairCounts.has(author)) authorPairCounts.set(author, { total: 0, partners: new Map() });
      const entry = authorPairCounts.get(author)!;
      entry.total += pair.coAuthoredCommits;
      const partner = author === pair.authorA ? pair.authorB : pair.authorA;
      entry.partners.set(partner, (entry.partners.get(partner) ?? 0) + pair.coAuthoredCommits);
    }
  }

  const authorStats: CoAuthorStats[] = [...authorCoAuthorCount.entries()]
    .map(([author, coAuthoredCommits]) => {
      const pairData = authorPairCounts.get(author);
      let primaryPartner: string | null = null;
      if (pairData) {
        let maxCount = 0;
        for (const [partner, count] of pairData.partners) {
          if (count > maxCount) { maxCount = count; primaryPartner = partner; }
        }
      }
      return { author, coAuthoredCommits, primaryPartner };
    })
    .sort((a, b) => b.coAuthoredCommits - a.coAuthoredCommits);

  const summary = totalCoAuthoredCommits > 0
    ? `${totalCoAuthoredCommits} co-authored commit${totalCoAuthoredCommits !== 1 ? 's' : ''} across ${pairs.length} pair${pairs.length !== 1 ? 's' : ''}`
    : 'No co-authored commits found';

  return { pairs, authorStats, totalCoAuthoredCommits, summary };
}
