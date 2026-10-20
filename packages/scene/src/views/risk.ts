// Code Health › Risk: score stacks (docs/atlas-views.md › Risk). Root causes,
// its alternate form, lands in its own PR.

import { ids } from '../ids';
import { stacksScene } from '../layouts/stacks';
import {
  REASON_KINDS,
  REASON_NAMES,
  reasonList,
  riskStacksOf,
  RISK_TIER_NAMES,
  sharedReasons,
  type StackRow,
} from '../risk/stacks';
import type {
  AnalyzerView,
  Finding,
  FindingSegment,
  Layout,
  LensTable,
  ViewInput,
} from '../model';
import type { CurseReasonKind } from '@gitrelic/core';

const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const plural = (k: number, one: string) =>
  `${n(k)} ${one}${k === 1 ? '' : 's'}`;

export const stacksLayout: Layout = {
  id: 'stacks',
  label: 'Score stacks',
  caption:
    'Each bar is a file’s risk score split by reason; files past the line are cursed. Near misses sit under it, on thinner bars. On the right: signals the score doesn’t count.',
  needsCommits: false,
  build: (input, viewport) => stacksScene(riskStacksOf(input.report), viewport),
};

/** Up to `max` file chips, joined into a sentence's list. */
function fileChips(rows: readonly StackRow[], max = 2): FindingSegment[] {
  const shown = rows.slice(0, max);
  const out: FindingSegment[] = [];
  shown.forEach((r, i) => {
    if (i > 0)
      out.push(shown.length === 2 && rows.length === 2 ? ' and ' : ', ');
    out.push({ ref: ids.file(r.file), text: baseName(r.file) });
  });
  const rest = rows.length - shown.length;
  if (rest > 0) out.push(` and ${n(rest)} more`);
  return out;
}

const kindsOf = (r: StackRow): CurseReasonKind[] =>
  REASON_KINDS.filter((k) => r.breakdown.some((b) => b.kind === k));

export function riskFindings(input: ViewInput): Finding[] {
  const { rows, threshold } = riskStacksOf(input.report);
  const cursed = rows.filter((r) => r.cursed);
  const near = rows.filter((r) => !r.cursed);
  const findings: Finding[] = [];

  // The reason the whole cursed set shares: one fix often covers them all.
  const shared = sharedReasons(cursed.filter((r) => r.breakdown.length > 0));
  if (cursed.length > 1 && shared.length > 0) {
    findings.push({
      id: 'shared',
      tone: 'warning',
      segments: [
        `All ${n(cursed.length)} cursed files score on ${reasonList(shared)}.`,
      ],
    });
  } else if (cursed.length > 0) {
    findings.push({
      id: 'shared',
      tone: 'warning',
      segments: [
        `${plural(cursed.length, 'cursed file')}; the worst is `,
        { ref: ids.file(cursed[0].file), text: baseName(cursed[0].file) },
        ` at ${n(cursed[0].score)}.`,
      ],
    });
  }

  // Near misses, and what they'd need.
  if (near.length > 0) {
    const closest = near[0];
    const why = kindsOf(closest);
    findings.push({
      id: 'near',
      tone: 'notable',
      segments: [
        `${plural(near.length, 'file')} just miss the line at ${n(threshold)}: `,
        ...fileChips(near),
        `. The closest scores on ${why.length > 0 ? reasonList(why) : 'reasons this report doesn’t split'}, ${plural(closest.short, 'point')} short.`,
      ],
    });
  }

  // Top hotspots under the line: size isn't in the score, so the stacks
  // alone would undersell them.
  const hot = near
    .filter((r) => r.hotspot !== null)
    .sort((a, b) => (b.hotspot ?? 0) - (a.hotspot ?? 0));
  if (hot.length > 0) {
    findings.push({
      id: 'hotspots',
      tone: 'notable',
      segments: [
        ...fileChips(hot),
        hot.length === 1
          ? ` is a top hotspot (${n(hot[0].hotspot ?? 0)}) just under the line: its size isn’t in this score.`
          : ` are top hotspots just under the line: their size isn’t in this score.`,
      ],
    });
  }
  return findings;
}

/** Cursed files and near misses, with each reason's points. */
export function riskTable(input: ViewInput): LensTable {
  const points = (r: StackRow, ...kinds: CurseReasonKind[]) =>
    r.breakdown
      .filter((b) => kinds.includes(b.kind))
      .reduce((s, b) => s + b.points, 0);
  return {
    columns: [
      { id: 'file', label: 'File' },
      { id: 'score', label: 'Score', numeric: true },
      { id: 'churn', label: REASON_NAMES.churn, numeric: true },
      { id: 'owners', label: 'Ownership / authors', numeric: true },
      { id: 'abandoned', label: REASON_NAMES.abandoned, numeric: true },
      { id: 'fixes', label: 'Fixes', numeric: true },
      { id: 'parallel', label: 'Parallel', numeric: true },
      { id: 'hotspot', label: 'Hotspot', numeric: true },
      { id: 'status', label: 'Status' },
    ],
    rows: riskStacksOf(input.report).rows.map((r) => ({
      id: ids.file(r.file),
      tier: r.tier,
      search: r.file.toLowerCase(),
      cells: {
        file: r.file,
        score: r.score,
        churn: points(r, 'churn'),
        owners: points(r, 'ownership', 'authors'),
        abandoned: points(r, 'abandoned'),
        fixes: points(r, 'fixes'),
        parallel: points(r, 'parallel'),
        hotspot: r.hotspot ?? '',
        status: r.cursed ? 'cursed' : `near miss (${r.short} short)`,
      },
    })),
    tierNames: RISK_TIER_NAMES,
    sort: { column: 'score', descending: true },
  };
}

export const riskView: AnalyzerView = {
  id: 'cursed-files',
  layouts: [stacksLayout],
  findings: riskFindings,
  table: riskTable,
};
