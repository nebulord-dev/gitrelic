import {
  aiProductName,
  classifyAuthor,
  isAiEmail,
} from '../utils/authorClassification.js';
import { packageOf } from './commit-timing.js';
import { MAX_FIX_FILES } from './fix-rate.js';
import type {
  AdoptionTier,
  AiAgentStat,
  AiAuthorStat,
  AiToolStat,
  CoAuthorPackage,
  CoAuthorMonthEntry,
  CoAuthorPair,
  CoAuthorPairClassification,
  CoAuthorReport,
  CoAuthorStats,
  PerAuthorMixEntry,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

// `none` only when no commit had AI in it: 16 AI commits among React's
// 18,938 round to 0%, and that is low adoption, not none.
function adoptionTier(percent: number, aiCommits: number): AdoptionTier {
  if (aiCommits === 0) return 'none';
  if (percent < 20) return 'low';
  if (percent < 50) return 'moderate';
  return 'high';
}

interface PairAccum {
  authorA: string;
  authorB: string;
  commits: number;
  files: Set<string>;
  classification: CoAuthorPairClassification;
}

interface AuthorAccum {
  author: string;
  displayName: string;
  aiCommits: number;
  soloCommits: number;
  totalCommits: number;
}

/**
 * @param trackedFiles - the analyzed commit's files: a package counts only
 *   files that still exist. Omitted, every file counts.
 */
export function analyzeCoAuthors(
  commits: RawCommit[],
  trackedFiles?: readonly string[],
): CoAuthorReport {
  const tracked = trackedFiles ? new Set(trackedFiles) : null;
  const pairMap = new Map<string, PairAccum>();
  const tools = new Map<string, AiToolStat>();
  const agents = new Map<string, AiAgentStat>();
  const packages = new Map<string, CoAuthorPackage>();
  let aiAuthoredCommits = 0;
  let sweepingLeftOut = 0;
  const authorCoAuthorCount = new Map<string, number>();
  const authorAccum = new Map<string, AuthorAccum>();
  const monthMap = new Map<string, CoAuthorMonthEntry>();

  let totalCoAuthoredCommits = 0;
  let aiAssistedCommits = 0;
  let humanAuthoredCommits = 0;
  let filteredBotCommits = 0;

  for (const commit of commits) {
    const primaryEmailLower = commit.authorEmail.toLowerCase();

    // Bot-authored commits are stripped from analysis entirely; only the count is reported.
    // Use classifyAuthor (not isBotEmail directly) so AI-takes-precedence — emails like
    // devin-ai-integration[bot]@users.noreply.github.com match BOTH AI and bot patterns
    // and must be classified as AI.
    if (classifyAuthor(primaryEmailLower) === 'bot') {
      filteredBotCommits++;
      continue;
    }

    // AI-as-primary-author (rare — Devin etc.) is excluded from the human denominator.
    // It still counts toward totalCoAuthoredCommits if it has co-authors, but doesn't anchor
    // a "human used AI" relationship.
    const primaryIsAi = isAiEmail(primaryEmailLower);

    if (!primaryIsAi) {
      humanAuthoredCommits++;
    }

    const coAuthorEmails = commit.coAuthors.map((c) => c.email.toLowerCase());
    const hasAiCoAuthor = coAuthorEmails.some(isAiEmail);

    // An agent's own commit is AI-authored; a person's with an AI trailer is
    // AI-assisted. An agent's commit with an AI trailer is still authored.
    const tool = (product: string) => {
      const t = tools.get(product) ?? { product, assisted: 0, authored: 0 };
      tools.set(product, t);
      return t;
    };
    if (primaryIsAi) {
      aiAuthoredCommits++;
      const product = aiProductName(primaryEmailLower) ?? 'AI';
      tool(product).authored++;
      const agent = agents.get(primaryEmailLower) ?? {
        author: primaryEmailLower,
        displayName: commit.authorName || product,
        product,
        commits: 0,
      };
      agent.commits++;
      agents.set(primaryEmailLower, agent);
    } else {
      const products = new Set(
        coAuthorEmails.filter(isAiEmail).map((e) => aiProductName(e) ?? 'AI'),
      );
      for (const product of products) tool(product).assisted++;
    }

    if (commit.files.length > MAX_FIX_FILES) {
      sweepingLeftOut++;
    } else {
      const touched = new Set(
        commit.files.filter((f) => !tracked || tracked.has(f)).map(packageOf),
      );
      for (const pkg of touched) {
        const row = packages.get(pkg) ?? {
          package: pkg,
          commits: 0,
          aiAssisted: 0,
          aiAuthored: 0,
        };
        row.commits++;
        if (primaryIsAi) row.aiAuthored++;
        else if (hasAiCoAuthor) row.aiAssisted++;
        packages.set(pkg, row);
      }
    }

    // Author-mix accumulation (humans only).
    if (!primaryIsAi) {
      const accum = authorAccum.get(primaryEmailLower) ?? {
        author: primaryEmailLower,
        displayName: commit.authorName || primaryEmailLower,
        aiCommits: 0,
        soloCommits: 0,
        totalCommits: 0,
      };
      accum.totalCommits++;
      if (hasAiCoAuthor) accum.aiCommits++;
      else accum.soloCommits++;
      // Prefer the first non-empty name we see; never overwrite with empty.
      if (!accum.displayName && commit.authorName) {
        accum.displayName = commit.authorName;
      }
      authorAccum.set(primaryEmailLower, accum);
    }

    if (!primaryIsAi && hasAiCoAuthor) {
      aiAssistedCommits++;
    }

    // Monthly bucket: every commit lands here. `aiAuthored` counts an agent's
    // own commits, `aiAssisted` a person's with an AI co-author, `pureHuman`
    // everything else (solo or human-pair).
    const month = commit.date.slice(0, 7); // ISO `YYYY-MM`
    const monthEntry = monthMap.get(month) ?? {
      month,
      aiAssisted: 0,
      pureHuman: 0,
      total: 0,
      aiAuthored: 0,
    };
    if (primaryIsAi) {
      monthEntry.aiAuthored++;
    } else if (hasAiCoAuthor) {
      monthEntry.aiAssisted++;
    } else {
      monthEntry.pureHuman++;
    }
    monthEntry.total = monthEntry.aiAssisted + monthEntry.pureHuman;
    monthMap.set(month, monthEntry);

    // Trailer-bearing commits — the rest of the analysis only fires when there are co-authors.
    if (commit.coAuthors.length === 0) continue;

    // Drop bot co-authors from the participant set (they're noise). Same
    // classifyAuthor() use as the primary-author check so AI wins over bot.
    // Crediting yourself (React has 79 such commits) isn't co-authoring.
    const filteredCoAuthors = coAuthorEmails.filter(
      (e) => classifyAuthor(e) !== 'bot' && e !== primaryEmailLower,
    );
    if (filteredCoAuthors.length === 0) continue;

    totalCoAuthoredCommits++;

    // Pair-graph accumulation. Primary author always counted as a participant
    // (including AI primaries like Devin) so AI↔human pairs from AI-primary
    // commits don't silently drop out of the graph.
    const uniqueParticipants = [
      ...new Set([primaryEmailLower, ...filteredCoAuthors]),
    ];

    for (let i = 0; i < uniqueParticipants.length; i++) {
      for (let j = i + 1; j < uniqueParticipants.length; j++) {
        const a = uniqueParticipants[i];
        const b = uniqueParticipants[j];
        const key = pairKey(a, b);

        // Bots already filtered, so classification is binary.
        const classification: CoAuthorPairClassification =
          isAiEmail(a) || isAiEmail(b) ? 'human-ai' : 'human-pair';

        if (!pairMap.has(key)) {
          pairMap.set(key, {
            authorA: a < b ? a : b,
            authorB: a < b ? b : a,
            commits: 0,
            files: new Set(),
            classification,
          });
        }
        const pair = pairMap.get(key)!;
        pair.commits++;
        for (const file of commit.files) pair.files.add(file);
      }
    }

    // authorStats: per-co-author appearance count (used by Inspector).
    for (const coAuthor of filteredCoAuthors) {
      authorCoAuthorCount.set(
        coAuthor,
        (authorCoAuthorCount.get(coAuthor) ?? 0) + 1,
      );
    }
  }

  const pairs: CoAuthorPair[] = [...pairMap.values()]
    .map((p) => ({
      authorA: p.authorA,
      authorB: p.authorB,
      coAuthoredCommits: p.commits,
      files: [...p.files],
      classification: p.classification,
    }))
    .sort((a, b) => b.coAuthoredCommits - a.coAuthoredCommits);

  const humanPairs = pairs.filter((p) => p.classification === 'human-pair');

  // Per-author primary-partner derivation for authorStats.
  const authorPairCounts = new Map<
    string,
    { total: number; partners: Map<string, number> }
  >();
  for (const pair of pairs) {
    for (const author of [pair.authorA, pair.authorB]) {
      const entry = authorPairCounts.get(author) ?? {
        total: 0,
        partners: new Map(),
      };
      entry.total += pair.coAuthoredCommits;
      const partner = author === pair.authorA ? pair.authorB : pair.authorA;
      entry.partners.set(
        partner,
        (entry.partners.get(partner) ?? 0) + pair.coAuthoredCommits,
      );
      authorPairCounts.set(author, entry);
    }
  }

  const authorStats: CoAuthorStats[] = [...authorCoAuthorCount.entries()]
    .map(([author, coAuthoredCommits]) => {
      const pairData = authorPairCounts.get(author);
      let primaryPartner: string | null = null;
      if (pairData) {
        let maxCount = 0;
        for (const [partner, count] of pairData.partners) {
          if (count > maxCount) {
            maxCount = count;
            primaryPartner = partner;
          }
        }
      }
      return { author, coAuthoredCommits, primaryPartner };
    })
    .sort((a, b) => b.coAuthoredCommits - a.coAuthoredCommits);

  // Per-author mix (all human authors, sorted desc by personalRatio).
  const perAuthorMix: PerAuthorMixEntry[] = [...authorAccum.values()]
    .map((a) => ({
      author: a.author,
      displayName: a.displayName,
      aiCommits: a.aiCommits,
      soloCommits: a.soloCommits,
      totalCommits: a.totalCommits,
      personalRatio:
        a.totalCommits > 0
          ? Math.round((a.aiCommits / a.totalCommits) * 100)
          : 0,
    }))
    .sort((a, b) => {
      if (b.personalRatio !== a.personalRatio)
        return b.personalRatio - a.personalRatio;
      if (b.totalCommits !== a.totalCommits)
        return b.totalCommits - a.totalCommits;
      return a.author.localeCompare(b.author);
    });

  // aiAuthors: humans with personalRatio > 0, sorted desc by aiCommits.
  const aiAuthors: AiAuthorStat[] = perAuthorMix
    .filter((m) => m.personalRatio > 0)
    .map((m) => ({
      author: m.author,
      displayName: m.displayName,
      aiCommits: m.aiCommits,
      totalCommits: m.totalCommits,
      personalRatio: m.personalRatio,
    }))
    .sort((a, b) => {
      if (b.aiCommits !== a.aiCommits) return b.aiCommits - a.aiCommits;
      if (b.personalRatio !== a.personalRatio)
        return b.personalRatio - a.personalRatio;
      return a.author.localeCompare(b.author);
    });

  const aiCommits = aiAssistedCommits + aiAuthoredCommits;
  const counted = humanAuthoredCommits + aiAuthoredCommits;
  const aiAdoptionPercent =
    counted > 0 ? Math.round((aiCommits / counted) * 100) : 0;
  const aiAdoptionTierValue = adoptionTier(aiAdoptionPercent, aiCommits);

  const byMonth: CoAuthorMonthEntry[] = [...monthMap.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  const agentPart =
    aiAuthoredCommits > 0
      ? `; ${aiAuthoredCommits} authored by an AI agent`
      : '';
  const summary =
    aiCommits > 0
      ? `${aiAdoptionPercent}% of commits had AI in them (${aiAssistedCommits} of ${humanAuthoredCommits} human commits AI-assisted${agentPart})`
      : totalCoAuthoredCommits > 0
        ? `${totalCoAuthoredCommits} co-authored commit${totalCoAuthoredCommits !== 1 ? 's' : ''} across ${humanPairs.length} human pair${humanPairs.length !== 1 ? 's' : ''} — no AI assistance`
        : 'No co-authored commits found';

  return {
    pairs,
    authorStats,
    totalCoAuthoredCommits,
    summary,
    aiAssistedCommits,
    humanAuthoredCommits,
    aiAdoptionPercent,
    aiAdoptionTier: aiAdoptionTierValue,
    aiAuthors,
    humanPairs,
    filteredBotCommits,
    byMonth,
    perAuthorMix,
    aiAuthoredCommits,
    aiTools: [...tools.values()].sort(
      (a, b) =>
        b.assisted + b.authored - (a.assisted + a.authored) ||
        a.product.localeCompare(b.product),
    ),
    aiAgents: [...agents.values()].sort(
      (a, b) => b.commits - a.commits || a.author.localeCompare(b.author),
    ),
    packages: [...packages.values()].sort(
      (a, b) => b.commits - a.commits || a.package.localeCompare(b.package),
    ),
    sweepingLeftOut,
  };
}
