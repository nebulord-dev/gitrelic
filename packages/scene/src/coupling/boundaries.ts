// Coupling's data (docs/atlas-views.md › Coupling): the packages on the
// Boundaries ring and the links between them, a file's ripple, and the blast
// radius summary the inspector shows — all from core's coupling and blast
// radius reports.
//
// The ring leaves out the repository root and top-level dot-folders
// (.github, .vscode): release commits bump CHANGELOG.md beside a package's
// package.json, and CI config changes with everything, so on gitrelic,
// Angular and vue-core the strongest "coupling" was the root and a package.
// The report keeps those links; only the ring and its findings skip them.

import { ids, type EntityId } from '../ids';
import { packagesOf } from '../report/packages';
import type { CoupledPair, GitrelicReport } from '@gitrelic/core';

/** Most packages on the ring; the busiest, by commits. */
export const RING_PACKAGES = 20;
/** A file whose commits usually change this many other files or more is wide. */
export const BLAST_WIDE = 10;
/** A ripple names at most this many partners. */
export const RIPPLE_PARTNERS = 16;

/** Whether a package is drawn: not the root, not a dot-folder. */
export const onRing = (dir: string) => dir !== '' && !dir.startsWith('.');

export interface RingPackage {
  dir: string;
  id: EntityId;
  commits: number;
  /** Links drawn to it. */
  links: number;
}

export interface RingLink {
  a: string;
  b: string;
  commits: number;
  /** `commits` as a share of the smaller package's commits, 0–1. */
  share: number;
  filePairs: CoupledPair[];
}

export interface Boundaries {
  packages: RingPackage[];
  links: RingLink[];
  /** Package links left off because they touch the root or a dot-folder. */
  leftOut: number;
  /** Packages past `RING_PACKAGES`. */
  hidden: number;
  /**
   * The report has no package data at all: made before the Coupling lens
   * (backfilled empty), so rerunning gitrelic fills it.
   */
  noData: boolean;
}

function boundaries(report: GitrelicReport): Boundaries {
  const all = report.coupling.packageCommits.filter((p) => onRing(p.package));
  const drawn = all.slice(0, RING_PACKAGES);
  const onStage = new Set(drawn.map((p) => p.package));
  const links: RingLink[] = report.coupling.packages
    .filter((l) => onStage.has(l.packageA) && onStage.has(l.packageB))
    .map((l) => ({
      a: l.packageA,
      b: l.packageB,
      commits: l.commits,
      share: l.share,
      filePairs: l.filePairs,
    }));
  const degree = new Map<string, number>();
  for (const l of links)
    for (const p of [l.a, l.b]) degree.set(p, (degree.get(p) ?? 0) + 1);
  return {
    packages: drawn.map((p) => ({
      dir: p.package,
      id: ids.dir(p.package),
      commits: p.commits,
      links: degree.get(p.package) ?? 0,
    })),
    links,
    leftOut: report.coupling.packages.filter(
      (l) => !onRing(l.packageA) || !onRing(l.packageB),
    ).length,
    hidden: all.length - drawn.length,
    noData: report.coupling.packageCommits.length === 0,
  };
}

const ringCache = new WeakMap<GitrelicReport, Boundaries>();
/** `boundaries`, once per report. */
export function boundariesOf(report: GitrelicReport): Boundaries {
  let b = ringCache.get(report);
  if (!b) ringCache.set(report, (b = boundaries(report)));
  return b;
}

export interface RipplePartner {
  file: string;
  package: string;
  /** Commits the two shared. */
  shared: number;
  /** `shared` as a share of the selected file's commits, 0–1. */
  share: number;
  /** In another package than the selected file. */
  other: boolean;
}

export interface FileBlast {
  /** Median other files its commits changed. */
  median: number;
  /** Its commits by how many other files each changed (index 0–19). */
  footprint: number[];
  commits: number;
}

export interface Ripple {
  file: string;
  package: string;
  commits: number;
  /** Most shared commits first, up to `RIPPLE_PARTNERS`. */
  partners: RipplePartner[];
  /** When the file has the commits a blast radius needs. */
  blast?: FileBlast;
}

