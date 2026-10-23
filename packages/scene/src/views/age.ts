// Code Health › Age: every file's real last change (docs/atlas-views.md ›
// Age). Strata is the primary form, Warm and cold its alternate; Stale Files
// merged in, and the table sorted oldest first is its list, with dates.

import {
  AGE_BAND_NAMES,
  ageRowName,
  ageStrataOf,
  ageSummaryOf,
  sinceText,
  type AgeBand,
} from '../age/strata';
import { ids, REPO_ID, type EntityId } from '../ids';
import { strataScene } from '../layouts/strata';
import { warmColdScene } from '../layouts/warmCold';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';

export { AGE_TESTS_PANEL, BAND_PAINT, STRATA_ROWS } from '../layouts/strata';

const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const rowId = (dir: string): EntityId => (dir === '' ? REPO_ID : ids.dir(dir));
const plural = (k: number, one: string) =>
  `${n(k)} ${one}${k === 1 ? '' : 's'}`;

export const strataLayout: Layout = {
  id: 'strata',
  label: 'Strata',
  caption:
    'Each row is a package, each dot one of its files, placed by time since its last change (square root) and sized by lines. Past a year is cold; ringed files have nobody left who changed them.',
  needsCommits: false,
  build: strataScene,
};

export const warmColdLayout: Layout = {
  id: 'warm-cold',
  label: 'Warm and cold',
  caption:
    'Each package’s lines: changed within a year to the left of the axis, cold to the right by age, the oldest outermost. The accent at the end is lines nobody left changed.',
  needsCommits: false,
  build: warmColdScene,
};

export function ageFindings(input: ViewInput): Finding[] {
  const s = ageSummaryOf(input.report);
  const findings: Finding[] = [];

  if (s.source === 'window')
    findings.push({
      id: 'window',
      tone: 'warning',
      segments: [
        'Ages cover the analysis window only: the history before it couldn’t be read, so files untouched in the window are missing.',
      ],
    });

  if (s.coldFiles > 0)
    findings.push({
      id: 'cold',
      tone: 'neutral',
      segments: [
        `${plural(s.coldFiles, 'file')} (${n(s.coldLines)} lines) unchanged for a year or more; the median one has ${plural(s.medianColdLines, 'line')}.`,
      ],
    });
  else if (s.oldest)
    findings.push({
      id: 'cold',
      tone: 'neutral',
      segments: [
        'Nothing is a year old: the oldest file, ',
        { ref: ids.file(s.oldest.file), text: baseName(s.oldest.file) },
        `, last changed ${sinceText(s.oldest.ageInDays)} ago.`,
      ],
    });

  for (const d of s.dormant)
    findings.push({
      id: s.dormant.length === 1 ? 'dormant' : `dormant:${d.package}`,
      tone: 'warning',
      segments: [
        { ref: rowId(d.package), text: ageRowName(d.package) },
        ` has had no source change in ${sinceText(d.newestAgeDays)} (${plural(d.sourceFiles, 'file')}): archive it, delete it, or say why it stays.`,
      ],
    });

  if (s.orphanedFiles > 0) {
    const [first, second] = s.orphanedByPackage;
    const segments: Finding['segments'] = [
      `${plural(s.orphanedFiles, 'cold file')} (${n(s.orphanedLines)} lines) ${s.orphanedFiles === 1 ? 'has' : 'have'} nobody left who changed ${s.orphanedFiles === 1 ? 'it' : 'them'}, most in `,
      { ref: rowId(first[0]), text: ageRowName(first[0]) },
    ];
    if (second)
      segments.push(' and ', {
        ref: rowId(second[0]),
        text: ageRowName(second[0]),
      });
    segments.push('.');
    findings.push({ id: 'orphaned', tone: 'warning', segments });
  }

  const [longest] = s.woken;
  if (longest)
    findings.push({
      id: 'woken',
      tone: 'neutral',
      segments: [
        `${plural(s.woken.length, 'file')} changed this year after a year or more untouched, the longest `,
        { ref: ids.file(longest.file), text: baseName(longest.file) },
        ` after ${sinceText(longest.wokeAfterDays ?? 0)}: check that whoever changed it knew it.`,
      ],
    });

  if (s.leftOut > 0)
    findings.push({
      id: 'left-out',
      tone: 'neutral',
      segments: [
        `${n(s.leftOut)} fixture or generated file${s.leftOut === 1 ? '' : 's'} left out.`,
      ],
    });
  return findings;
}

/** The table's four tiers: the two warm bands share one. */
const TIER: Record<AgeBand, 0 | 1 | 2 | 3> = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 3 };

/** Every source and test file, oldest first: Stale Files' list, with dates. */
export function ageTable(input: ViewInput): LensTable {
  return {
    columns: [
      { id: 'file', label: 'File' },
      { id: 'age', label: 'Days since change', numeric: true },
      { id: 'band', label: 'Last changed' },
      { id: 'lines', label: 'Lines', numeric: true },
      { id: 'orphaned', label: 'Orphaned by' },
      { id: 'kind', label: 'Kind' },
      { id: 'package', label: 'Package' },
    ],
    rows: ageStrataOf(input.report, true).flatMap((row) =>
      row.files.map((f) => ({
        id: ids.file(f.file),
        tier: TIER[f.band],
        search: f.file.toLowerCase(),
        cells: {
          file: f.file,
          age: f.ageInDays,
          band: AGE_BAND_NAMES[f.band],
          lines: f.lines,
          orphaned: f.orphanedAuthors.join(', '),
          kind: f.test ? 'test' : 'source',
          package: row.dir || '(root)',
        },
      })),
    ),
    tierNames: ['Under a year', '1–2 years', '2–4 years', '4+ years'],
    sort: { column: 'age', descending: true },
  };
}

export const ageView: AnalyzerView = {
  id: 'age-map',
  layouts: [strataLayout, warmColdLayout],
  findings: ageFindings,
  table: ageTable,
};
