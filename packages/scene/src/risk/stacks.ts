// Risk as score stacks (docs/atlas-views.md › Risk): every cursed file and
// every near miss, its score split by reason as cursed files reports it —
// what the stacks, the findings, the table and the inspector all read.
//
// The split is core's (`CursedFile.breakdown`), never recomputed here, so the
// picture can't drift from the score. It sums to the uncapped score: a file
// hitting every check reaches 115 while its curseScore stops at 100. Reports
// made before the split have an empty breakdown; their bar is one unknown
// segment of the score.
//
// Two signals the score doesn't count are carried beside it: a hotspot score
// of HOTSPOT_MARK or more (size is Hotspots' axis, so it stays out of the
// score) and accelerating churn (noise as a bonus; see Churn).

import type {
  CurseReasonKind,
  CurseReasonPoints,
  CursedFile,
  GitrelicReport,
} from '@gitrelic/core';

/** A hotspot score at least this high is marked beside the bar. */
export const HOTSPOT_MARK = 50;
/** Cursed files at or above this score are the table's top tier. */
export const RISK_HIGH = 60;

/** Every reason, in the order core scores them (and the stacks draw them). */
export const REASON_KINDS = [
  'churn',
  'ownership',
  'authors',
  'abandoned',
  'fixes',
  'parallel',
] as const satisfies readonly CurseReasonKind[];

export const REASON_NAMES: Record<CurseReasonKind, string> = {
  churn: 'Churn',
  ownership: 'Ownership',
  authors: 'Many authors',
  abandoned: 'Abandoned',
  fixes: 'Fix commits',
  parallel: 'Parallel edits',
};

export const RISK_TIER_NAMES = [
  'Under 40',
  'Near miss',
  'Cursed',
  `Cursed ${RISK_HIGH}+`,
] as const;

export type RiskTier = 0 | 1 | 2 | 3;

export interface StackRow {
  file: string;
  /** Core's curseScore: the breakdown's sum, capped at 100. */
  score: number;
  /** The breakdown's sum, uncapped (the score, when there's no breakdown). */
  sum: number;
  /** Empty for reports made before the split. */
  breakdown: readonly CurseReasonPoints[];
  cursed: boolean;
  /** Points under the line; 0 for a cursed file. */
  short: number;
  /** Hotspot score, when it's HOTSPOT_MARK or more. */
  hotspot: number | null;
  accelerating: boolean;
  churn: number;
  authors: number;
  tier: RiskTier;
}

export interface RiskStacks {
  /** Cursed files first (highest score first), then the near misses. */
  rows: StackRow[];
  /** The score a file needs to be cursed. */
  threshold: number;
}

export function riskTier(row: Pick<StackRow, 'cursed' | 'score'>): RiskTier {
  if (!row.cursed) return 1;
  return row.score >= RISK_HIGH ? 3 : 2;
}

export function riskStacks(report: GitrelicReport): RiskStacks {
  const { files, nearMisses, threshold } = report.cursedFiles;
  const hotspot = new Map(
    report.hotspots.files.map((h) => [h.file, h.hotspotScore]),
  );
  const accelerating = new Set(
    report.churnVelocity.files
      .filter((v) => v.trend === 'accelerating')
      .map((v) => v.file),
  );
  const row = (f: CursedFile, cursed: boolean): StackRow => {
    const breakdown = f.breakdown ?? [];
    const sum =
      breakdown.length > 0
        ? breakdown.reduce((s, r) => s + r.points, 0)
        : f.curseScore;
    const h = hotspot.get(f.file);
    const out = {
      file: f.file,
      score: f.curseScore,
      sum,
      breakdown,
      cursed,
      short: cursed ? 0 : Math.max(0, threshold - f.curseScore),
      hotspot: h !== undefined && h >= HOTSPOT_MARK ? h : null,
      accelerating: accelerating.has(f.file),
      churn: f.churn,
      authors: f.authors,
    };
    return { ...out, tier: riskTier(out) };
  };
  return {
    rows: [
      ...files.map((f) => row(f, true)),
      ...nearMisses.map((f) => row(f, false)),
    ],
    threshold,
  };
}

const cache = new WeakMap<GitrelicReport, RiskStacks>();
/** `riskStacks`, computed once per report: the layout, findings, table and inspector share it. */
export function riskStacksOf(report: GitrelicReport): RiskStacks {
  let stacks = cache.get(report);
  if (!stacks) {
    stacks = riskStacks(report);
    cache.set(report, stacks);
  }
  return stacks;
}

/** The reasons every one of `rows` has, in scoring order. */
export function sharedReasons(rows: readonly StackRow[]): CurseReasonKind[] {
  if (rows.length === 0) return [];
  return REASON_KINDS.filter((k) =>
    rows.every((r) => r.breakdown.some((b) => b.kind === k)),
  );
}

/** "churn and many authors", "churn, ownership and fix commits". */
export function reasonList(kinds: readonly CurseReasonKind[]): string {
  const names = kinds.map((k) => REASON_NAMES[k].toLowerCase());
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Signals the score doesn't count, as the stacks write them beside the bar. */
export function signalText(row: StackRow): string {
  const out: string[] = [];
  if (row.hotspot !== null) out.push(`hotspot ${row.hotspot}`);
  if (row.accelerating) out.push('accelerating');
  return out.join(' · ');
}

/** A row's tooltip: the file, its score, each reason with its points. */
export function stackRowTip(row: StackRow, name: string): string[] {
  const tip = [
    name,
    row.cursed
      ? `Score ${row.score} · cursed`
      : `Score ${row.score} · ${row.short} short of the line`,
  ];
  if (row.breakdown.length === 0)
    tip.push('The split by reason isn’t in this report');
  for (const r of row.breakdown)
    tip.push(`${REASON_NAMES[r.kind]} · ${r.points} pts`);
  if (row.sum > row.score) tip.push(`${row.sum} before the cap at 100`);
  const signals = signalText(row);
  if (signals) tip.push(`Not in the score: ${signals}`);
  return tip;
}

/** A segment's tooltip: the reason, its points and what was measured. */
export function segmentTip(r: CurseReasonPoints): string[] {
  return [`${REASON_NAMES[r.kind]} · ${r.points} pts`, r.label];
}
