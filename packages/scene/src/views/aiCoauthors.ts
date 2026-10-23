// Team & Activity › AI & Co-authors: how much of the code AI helped write,
// where, and who adopted it when (docs/atlas-views.md › AI & Co-authors).
// Where AI writes, packages by their AI share, is the primary form;
// Adoption lanes, people week by week, the alternate. In this lens the time
// strip shades each week's commits with AI in them.

import { adoptionLanesOf } from '../ai/adoption';
import {
  AI_PACKAGE_ROWS,
  aiPackageId,
  aiPackagesFrom,
  aiPackagesOf,
} from '../ai/packages';
import { withAi } from '../commits/commitLike';
import { entityKey, entityKind, ids, type EntityId } from '../ids';
import { adoptionLanesScene } from '../layouts/adoptionLanes';
import { aiPackagesScene } from '../layouts/aiPackages';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';
import type { GitrelicReport } from '@gitrelic/core';

const n = (v: number) => v.toLocaleString('en-US');
const pct = (v: number, of: number) =>
  of === 0 ? '0%' : `${Math.round((v / of) * 100)}%`;
const pct1 = (v: number, of: number) =>
  of === 0 ? '0%' : `${Math.round((v / of) * 1000) / 10}%`;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** A package needs this many commits before its share is called out. */
export const AI_SHARE_MIN_COMMITS = 20;

/** "Claude 16, Amp 1, Cursor 1": every AI tool by its commits. */
export function aiToolsLine(report: GitrelicReport): string {
  return report.coAuthors.aiTools
    .map((t) => `${t.product} ${n(t.assisted + t.authored)}`)
    .join(', ');
}

/** A person's entity id from core's lowercased email, via contributors. */
export function personIdOf(report: GitrelicReport, email: string): EntityId {
  const lower = email.toLowerCase();
  const c = report.contributors.contributors.find(
    (x) => x.email.toLowerCase() === lower,
  );
  return ids.person(c?.email ?? email);
}

export const whereAiLayout: Layout = {
  id: 'where',
  label: 'Where AI writes',
  caption:
    'Packages by commits, the part with AI in it in the accent (AI-assisted: a person’s commit with an AI co-author; the lighter shade, an AI agent’s own). Select a person to see their packages; the time strip shades each week’s commits with AI.',
  focusKinds: ['dir', 'repo', 'person'],
  needsCommits: false,
  build: (input, viewport) => {
    const { report, focus = null } = input;
    const person =
      focus && entityKind(focus) === 'person' && input.commits ? focus : null;
    const key = person ? entityKey(person) : '';
    return aiPackagesScene(
      {
        packages: person
          ? aiPackagesFrom(report, input.commits!, (c) => c.author === key)
          : aiPackagesOf(report),
        rows: AI_PACKAGE_ROWS,
        person: person ? (input.index?.get(person)?.label ?? key) : null,
        tools: aiToolsLine(report),
        focus: person ? null : focus,
      },
      viewport,
    );
  },
};

export const adoptionLanesLayout: Layout = {
  id: 'lanes',
  label: 'Adoption lanes',
  caption:
    'One row per person, their commits week by week, the part with AI in it in the accent from the baseline up: who started using AI, and when. Everyone with an AI commit is drawn, then the busiest of the rest.',
  focusKinds: ['person'],
  needsCommits: true,
  build: (input, viewport) =>
    adoptionLanesScene(
      adoptionLanesOf(input.report, input.commits ?? []),
      viewport,
      { focus: input.focus },
    ),
};

/** The first month with an AI commit, as "Jun 2026"; null with none. */
function firstAiMonth(report: GitrelicReport): string | null {
  const m = report.coAuthors.byMonth.find(
    (e) => e.aiAssisted + (e.aiAuthored ?? 0) > 0,
  );
  if (!m) return null;
  const [y, mo] = m.month.split('-').map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
}

