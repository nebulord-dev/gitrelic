import { classifyAuthor } from '../utils/authorClassification.js';
import { packageOf } from './commit-timing.js';
import { MAX_FIX_FILES } from './fix-rate.js';
import type {
  AgeMapReport,
  AgeStatus,
  DormantPackage,
  FileAge,
  GitrelicReport,
} from '../types.js';
import type { FileTouch, RawCommit } from '../utils/git.js';

/** A file unchanged this long is cold; a person without a commit this long is inactive. */
export const COLD_DAYS = 365;
/** A dormant package has at least this many source files, so a stray folder doesn't badge. */
export const DORMANT_MIN_SOURCE_FILES = 5;
const ORPHAN_AUTHORS_SHOWN = 3;
const DAY_MS = 86_400_000;

/**
 * Computes repo-age-relative thresholds used to bucket files into the
 * `fresh / aging / stale / ancient` tiers. Pure helper used inside
 * `analyzeAgeMap` and exposed for analyzer-internal callers. The web
 * layer (`packages/scene/src/report/normalizeReport.ts`) duplicates this formula
 * inline because the project rule is type-only imports from @gitrelic/core
 * — keep the two in sync if the multipliers ever change.
 */
export function getAgeThresholds(
  repoAgeDays: number,
): AgeMapReport['thresholds'] {
  return {
    freshLimit: Math.round(repoAgeDays * 0.08),
    agingLimit: Math.round(repoAgeDays * 0.33),
    staleLimit: Math.round(repoAgeDays * 0.66),
  };
}

export interface AgeMapOptions {
  /**
   * The history before the window (`getFileTouches`). Undefined when the
   * window is all of history; null when it couldn't be read, so ages cover
   * the window only.
   */
  older?: FileTouch[] | null;
  /**
   * Lowercased email to one identity across the window and the older
   * history (`canonicalEmailMap`). The window's own merge can't see an alias
   * used only before it, which would make someone still active look gone.
   */
  canonical?: Map<string, string>;
  /** The report's non-source files: tests don't keep a package awake. */
  fileClasses?: GitrelicReport['fileClasses'];
}

interface Change {
  at: number;
  date: string;
}

/**
 * Ages every tracked file by its last change, from the window's commits and
 * the older history, and finds orphaned files, woken files and dormant
 * packages.
 * @param commits - The analysis window's commits.
 * @param trackedFiles - The files in the analyzed commit.
 * @param repoAgeDays - The window's length: classic's tiers (`status`) are
 *   shares of it.
 * @param asOf - The analyzed commit's time (ms): ages count back from it,
 *   never from today.
 * @param options - The history before the window, and the report's file
 *   classes.
 */
