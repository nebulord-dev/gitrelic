// Age as strata (docs/atlas-views.md › Age): every source file with its real
// last change, in calendar bands, grouped by package — what both forms, the
// findings, the table and the lens card read.
//
// Fixtures and generated files are always left out (counted in the summary);
// tests only when the stage's Tests switch is on. Core decides what is
// orphaned and which packages are dormant; this only groups and sums.

import { packagesOf } from '../report/packages';
import type { DormantPackage, FileAge, GitrelicReport } from '@gitrelic/core';

/**
 * A file unchanged this long is cold. Mirrors core's `COLD_DAYS`
 * (analyzers/age-map.ts), which the browser can't import; keep them equal.
 */
export const COLD_DAYS = 365;

/** The calendar bands: each edge (in days) starts the next, older band. */
export const AGE_BAND_EDGES = [90, 365, 730, 1460] as const;
export const AGE_BAND_NAMES = [
  'Under 3 months',
  '3–12 months',
  '1–2 years',
  '2–4 years',
  '4+ years',
] as const;
export type AgeBand = 0 | 1 | 2 | 3 | 4;
/** Bands 2–4 are cold. */
export const FIRST_COLD_BAND = 2;

export function bandOf(days: number): AgeBand {
  let band = 0;
  for (const edge of AGE_BAND_EDGES) if (days >= edge) band++;
  return band as AgeBand;
}

export interface AgeFile {
  file: string;
  ageInDays: number;
  band: AgeBand;
  lines: number;
  test: boolean;
  orphaned: boolean;
  orphanedAuthors: string[];
  wokeAfterDays?: number;
}

export interface AgeRow {
  /** `packageOf` the files; '' for the repository root. */
  dir: string;
  /** Oldest first. */
  files: AgeFile[];
  /** Lines in each band, under 3 months first. */
  lines: [number, number, number, number, number];
  /** Lines changed within a year. */
  warm: number;
  /** Lines unchanged for a year or more. */
  cold: number;
  /** Lines in orphaned files. */
  orphaned: number;
  orphanedFiles: number;
  coldFiles: number;
  /** Days since its newest source (non-test) change; Infinity with none. */
  newestSource: number;
  /** Core named it dormant: no source change in a year. */
  dormant: boolean;
}

export interface AgeSummary {
  /** Source lines in all, and the cold ones. */
  lines: number;
  coldLines: number;
  coldFiles: number;
  /** Lines in the median cold file: React's cold code is mostly thin. */
  medianColdLines: number;
  /** The oldest source file, when there is one. */
  oldest?: AgeFile;
  dormant: DormantPackage[];
  orphanedFiles: number;
  orphanedLines: number;
  /** [package, orphaned lines], most first. */
  orphanedByPackage: [string, number][];
  /** Source files woken this year, the longest gap first. */
  woken: AgeFile[];
  /** Fixture and generated files, left out. */
  leftOut: number;
  source: 'history' | 'window';
}

function ageFile(
  f: FileAge,
  lines: ReadonlyMap<string, number>,
  test: boolean,
): AgeFile {
  return {
    file: f.file,
    ageInDays: f.ageInDays,
    band: bandOf(f.ageInDays),
    lines: lines.get(f.file) ?? 0,
    test,
    orphaned: f.orphaned === true,
    orphanedAuthors: f.orphanedAuthors ?? [],
    ...(f.wokeAfterDays !== undefined
      ? { wokeAfterDays: f.wokeAfterDays }
      : {}),
  };
}

/** Source files (and tests, when asked) by package, most cold lines first. */
export function ageStrata(
  report: GitrelicReport,
  { tests }: { tests: boolean },
): AgeRow[] {
  const lines = new Map(report.loc.files.map((f) => [f.file, f.lines]));
  const pkgOf = packagesOf(report);
  const dormant = new Set(report.ageMap.dormantPackages.map((d) => d.package));
  const rows = new Map<string, AgeRow>();
  for (const f of report.ageMap.files) {
    const cls = report.fileClasses[f.file];
    if (cls === 'fixture' || cls === 'generated') continue;
    if (cls === 'test' && !tests) continue;
    const file = ageFile(f, lines, cls === 'test');
    const dir = pkgOf(f.file);
    let row = rows.get(dir);
    if (!row) {
      row = {
        dir,
        files: [],
        lines: [0, 0, 0, 0, 0],
        warm: 0,
        cold: 0,
        orphaned: 0,
        orphanedFiles: 0,
        coldFiles: 0,
        newestSource: Infinity,
        dormant: dormant.has(dir),
      };
      rows.set(dir, row);
    }
    row.files.push(file);
    row.lines[file.band] += file.lines;
    if (file.band >= FIRST_COLD_BAND) {
      row.cold += file.lines;
      row.coldFiles++;
    } else row.warm += file.lines;
    if (file.orphaned) {
      row.orphaned += file.lines;
      row.orphanedFiles++;
    }
    if (!file.test) row.newestSource = Math.min(row.newestSource, f.ageInDays);
  }
  for (const row of rows.values())
    row.files.sort(
      (a, b) => b.ageInDays - a.ageInDays || (a.file < b.file ? -1 : 1),
    );
  return [...rows.values()].sort(
    (a, b) =>
      b.cold - a.cold ||
      b.warm + b.cold - (a.warm + a.cold) ||
      (a.dir < b.dir ? -1 : 1),
  );
}