interface FileIndex {
  profiles: Map<string, GitrelicReport['coupling']['fileProfiles'][number]>;
  blast: Map<string, GitrelicReport['blastRadius']['files'][number]>;
  ripples: Map<string, Ripple | null>;
}
const fileCache = new WeakMap<GitrelicReport, FileIndex>();
function fileIndexOf(report: GitrelicReport): FileIndex {
  let idx = fileCache.get(report);
  if (!idx) {
    idx = {
      profiles: new Map(report.coupling.fileProfiles.map((f) => [f.file, f])),
      blast: new Map(report.blastRadius.files.map((f) => [f.file, f])),
      ripples: new Map(),
    };
    fileCache.set(report, idx);
  }
  return idx;
}

/**
 * The file a file changes with most (most shared commits): what the ripple
 * puts first and nearest, and the table names. Core's `topPartner` ranks by
 * strength, which a rare partner can top.
 */
export function mostSharedPartner(
  report: GitrelicReport,
  file: string,
): string | undefined {
  return rippleOf(report, file)?.partners[0]?.file;
}

/**
 * What changes with a file, and how far its changes usually reach. Built
 * once per report and file: a selection asks for it from several places.
 */
export function rippleOf(report: GitrelicReport, file: string): Ripple | null {
  const idx = fileIndexOf(report);
  if (idx.ripples.has(file)) return idx.ripples.get(file)!;
  const ripple = buildRipple(report, idx, file);
  idx.ripples.set(file, ripple);
  return ripple;
}

function buildRipple(
  report: GitrelicReport,
  idx: FileIndex,
  file: string,
): Ripple | null {
  const pkgOf = packagesOf(report);
  const profile = idx.profiles.get(file);
  const b = idx.blast.get(file);
  if (!profile && !b) return null;
  const pairs = profile?.partners ?? [];
  const commits =
    pairs[0] !== undefined
      ? pairs[0].fileA === file
        ? pairs[0].totalCommitsA
        : pairs[0].totalCommitsB
      : (b?.totalCommits ?? 0);
  const home = pkgOf(file);
  const partners = pairs
    .map((p): RipplePartner => {
      const other = p.fileA === file ? p.fileB : p.fileA;
      const pkg = pkgOf(other);
      return {
        file: other,
        package: pkg,
        shared: p.coCommits,
        share: commits > 0 ? p.coCommits / commits : 0,
        other: pkg !== home,
      };
    })
    .sort((x, y) => y.shared - x.shared || (x.file < y.file ? -1 : 1))
    .slice(0, RIPPLE_PARTNERS);
  return {
    file,
    package: home,
    commits,
    partners,
    ...(b?.medianCoChanged !== undefined && b.footprint
      ? {
          blast: {
            median: b.medianCoChanged,
            footprint: b.footprint,
            commits: b.totalCommits,
          },
        }
      : {}),
  };
}

export interface BlastSummary {
  /** Files with a median (`minCommits`+ commits). */
  rated: number;
  /** Rated files whose median is `BLAST_WIDE` or more. */
  wide: number;
  /** Files without one. */
  unrated: number;
  minCommits: number;
  /**
   * Rated files by median, index 0–19: a commit changes at most 20 files
   * (core skips sweeping ones), so a median is at most 19.
   */
  bins: number[];
  /** The widest five: median, then commits. */
  widest: { file: string; median: number; commits: number }[];
}

const blastCache = new WeakMap<GitrelicReport, BlastSummary>();
/** The inspector's blast radius, over the whole repo, once per report. */
export function blastSummaryOf(report: GitrelicReport): BlastSummary {
  const hit = blastCache.get(report);
  if (hit) return hit;
  const rated = report.blastRadius.files
    .filter((f) => f.medianCoChanged !== undefined)
    .map((f) => ({
      file: f.file,
      median: f.medianCoChanged ?? 0,
      commits: f.totalCommits,
    }))
    .sort((a, b) => b.median - a.median || b.commits - a.commits);
  const bins = new Array<number>(20).fill(0);
  for (const f of rated) bins[Math.min(19, f.median)]++;
  const summary: BlastSummary = {
    rated: rated.length,
    wide: rated.filter((f) => f.median >= BLAST_WIDE).length,
    unrated: report.blastRadius.files.length - rated.length,
    minCommits: report.blastRadius.minCommits,
    bins,
    widest: rated.slice(0, 5),
  };
  blastCache.set(report, summary);
  return summary;
}
