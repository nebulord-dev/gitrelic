// Ownership & Risk › Coupling (docs/atlas-views.md › Coupling): which
// packages change together, a selected file's ripple, and blast radius in the
// inspector. Blast Radius merged in; families are a finding.

import {
  BLAST_WIDE,
  blastSummaryOf,
  boundariesOf,
  onRing,
} from '../coupling/boundaries';
import { ids } from '../ids';
import { boundariesScene, shortPackage } from '../layouts/boundaries';
import { packagesOf } from '../report/packages';
import type {
  AnalyzerView,
  Finding,
  Layout,
  LensTable,
  ViewInput,
} from '../model';

const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  `${n(v)} ${word}${v === 1 ? '' : 's'}`;
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export const boundariesLayout: Layout = {
  id: 'boundaries',
  label: 'Boundaries',
  caption:
    'Packages around the ring, sized by commits; a chord is the commits that changed both, brighter the bigger their share of the smaller package’s. Select a package to light its chords, or a file to see what changes with it.',
  focusKinds: ['dir', 'file'],
  needsCommits: false,
  build: boundariesScene,
};

export function couplingFindings(input: ViewInput): Finding[] {
  const { report } = input;
  const ring = boundariesOf(report);
  const findings: Finding[] = [];

  const [top] = ring.links;
  if (top) {
    const commitsOf = new Map(ring.packages.map((p) => [p.dir, p.commits]));
    const smaller =
      (commitsOf.get(top.a) ?? 0) <= (commitsOf.get(top.b) ?? 0)
        ? top.a
        : top.b;
    const segments: Finding['segments'] = [
      { ref: ids.dir(top.a), text: shortPackage(top.a) },
      ' and ',
      { ref: ids.dir(top.b), text: shortPackage(top.b) },
      ` changed together in ${plural(top.commits, 'commit')} (${Math.round(100 * top.share)}% of ${shortPackage(smaller)}’s)`,
    ];
    const [pair] = top.filePairs;
    if (pair)
      segments.push(
        ', most often ',
        { ref: ids.file(pair.fileA), text: baseName(pair.fileA) },
        ' with ',
        { ref: ids.file(pair.fileB), text: baseName(pair.fileB) },
        ` (${n(pair.coCommits)})`,
      );
    segments.push('.');
    findings.push({ id: 'strongest', tone: 'notable', segments });
  }

  // The largest family spread across packages: one change, made in several.
  const family = report.coupling.families.find(
    (f) => f.packages.length > 1 && f.packages.every(onRing),
  );
  if (family) {
    const shown = family.files.slice(0, 2);
    const segments: Finding['segments'] = [
      `${n(family.files.length)} files in ${n(family.packages.length)} packages always change together (`,
    ];
    shown.forEach((f, i) => {
      if (i > 0) segments.push(', ');
      segments.push({ ref: ids.file(f), text: baseName(f) });
    });
    const rest = family.files.length - shown.length;
    if (rest > 0) segments.push(` and ${n(rest)} more`);
    segments.push(
      `): one change, made in ${n(family.packages.length)} places.`,
    );
    findings.push({ id: 'family', tone: 'warning', segments });
  }

  const blast = blastSummaryOf(report);
  const [widest] = blast.widest;
  if (!widest)
    findings.push({
      id: 'blast',
      tone: 'neutral',
      segments: [
        `No file has the ${n(blast.minCommits)} commits a blast radius needs.`,
      ],
    });
  else
    findings.push({
      id: 'blast',
      tone: 'neutral',
      segments: [
        `${blast.wide === 0 ? 'None' : n(blast.wide)} of ${plural(blast.rated, 'file')} usually ${blast.wide === 1 ? 'changes' : 'change'} with ${n(BLAST_WIDE)} or more others, the widest `,
        { ref: ids.file(widest.file), text: baseName(widest.file) },
        ` (${n(widest.median)} per change)`,
        blast.unrated > 0
          ? `; ${n(blast.unrated)} more ${blast.unrated === 1 ? 'has' : 'have'} under ${n(blast.minCommits)} commits to say.`
          : '.',
      ],
    });

  if (ring.leftOut > 0)
    findings.push({
      id: 'left-out',
      tone: 'neutral',
      segments: [
        `${plural(ring.leftOut, 'link')} to root-level files or dot-folders (release bumps, CI config) ${ring.leftOut === 1 ? 'is' : 'are'} left off the ring.`,
      ],
    });
  return findings;
}

/** A median's tier: under 3, 3–5, 6–9, 10 or more other files per change. */
const tierOf = (median: number): 0 | 1 | 2 | 3 =>
  median >= BLAST_WIDE ? 3 : median >= 6 ? 2 : median >= 3 ? 1 : 0;

/** Every file with a blast radius, widest first. */
export function couplingTable(input: ViewInput): LensTable {
  const { report } = input;
  const pkgOf = packagesOf(report);
  const partnerOf = new Map(
    report.coupling.fileProfiles.map((f) => [f.file, f.topPartner]),
  );
  return {
    columns: [
      { id: 'file', label: 'File' },
      { id: 'median', label: 'Files per change', numeric: true },
      { id: 'commits', label: 'Commits', numeric: true },
      { id: 'partner', label: 'Changes most with' },
      { id: 'package', label: 'Package' },
    ],
    rows: report.blastRadius.files
      .filter((f) => f.medianCoChanged !== undefined)
      .map((f) => {
        const partner = partnerOf.get(f.file);
        return {
          id: ids.file(f.file),
          tier: tierOf(f.medianCoChanged ?? 0),
          search: f.file.toLowerCase(),
          cells: {
            file: f.file,
            median: f.medianCoChanged ?? 0,
            commits: f.totalCommits,
            partner: partner ? baseName(partner) : '',
            package: pkgOf(f.file) || '(root)',
          },
        };
      })
      .sort(
        (a, b) =>
          Number(b.cells.median) - Number(a.cells.median) ||
          Number(b.cells.commits) - Number(a.cells.commits),
      ),
    tierNames: ['Under 3', '3–5', '6–9', '10 or more'],
    sort: { column: 'median', descending: true },
  };
}

export const couplingView: AnalyzerView = {
  id: 'coupling',
  layouts: [boundariesLayout],
  findings: couplingFindings,
  table: couplingTable,
};
