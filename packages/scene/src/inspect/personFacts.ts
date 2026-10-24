// The inspector's person card: one contributor's numbers, aliases folded in
// by identity merging, and their off-hours share. Rows carry semantic tiers,
// not colours, like fileFacts.

import { formatRelative } from '../format/relativeTime';
import { ownershipMapOf, strandedBy } from '../ownership/map';
import { reportNow } from '../report/now';
import type { FactTier, FileFact } from './fileFacts';
import type { GitrelicReport } from '@gitrelic/core';

export interface PersonFacts {
  name: string;
  email: string;
  status: 'active' | 'ghost' | 'quiet';
  /** Other emails merged into this person, most commits first. */
  aliases: string[];
  focusAreas: string[];
  rows: FileFact[];
}

const DAY = 86_400_000;
const fmt = (n: number) => n.toLocaleString();

/** Off-hours share at or above which the stress row is flagged. */
export const STRESS_WARNING = 40;

// Re-exported: lanes, the Contributors view and older callers import it here.
export { reportNow } from '../report/now';

export function personFacts(
  email: string,
  report: GitrelicReport,
  now: number = reportNow(report),
): PersonFacts | null {
  const c = report.contributors.contributors.find((x) => x.email === email);
  if (!c) return null;
  const daysAgo = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && Number.isFinite(now)
      ? Math.max(0, Math.round((now - t) / DAY))
      : null;
  };

  const rows: FileFact[] = [
    { label: 'Commits', value: fmt(c.commitCount) },
    { label: 'Files owned', value: fmt(c.filesOwned) },
    { label: 'Lines changed', value: fmt(c.linesChanged) },
    { label: 'Active days', value: fmt(c.activeDays) },
    { label: 'First commit', value: formatRelative(daysAgo(c.firstCommit)) },
    {
      label: 'Last commit',
      value: formatRelative(daysAgo(c.lastCommit)),
      tier: c.isGhost ? 'critical' : undefined,
    },
  ];
  // Ownership: what they top, and what nobody else would know if they left.
  const own = ownershipMapOf(report);
  if (own.packages.length > 0) {
    const tops = own.packages.filter((p) => p.shares[0].email === email).length;
    const stranded = strandedBy(own, email).length;
    rows.push(
      { label: 'Tops packages', value: fmt(tops), lens: 'bus-factor' },
      {
        label: 'If they left',
        value:
          stranded === 0
            ? 'every package has someone else'
            : `${fmt(stranded)} package${stranded === 1 ? '' : 's'} with nobody else`,
        tier: stranded > 0 ? 'warning' : undefined,
        lens: 'bus-factor',
      },
    );
  }
  const stress = report.commitTiming.authorStress.find(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  );
  if (stress && stress.activeWeeks > 0) {
    // How regularly, not what share of commits: one crunch weekend can be
    // half someone's commits without being a pattern.
    rows.push({
      label: 'Off-hours',
      value:
        `weekends in ${fmt(stress.weekendWeeks)} of ${fmt(stress.activeWeeks)} weeks · ` +
        `${fmt(stress.lateNights)} late night${stress.lateNights === 1 ? '' : 's'}`,
      tier:
        stress.regularWeekends || stress.regularLateNights
          ? 'warning'
          : undefined,
    });
  } else if (stress) {
    // Reports from before regularity: the shares, as before.
    const tier: FactTier | undefined =
      stress.stressScore >= STRESS_WARNING ? 'warning' : undefined;
    rows.push({
      label: 'Off-hours commits',
      value: `${stress.lateNightPercent}% late · ${stress.weekendPercent}% weekend`,
      tier,
    });
  }

  // AI, and who they're credited with most (the co-author graph's place,
  // since the lens dropped it: docs/atlas-views.md › AI & Co-authors).
  const lower = email.toLowerCase();
  const mix = report.coAuthors.perAuthorMix.find((m) => m.author === lower);
  if (mix && mix.aiCommits > 0)
    rows.push({
      label: 'With AI',
      value: `${fmt(mix.aiCommits)} of ${fmt(mix.totalCommits)} commits AI-assisted`,
    });
  let partner: { email: string; commits: number } | null = null;
  for (const p of report.coAuthors.humanPairs) {
    const other =
      p.authorA === lower ? p.authorB : p.authorB === lower ? p.authorA : null;
    if (other && (!partner || p.coAuthoredCommits > partner.commits))
      partner = { email: other, commits: p.coAuthoredCommits };
  }
  if (partner) {
    const who = report.contributors.contributors.find(
      (x) => x.email.toLowerCase() === partner.email,
    );
    rows.push({
      label: 'Co-authored with',
      value: `${who?.name ?? partner.email} · ${fmt(partner.commits)} commit${partner.commits === 1 ? '' : 's'}`,
    });
  }

  const merged = report.identities?.find((i) => i.canonicalEmail === email);
  return {
    name: c.name,
    email: c.email,
    status: c.isGhost ? 'ghost' : c.isActive ? 'active' : 'quiet',
    aliases: (merged?.aliases ?? [])
      .map((a) => a.email)
      .filter((e) => e !== email),
    focusAreas: c.focusAreas,
    rows,
  };
}