export function aiCoauthorsFindings(input: ViewInput): Finding[] {
  const { report } = input;
  const c = report.coAuthors;
  const findings: Finding[] = [];
  const counted = c.humanAuthoredCommits + c.aiAuthoredCommits;
  const ai = c.aiAssistedCommits + c.aiAuthoredCommits;

  if (counted === 0) return findings;
  if (ai === 0) {
    findings.push({
      id: 'adoption',
      tone: 'neutral',
      segments: [
        `No commit had AI in it: no Co-authored-by trailer names an AI tool, and no AI agent committed (${n(counted)} commits).`,
      ],
    });
  } else {
    const since = firstAiMonth(report);
    findings.push({
      id: 'adoption',
      tone: 'neutral',
      segments: [
        `${pct(ai, counted)} of commits had AI in them (${n(ai)} of ${n(counted)})` +
          (since ? `, the first in ${since}` : '') +
          `: ${aiToolsLine(report)}.`,
      ],
    });
  }

  const users = c.aiAuthors.slice(0, 3);
  if (users.length > 0) {
    const segments: Finding['segments'] = ['Most AI commits: '];
    users.forEach((u, i) => {
      if (i > 0) segments.push('; ');
      segments.push({ ref: personIdOf(report, u.author), text: u.displayName });
      segments.push(` ${n(u.aiCommits)} of ${n(u.totalCommits)}`);
    });
    const more = c.aiAuthors.length - users.length;
    segments.push(more > 0 ? `; ${n(more)} more people used AI.` : '.');
    findings.push({ id: 'people', tone: 'neutral', segments });
  }

  if (c.aiAuthoredCommits > 0) {
    const agents = c.aiAgents
      .map((a) => `${a.product} ${n(a.commits)}`)
      .join(', ');
    findings.push({
      id: 'agents',
      tone: 'notable',
      segments: [
        `AI agents authored ${n(c.aiAuthoredCommits)} commit${c.aiAuthoredCommits === 1 ? '' : 's'} themselves (${agents}), counted apart from AI-assisted ones.`,
      ],
    });
  }

  if (ai > 0) {
    const most = aiPackagesOf(report)
      .rows.filter((r) => r.commits >= AI_SHARE_MIN_COMMITS)
      .map((r) => ({ r, share: (r.assisted + r.authored) / r.commits }))
      .sort((a, b) => b.share - a.share || b.r.commits - a.r.commits)[0];
    if (most && most.share > 0) {
      const withAiCount = most.r.assisted + most.r.authored;
      findings.push({
        id: 'where',
        tone: 'neutral',
        segments: [
          { ref: most.r.id, text: most.r.name },
          ` has the most AI: ${n(withAiCount)} of ${n(most.r.commits)} commits (${pct(withAiCount, most.r.commits)}).`,
        ],
      });
    }
  }

  const split = report.fixRate.ai;
  const others = {
    changes: report.fixRate.changes - split.changes,
    fixed: report.fixRate.fixedAfter - split.fixedAfter,
  };
  const days = report.fixRate.windowDays || 30;
  const rates = `${n(split.fixedAfter)} of ${n(split.changes)} changes (${pct1(split.fixedAfter, split.changes)}) against ${n(others.fixed)} of ${n(others.changes)} (${pct1(others.fixed, others.changes)}) for the rest`;
  if (split.versusOthers === 'above') {
    findings.push({
      id: 'fixes',
      tone: 'warning',
      segments: [
        `Changes in AI commits were fixed within ${days} days more often than chance explains: ${rates}. AI commits are often the newest code, which changes more anyway: a reason to look, not a verdict.`,
      ],
    });
  } else if (split.versusOthers === 'below') {
    findings.push({
      id: 'fixes',
      tone: 'notable',
      segments: [
        `Changes in AI commits were fixed within ${days} days less often than the rest, beyond chance: ${rates}.`,
      ],
    });
  } else if (split.versusOthers === 'within') {
    findings.push({
      id: 'fixes',
      tone: 'neutral',
      segments: [
        `Changes in AI commits are fixed within ${days} days about as often as the rest: ${rates}, within chance.`,
      ],
    });
  } else if (split.changes > 0) {
    findings.push({
      id: 'fixes',
      tone: 'neutral',
      segments: [
        `${n(split.changes)} rated change${split.changes === 1 ? '' : 's'} in AI commits: too few to compare their fixes with the rest.`,
      ],
    });
  }

  if (c.humanPairs.length > 0) {
    const once = c.humanPairs.filter((p) => p.coAuthoredCommits === 1).length;
    findings.push({
      id: 'pairs',
      tone: 'neutral',
      segments: [
        `${n(c.humanPairs.length)} pairs of people are credited together` +
          (once > c.humanPairs.length / 2
            ? `, ${n(once)} of them once: mostly GitHub squash-merging a PR with several authors, not pairing.`
            : '.'),
      ],
    });
  }
  return findings;
}

export const AI_TIER_NAMES = [
  'No AI',
  'Under 20%',
  '20–49%',
  '50% or more',
] as const;

export function aiTier(withAiCount: number, commits: number): 0 | 1 | 2 | 3 {
  if (withAiCount === 0 || commits === 0) return 0;
  const share = withAiCount / commits;
  return share >= 0.5 ? 3 : share >= 0.2 ? 2 : 1;
}

/** Every package, with its commits and how many had AI in them. */
export function aiCoauthorsTable(input: ViewInput): LensTable {
  return {
    columns: [
      { id: 'package', label: 'Package' },
      { id: 'commits', label: 'Commits', numeric: true },
      { id: 'ai', label: 'With AI', numeric: true },
      { id: 'share', label: 'With AI %', numeric: true },
      { id: 'assisted', label: 'AI-assisted', numeric: true },
      { id: 'authored', label: 'Agent-authored', numeric: true },
    ],
    rows: aiPackagesOf(input.report).rows.map((r) => {
      const withAiCount = r.assisted + r.authored;
      return {
        id: aiPackageId(r.package),
        tier: aiTier(withAiCount, r.commits),
        search: (r.package || '(root)').toLowerCase(),
        cells: {
          package: r.package || '(root)',
          commits: r.commits,
          ai: withAiCount,
          share: Math.round((withAiCount / r.commits) * 100),
          assisted: r.assisted,
          authored: r.authored,
        },
      };
    }),
    tierNames: AI_TIER_NAMES,
    sort: { column: 'commits', descending: true },
  };
}

export const aiCoauthorsView: AnalyzerView = {
  id: 'co-authors',
  layouts: [whereAiLayout, adoptionLanesLayout],
  findings: aiCoauthorsFindings,
  table: aiCoauthorsTable,
  strip: { split: withAi, label: 'with AI' },
};
