// The inspector's person card: one contributor's numbers, aliases folded in
// by identity merging, and their off-hours share. Rows carry semantic tiers,
// not colours, like fileFacts.

import { formatRelative } from '../format/relativeTime';
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

/**
 * "Now" for a report's relative dates: its last commit, not the wall clock,
 * since a saved report can be months old. Older reports backfill
 * `meta.lastCommit` as '', so fall back to the newest contributor commit;
 * NaN when there's nothing to go on, and the ages read "—".
 */
export function reportNow(report: GitrelicReport): number {
  const last = Date.parse(report.meta.lastCommit);
  if (Number.isFinite(last)) return last;
  let newest = Number.NaN;
  for (const c of report.contributors.contributors) {
    const t = Date.parse(c.lastCommit);
    if (Number.isFinite(t) && !(t <= newest)) newest = t;
  }
  return newest;
}

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