export function analyzeAgeMap(
  commits: RawCommit[],
  trackedFiles: string[],
  repoAgeDays: number,
  asOf: number,
  options: AgeMapOptions = {},
): AgeMapReport {
  const trackedSet = new Set(trackedFiles);
  const touches: FileTouch[] = [...commits];
  const inWindow = new Set(commits.map((c) => c.hash));
  // --since and --until overlap at the window's edge: keep each commit once.
  for (const t of options.older ?? [])
    if (!inWindow.has(t.hash)) touches.push(t);

  const changes = new Map<string, Change[]>();
  // Per file, its human authors' change counts. Sweeping commits are left
  // out, as in fix rate: a mass rename doesn't make you someone who knows
  // the file.
  const authors = new Map<string, Map<string, number>>();
  const names = new Map<string, string>();
  const lastActive = new Map<string, number>();
  for (const t of touches) {
    const person =
      options.canonical?.get(t.authorEmail.toLowerCase()) ?? t.authorEmail;
    // Compare instants: ISO strings with different UTC offsets don't sort
    // chronologically as text.
    const at = Date.parse(t.date);
    // A person goes by the name on their latest commit.
    if (at > (lastActive.get(person) ?? -Infinity)) {
      lastActive.set(person, at);
      names.set(person, t.authorName);
    }
    const authored =
      t.files.length <= MAX_FIX_FILES &&
      classifyAuthor(t.authorEmail) === 'human';
    for (const file of t.files) {
      if (!trackedSet.has(file)) continue;
      let list = changes.get(file);
      if (!list) changes.set(file, (list = []));
      list.push({ at, date: t.date });
      if (!authored) continue;
      let who = authors.get(file);
      if (!who) authors.set(file, (who = new Map()));
      who.set(person, (who.get(person) ?? 0) + 1);
    }
  }

  const thresholds = getAgeThresholds(repoAgeDays);
  const activeSince = asOf - COLD_DAYS * DAY_MS;
  const files: FileAge[] = [];
  for (const [file, list] of changes) {
    list.sort((a, b) => b.at - a.at);
    const ageInDays = Math.floor((asOf - list[0].at) / DAY_MS);
    const entry: FileAge = {
      file,
      lastCommitDate: list[0].date,
      ageInDays,
      status: getAgeStatus(ageInDays, thresholds),
    };
    if (ageInDays >= COLD_DAYS) {
      const who = authors.get(file);
      if (
        who &&
        [...who.keys()].every(
          (email) => (lastActive.get(email) ?? -Infinity) <= activeSince,
        )
      ) {
        entry.orphaned = true;
        entry.orphanedAuthors = [...who]
          .sort((a, b) => b[1] - a[1])
          .slice(0, ORPHAN_AUTHORS_SHOWN)
          .map(([email]) => names.get(email) ?? email);
      }
    } else {
      const gap = wokeAfter(list, activeSince);
      if (gap !== undefined) entry.wokeAfterDays = gap;
    }
    files.push(entry);
  }
  files.sort((a, b) => b.ageInDays - a.ageInDays);

  const staleFiles = files.filter((f) => f.status === 'stale');
  const ancientFiles = files.filter((f) => f.status === 'ancient');

  const ages = files.map((f) => f.ageInDays).sort((a, b) => a - b);
  const medianAgeDays = ages[Math.floor(ages.length / 2)] ?? 0;

  const summary =
    ancientFiles.length > 0
      ? `${ancientFiles.length} files haven't been touched in over ${thresholds.staleLimit} days — they may be dead weight or critical infrastructure nobody dares touch`
      : staleFiles.length > 0
        ? `${staleFiles.length} files are going stale (no commits in ${thresholds.agingLimit}+ days)`
        : 'The codebase is actively maintained across most files';

  return {
    files,
    staleFiles,
    ancientFiles,
    medianAgeDays,
    thresholds,
    source: options.older === null ? 'window' : 'history',
    dormantPackages: dormantPackages(files, options.fileClasses ?? {}),
    summary,
  };
}

/**
 * The first gap of `COLD_DAYS` or more before one of the file's changes since
 * `activeSince`, newest first, in days. `list` is sorted newest first.
 */
function wokeAfter(list: Change[], activeSince: number): number | undefined {
  for (let i = 0; i + 1 < list.length && list[i].at > activeSince; i++) {
    const gap = list[i].at - list[i + 1].at;
    if (gap >= COLD_DAYS * DAY_MS) return Math.floor(gap / DAY_MS);
  }
  return undefined;
}

function dormantPackages(
  files: FileAge[],
  fileClasses: GitrelicReport['fileClasses'],
): DormantPackage[] {
  const byPackage = new Map<string, { sourceFiles: number; newest: number }>();
  for (const f of files) {
    if (fileClasses[f.file]) continue; // tests, fixtures, generated
    const pkg = packageOf(f.file);
    if (pkg === '') continue; // the root is the repo, never a package to archive
    const acc = byPackage.get(pkg) ?? { sourceFiles: 0, newest: Infinity };
    acc.sourceFiles++;
    acc.newest = Math.min(acc.newest, f.ageInDays);
    byPackage.set(pkg, acc);
  }
  return [...byPackage]
    .filter(
      ([, p]) =>
        p.sourceFiles >= DORMANT_MIN_SOURCE_FILES && p.newest >= COLD_DAYS,
    )
    .map(([pkg, p]) => ({
      package: pkg,
      sourceFiles: p.sourceFiles,
      newestAgeDays: p.newest,
    }))
    .sort((a, b) => b.newestAgeDays - a.newestAgeDays);
}

function getAgeStatus(
  ageInDays: number,
  thresholds: AgeMapReport['thresholds'],
): AgeStatus {
  if (ageInDays <= thresholds.freshLimit) return 'fresh';
  if (ageInDays <= thresholds.agingLimit) return 'aging';
  if (ageInDays <= thresholds.staleLimit) return 'stale';
  return 'ancient';
}
