// Code Health › Fix rate: the funnel field (docs/atlas-views.md › Fix rate).
// A selected file opens its fix chain beside the field; no alternate form.

import {
  FIX_TIER_NAMES,
  fixRateOf,
  ratePct,
  type FixPoint,
} from '../fixRate/points';
import { ids } from '../ids';
import { funnelScene } from '../layouts/funnel';
import type {
  AnalyzerView,
  Finding,
  FindingSegment,
  Layout,
  LensTable,
  ViewInput,
} from '../model';

const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
/** Files a finding names before "and N more". */
const NAMED = 3;

export const funnelLayout: Layout = {
  id: 'funnel',
  label: 'Funnel',
  focusKinds: ['file'],
  caption:
    'Each dot is a file with enough changes to rate: changes across, the share a fix repaired within 30 days up. The band is what chance gives at the repo’s rate; dots above it break more than chance explains. Select one for its fixes over time.',
  // The selected file's lane draws its commits.
  needsCommits: true,
  build: (input, viewport) =>
    funnelScene(
      {
        data: fixRateOf(input.report),
        focus: input.focus,
        commits: input.commits,
      },
      viewport,
    ),
};

export function fixRateFindings(input: ViewInput): Finding[] {
  const data = fixRateOf(input.report);
  if (!data.available)
    return [
      {
        id: 'unavailable',
        tone: 'neutral',
        segments: ['This report predates fix rate; re-run gitrelic.'],
      },
    ];
  if (data.repoRate === null) return [];
  const repo = `Repo-wide, ${ratePct(data.repoRate)} of changes needed a fix within ${n(data.windowDays)} days.`;
  const above = data.points.filter((p) => p.aboveChance);
  if (above.length === 0)
    return [
      {
        id: 'above',
        tone: 'neutral',
        segments: [`No file is fixed more often than chance. ${repo}`],
      },
    ];
  const segments: FindingSegment[] = [
    above.length === 1
      ? 'One file is fixed more often than chance: '
      : `${n(above.length)} files are fixed more often than chance: `,
  ];
  const shown = above.slice(0, NAMED);
  shown.forEach((p: FixPoint, i) => {
    if (i > 0)
      segments.push(
        i === shown.length - 1 && above.length === shown.length
          ? ' and '
          : ', ',
      );
    segments.push(
      { ref: ids.file(p.file), text: baseName(p.file) },
      ` (${n(p.fixedAfter)} of ${n(p.changes)})`,
    );
  });
  const rest = above.length - shown.length;
  if (rest > 0) segments.push(` and ${n(rest)} more`);
  segments.push(`. ${repo}`);
  return [{ id: 'above', tone: 'warning', segments }];
}

/** Every rated file: above chance first, then by rate. */
export function fixRateTable(input: ViewInput): LensTable {
  return {
    columns: [
      { id: 'file', label: 'File' },
      { id: 'changes', label: 'Changes', numeric: true },
      { id: 'fixed', label: 'Fixed after', numeric: true },
      { id: 'rate', label: 'Rate %', numeric: true },
      { id: 'chance', label: 'Above chance' },
      { id: 'latest', label: 'Latest fix' },
    ],
    rows: fixRateOf(input.report).points.map((p) => ({
      id: ids.file(p.file),
      tier: p.tier,
      search: p.file.toLowerCase(),
      cells: {
        file: p.file,
        changes: p.changes,
        fixed: p.fixedAfter,
        rate: Math.round(p.rate * 1000) / 10,
        chance: p.aboveChance ? 'yes' : '',
        latest: p.fixes[0]?.message ?? '',
      },
    })),
    tierNames: FIX_TIER_NAMES,
    sort: { column: 'rate', descending: true },
  };
}

export const fixRateView: AnalyzerView = {
  id: 'fix-rate',
  layouts: [funnelLayout],
  findings: fixRateFindings,
  table: fixRateTable,
};
