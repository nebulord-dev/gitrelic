// Code Health › Hotspots: the churn × size field, with By package as its one
// alternate form (docs/atlas-views.md › Hotspots).

import { fileFacets, type FileFacet } from '../hotspots/facets';
import {
  HOTSPOT_TIER_NAMES,
  hotspotPoints,
  LARGE_FILE,
  SMALL_FILE,
  hotspotScale,
  type HotspotPoint,
} from '../hotspots/points';
import { ids } from '../ids';
import { fieldScene } from '../layouts/field';
import { packagesScene } from '../layouts/packages';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';
import type { GitrelicReport } from '@gitrelic/core';

export { LARGE_FILE, SMALL_FILE } from '../hotspots/points';
/** A package needs this many warm files, and this share of its files, to be named. */
export const CONCENTRATION_MIN = 3;
export const CONCENTRATION_SHARE = 0.2;

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const n = (v: number) => v.toLocaleString('en-US');

// One report, one set of points: both layouts and the findings ask for them.
const pointsCache = new WeakMap<GitrelicReport, readonly HotspotPoint[]>();
/** `hotspotPoints`, computed once per report: layouts, findings and the inspector share it. */
export function pointsOf(report: GitrelicReport): readonly HotspotPoint[] {
  let points = pointsCache.get(report);
  if (!points) {
    points = hotspotPoints(report);
    pointsCache.set(report, points);
  }
  return points;
}

/** The focused file's facets, when it is a scored file. */
function facetsOf(input: ViewInput): FileFacet[] | undefined {
  const file = input.focus?.startsWith('file:') ? input.focus.slice(5) : null;
  const point = file
    ? pointsOf(input.report).find((p) => p.file === file)
    : undefined;
  return point ? fileFacets(point, input.report) : undefined;
}

export const fieldLayout: Layout = {
  id: 'field',
  label: 'Field',
  focusKinds: ['file'],
  caption:
    'Each dot is a file: commits across, lines up. Score rises to the top right; the curves mark 25, 50 and 75.',
  needsCommits: false,
  build: (input, viewport) =>
    fieldScene(
      {
        points: pointsOf(input.report),
        scale: hotspotScale(input.report),
        focus: input.focus,
        facets: facetsOf(input),
      },
      viewport,
    ),
};

export const packagesLayout: Layout = {
  id: 'packages',
  label: 'By package',
  caption:
    'Each circle is a package, sized by its files; each dot is a file, hottest at the centre.',
  needsCommits: false,
  focusKinds: ['dir'],
  build: (input, viewport) =>
    packagesScene(pointsOf(input.report), viewport, input.focus),
};

export function hotspotFindings(input: ViewInput): Finding[] {
  const points = pointsOf(input.report);
  const findings: Finding[] = [];
  const top = points[0];
  if (!top || top.tier === 0) return findings;

  findings.push({
    id: 'hottest',
    tone: 'notable',
    segments: [
      { ref: ids.file(top.file), text: baseName(top.file) },
      ` is the hottest file: ${n(top.commits)} commits across ${n(top.lines)} lines.`,
    ],
  });

  // Two kinds of heat among the warm files: big ones that keep changing,
  // and small ones hot on churn alone (on React, the feature-flag forks).
  const warm = points.filter((p) => p.tier >= 1);
  const large = warm.filter((p) => p.lines >= LARGE_FILE);
  const small = warm.filter((p) => p.lines < SMALL_FILE);
  if (large.length > 0 && small.length > 0) {
    const s = small[0];
    findings.push({
      id: 'two-kinds',
      tone: 'neutral',
      segments: [
        `Two kinds of heat: ${n(large.length)} large file${large.length === 1 ? ' that keeps' : 's that keep'} changing, and ${n(small.length)} under ${SMALL_FILE} lines hot on churn alone, like `,
        { ref: ids.file(s.file), text: baseName(s.file) },
        ` (${n(s.commits)} commits, ${n(s.lines)} lines).`,
      ],
    });
  }

  // Where heat concentrates: the package with the largest share of its own
  // files at 25+, set against the biggest package when that one runs cool.
  const byPkg = new Map<string, { files: number; warm: number }>();
  for (const p of points) {
    const pkg = p.package;
    const entry = byPkg.get(pkg) ?? { files: 0, warm: 0 };
    entry.files++;
    if (p.tier >= 1) entry.warm++;
    byPkg.set(pkg, entry);
  }
  const named = [...byPkg].filter(([pkg]) => pkg !== '');
  const [dense] = named
    .filter(([, e]) => e.warm >= CONCENTRATION_MIN)
    .sort(
      ([a, x], [b, y]) =>
        y.warm / y.files - x.warm / x.files || (a < b ? -1 : 1),
    );
  if (dense && dense[1].warm / dense[1].files >= CONCENTRATION_SHARE) {
    const [pkg, e] = dense;
    const segments: Finding['segments'] = [
      { ref: ids.dir(pkg), text: `${pkg}/` },
      `: ${n(e.warm)} of its ${n(e.files)} files score 25 or more`,
    ];
    const [big] = [...named].sort(
      ([a, x], [b, y]) => y.files - x.files || (a < b ? -1 : 1),
    );
    if (
      big &&
      big[0] !== pkg &&
      big[1].warm / big[1].files < e.warm / e.files / 4
    ) {
      segments.push(
        '; ',
        { ref: ids.dir(big[0]), text: `${big[0]}/` },
        ` has ${n(big[1].warm)} of ${n(big[1].files)}.`,
      );
    } else segments.push('.');
    findings.push({ id: 'concentration', tone: 'warning', segments });
  }
  return findings;
}

/** Every scored file, hottest first. */
export function hotspotTable(input: ViewInput): LensTable {
  return {
    columns: [
      { id: 'file', label: 'File' },
      { id: 'score', label: 'Score', numeric: true },
      { id: 'commits', label: 'Commits', numeric: true },
      { id: 'lines', label: 'Lines', numeric: true },
      { id: 'package', label: 'Package' },
    ],
    rows: pointsOf(input.report).map((p) => ({
      id: ids.file(p.file),
      tier: p.tier,
      search: p.file.toLowerCase(),
      cells: {
        file: p.file,
        score: p.score,
        commits: p.commits,
        lines: p.lines,
        package: p.package || '(root)',
      },
    })),
    tierNames: HOTSPOT_TIER_NAMES,
    sort: { column: 'score', descending: true },
  };
}

export const hotspotsView: AnalyzerView = {
  id: 'hotspots',
  layouts: [fieldLayout, packagesLayout],
  findings: hotspotFindings,
  table: hotspotTable,
};