const cache = new WeakMap<GitrelicReport, [AgeRow[]?, AgeRow[]?]>();
/** `ageStrata`, computed once per report and Tests switch. */
export function ageStrataOf(
  report: GitrelicReport,
  tests: boolean,
): readonly AgeRow[] {
  let entry = cache.get(report);
  if (!entry) cache.set(report, (entry = []));
  const slot = tests ? 1 : 0;
  return (entry[slot] ??= ageStrata(report, { tests }));
}

const summaries = new WeakMap<GitrelicReport, AgeSummary>();
/** The lens card's numbers, over source files only. */
export function ageSummaryOf(report: GitrelicReport): AgeSummary {
  const hit = summaries.get(report);
  if (hit) return hit;
  const rows = ageStrataOf(report, false);
  const files = rows.flatMap((r) => r.files);
  const cold = files.filter((f) => f.band >= FIRST_COLD_BAND);
  const coldLines = cold.map((f) => f.lines).sort((a, b) => a - b);
  const orphaned = files.filter((f) => f.orphaned);
  const summary: AgeSummary = {
    lines: rows.reduce((t, r) => t + r.warm + r.cold, 0),
    coldLines: rows.reduce((t, r) => t + r.cold, 0),
    coldFiles: cold.length,
    medianColdLines: coldLines[Math.floor(coldLines.length / 2)] ?? 0,
    oldest: files.reduce<AgeFile | undefined>(
      (a, f) => (!a || f.ageInDays > a.ageInDays ? f : a),
      undefined,
    ),
    dormant: report.ageMap.dormantPackages,
    orphanedFiles: orphaned.length,
    orphanedLines: orphaned.reduce((t, f) => t + f.lines, 0),
    orphanedByPackage: rows
      .filter((r) => r.orphaned > 0)
      .map((r): [string, number] => [r.dir, r.orphaned])
      .sort((a, b) => b[1] - a[1]),
    woken: files
      .filter((f) => f.wokeAfterDays !== undefined)
      .sort((a, b) => (b.wokeAfterDays ?? 0) - (a.wokeAfterDays ?? 0)),
    leftOut: report.ageMap.files.filter((f) => {
      const cls = report.fileClasses[f.file];
      return cls === 'fixture' || cls === 'generated';
    }).length,
    source: report.ageMap.source,
  };
  summaries.set(report, summary);
  return summary;
}

const n = (v: number) => v.toLocaleString('en-US');

/** "12 days", "8 months", "3.4 years": how long ago, as people say it. */
export function sinceText(days: number): string {
  if (days < 60) return `${n(days)} day${days === 1 ? '' : 's'}`;
  if (days < 730) return `${Math.round(days / 30.44)} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}

/** A package's name as both forms show it. */
export const ageRowName = (dir: string) => (dir === '' ? '(root)' : `${dir}/`);

/** A file dot's tooltip: path, last change, lines, and why it stands out. */
export function ageFileTip(f: AgeFile): string[] {
  const tip = [
    f.file,
    `last changed ${sinceText(f.ageInDays)} ago · ${n(f.lines)} line${f.lines === 1 ? '' : 's'}${f.test ? ' · test' : ''}`,
  ];
  if (f.orphaned)
    tip.push(
      `orphaned: ${f.orphanedAuthors.join(', ') || 'its authors'}, none active in a year`,
    );
  if (f.wokeAfterDays !== undefined)
    tip.push(`changed this year after ${sinceText(f.wokeAfterDays)} untouched`);
  return tip;
}

/** A package row's tooltip: warm and cold lines, orphans, newest change. */
export function ageRowTip(row: AgeRow): string[] {
  const tip = [
    ageRowName(row.dir),
    `${n(row.cold)} cold lines in ${n(row.coldFiles)} file${row.coldFiles === 1 ? '' : 's'} · ${n(row.warm)} changed within a year`,
  ];
  if (row.orphaned > 0)
    tip.push(
      `${n(row.orphaned)} lines orphaned in ${n(row.orphanedFiles)} file${row.orphanedFiles === 1 ? '' : 's'}`,
    );
  if (Number.isFinite(row.newestSource))
    tip.push(
      `${row.dormant ? 'dormant: ' : ''}newest source change ${sinceText(row.newestSource)} ago`,
    );
  return tip;
}
