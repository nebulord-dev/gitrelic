import { classifyAuthor } from '../utils/authorClassification.js';
import { packageResolver } from '../utils/workspace.js';
import { binomialUpperTail, CHANCE_TAIL, MAX_FIX_FILES } from './fix-rate.js';
import type {
  AuthorStressProfile,
  CommitTimingMonthlyBucket,
  CommitTimingOffHours,
  CommitTimingReport,
  FileTimingProfile,
  PackageOffHours,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';

/** A package needs this many commits to be tested against chance. */
export const MIN_PACKAGE_COMMITS = 10;

/**
 * The package a file belongs to. The runner passes the workspace's
 * (`packageResolver` over `report.workspace.roots`); without one, packages
 * are by convention (`packages/<name>`, `apps/<name>`…).
 */
export const packageOf = packageResolver([]);
export type PackageOf = (path: string) => string;

/** The most off-hours commits chance explains out of `n` at `rate`. */
export function chanceAllows(n: number, rate: number): number {
  let k = 0;
  while (k < n && binomialUpperTail(n, k + 1, rate) >= CHANCE_TAIL) k++;
  return k;
}

/**
 * Off-hours (late night or weekend) by package, against the repo's own
 * rate: which code changes off-hours more than chance explains. Classic's
 * per-file stress score rated files from three commits, so its leaders were
 * one 2am commit in a three-commit test file; a package-level count with
 * Fix rate's chance test asks the same question with enough commits to
 * answer it.
 *
 * Sweeping commits (Fix rate's size) and bot commits are left out of both
 * the rate and the counts: a 300-file Flow bump at 1am isn't three hundred
 * files changing at night, and a bot's schedule isn't anyone's evening. A
 * commit counts once in each package it touches.
 */
export function offHoursByPackage(
  commits: RawCommit[],
  trackedSet: ReadonlySet<string>,
  pkgOf: PackageOf = packageOf,
): CommitTimingOffHours {
  let total = 0;
  let off = 0;
  const byPackage = new Map<string, { commits: number; offHours: number }>();
  for (const c of commits) {
    // Nor is an AI agent's: Claude's GitHub app committing at 3am is no one
    // working late.
    if (classifyAuthor(c.authorEmail) !== 'human') continue;
    if (c.files.length > MAX_FIX_FILES) continue;
    const { hour, day } = parseLocalTime(c.date);
    const isOff = isLateNight(hour) || isWeekend(day);
    total++;
    if (isOff) off++;
    const packages = new Set(
      c.files.filter((f) => trackedSet.has(f)).map(pkgOf),
    );
    for (const p of packages) {
      const acc = byPackage.get(p) ?? { commits: 0, offHours: 0 };
      acc.commits++;
      if (isOff) acc.offHours++;
      byPackage.set(p, acc);
    }
  }
  const rate = total === 0 ? 0 : off / total;
  const packages: PackageOffHours[] = [...byPackage]
    .filter(([, v]) => v.commits >= MIN_PACKAGE_COMMITS)
    .map(([pkg, v]) => {
      const allowed = chanceAllows(v.commits, rate);
      return {
        package: pkg,
        commits: v.commits,
        offHours: v.offHours,
        percent: Math.round((v.offHours / v.commits) * 100),
        allowed,
        aboveChance:
          v.offHours > 0 &&
          binomialUpperTail(v.commits, v.offHours, rate) < CHANCE_TAIL,
      };
    })
    .sort(
      (a, b) =>
        Number(b.aboveChance) - Number(a.aboveChance) ||
        b.offHours / b.commits - a.offHours / a.commits ||
        b.commits - a.commits ||
        a.package.localeCompare(b.package),
    );
  return {
    commits: total,
    offHours: off,
    rate,
    minCommits: MIN_PACKAGE_COMMITS,
    packages,
  };
}

/**
 * Parses an ISO date string and returns the hour (0-23), day-of-week (0-6, Sun=0),
 * and ISO month (YYYY-MM) using the timezone offset embedded in the string
 * (the author's local time).
 */
function parseLocalTime(isoDate: string): {
  hour: number;
  day: number;
  isoMonth: string;
  /** Days since 1970-01-01 in local time, for week and night keys. */
  localDay: number;
} {
  const match = isoDate.match(/([+-])(\d{2}):(\d{2})$/);
  const date = new Date(isoDate);

  if (!match) {
    // Z or no offset — use UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return {
      hour: date.getUTCHours(),
      day: date.getUTCDay(),
      isoMonth: `${year}-${month}`,
      localDay: Math.floor(date.getTime() / 86_400_000),
    };
  }

  const sign = match[1] === '+' ? 1 : -1;
  const offsetHours = parseInt(match[2], 10);
  const offsetMinutes = parseInt(match[3], 10);
  const totalOffsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60_000;

  // Get UTC time and apply offset to get local time
  const localMs = date.getTime() + totalOffsetMs;
  const local = new Date(localMs);

  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  return {
    hour: local.getUTCHours(),
    day: local.getUTCDay(),
    isoMonth: `${year}-${month}`,
    localDay: Math.floor(localMs / 86_400_000),
  };
}

/**
 * Someone works off-hours regularly when weekend (or late-night) commits
 * fall in at least this share of the weeks they committed at all…
 */
export const REGULAR_SHARE = 1 / 3;
/** …over at least this many active weeks: fewer is too short to call. */
export const REGULAR_MIN_WEEKS = 6;

function isLateNight(hour: number): boolean {
  return hour === 23 || hour <= 4; // 11pm to 4am (hours 23, 0, 1, 2, 3, 4)
}

function isWeekend(day: number): boolean {
  return day === 0 || day === 6; // Sunday or Saturday
}

const MIN_AUTHOR_COMMITS = 5;

export function analyzeCommitTiming(
  commits: RawCommit[],
  trackedFiles: string[],
  pkgOf: PackageOf = packageOf,
): CommitTimingReport {
  if (commits.length === 0) {
    return {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 0,
      repoWeekendPercent: 0,
      summary: '0% of commits happen after hours, 0% on weekends',
      repoHourDayMatrix: Array.from({ length: 7 }, () =>
        new Array<number>(24).fill(0),
      ),
      highStress: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      authorStress: [],
      offHours: {
        commits: 0,
        offHours: 0,
        rate: 0,
        minCommits: MIN_PACKAGE_COMMITS,
        packages: [],
      },
    };
  }

  const trackedSet = new Set(trackedFiles);

  // Per-file accumulators
  const fileData = new Map<
    string,
    {
      hours: number[];
      totalCommits: number;
      lateNight: number;
      weekend: number;
      dayCount: number[];
    }
  >();

  // Repo-wide accumulators
  let repoTotal = 0;
  let repoLateNight = 0;
  let repoWeekend = 0;
  const repoHourDayMatrix: number[][] = Array.from({ length: 7 }, () =>
    new Array<number>(24).fill(0),
  );

  // Per-author accumulators
  const authorData = new Map<
    string,
    {
      name: string;
      totalCommits: number;
      lateNightCommits: number;
      weekendCommits: number;
      // Monday-start local weeks, and local nights (an evening and the
      // early hours after it), as day numbers.
      weeks: Set<number>;
      weekendWeeks: Set<number>;
      lateNightWeeks: Set<number>;
      lateNights: Set<number>;
    }
  >();

  // Per-month accumulators
  const monthData = new Map<
    string,
    { weekendLateNight: number; singleCriterion: number; healthy: number }
  >();

  for (const commit of commits) {
    const { hour, day, isoMonth, localDay } = parseLocalTime(commit.date);
    const late = isLateNight(hour);
    const wknd = isWeekend(day);

    repoTotal++;
    if (late) repoLateNight++;
    if (wknd) repoWeekend++;
    repoHourDayMatrix[day][hour]++;

    // Per-author (commit-level, not file-level)
    const emailLower = commit.authorEmail.toLowerCase();
    if (!authorData.has(emailLower)) {
      authorData.set(emailLower, {
        name: commit.authorName,
        totalCommits: 0,
        lateNightCommits: 0,
        weekendCommits: 0,
        weeks: new Set(),
        weekendWeeks: new Set(),
        lateNightWeeks: new Set(),
        lateNights: new Set(),
      });
    }
    const aData = authorData.get(emailLower)!;
    aData.name = commit.authorName; // last-write-wins; names are usually stable per email
    aData.totalCommits++;
    if (late) aData.lateNightCommits++;
    if (wknd) aData.weekendCommits++;
    const week = localDay - ((day + 6) % 7);
    aData.weeks.add(week);
    if (wknd) aData.weekendWeeks.add(week);
    if (late) {
      aData.lateNightWeeks.add(week);
      // 1am belongs to the night that started the evening before.
      aData.lateNights.add(hour <= 4 ? localDay - 1 : localDay);
    }

    // Per-month (commit-level, disjoint XOR)
    if (!monthData.has(isoMonth)) {
      monthData.set(isoMonth, {
        weekendLateNight: 0,
        singleCriterion: 0,
        healthy: 0,
      });
    }
    const mData = monthData.get(isoMonth)!;
    if (late && wknd) mData.weekendLateNight++;
    else if (late || wknd) mData.singleCriterion++;
    else mData.healthy++;

    // Per-file
    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;

      if (!fileData.has(file)) {
        fileData.set(file, {
          hours: new Array(24).fill(0),
          totalCommits: 0,
          lateNight: 0,
          weekend: 0,
          dayCount: new Array(7).fill(0),
        });
      }
      const data = fileData.get(file)!;
      data.hours[hour]++;
      data.dayCount[day]++;
      data.totalCommits++;
      if (late) data.lateNight++;
      if (wknd) data.weekend++;
    }
  }

  // Build per-file profiles, excluding files with < 3 commits
  const files: FileTimingProfile[] = [];
  for (const [file, data] of fileData) {
    if (data.totalCommits < 3) continue;

    const lateNightPercent = Math.round(
      (data.lateNight / data.totalCommits) * 100,
    );
    const weekendPercent = Math.round((data.weekend / data.totalCommits) * 100);
    const peakHour = data.hours.indexOf(Math.max(...data.hours));
    const peakDay = data.dayCount.indexOf(Math.max(...data.dayCount));
    const stressScore = Math.min(
      100,
      Math.max(0, Math.round(lateNightPercent * 0.6 + weekendPercent * 0.4)),
    );

    files.push({
      file,
      totalCommits: data.totalCommits,
      lateNightPercent,
      weekendPercent,
      peakHour,
      peakDay,
      hourDistribution: data.hours,
      stressScore,
    });
  }

  files.sort((a, b) => {
    const diff = b.stressScore - a.stressScore;
    return diff !== 0 ? diff : a.file.localeCompare(b.file);
  });

  const stressFiles = files.slice(0, 10);

  // tierMix from per-file stressScores (independent of MIN_AUTHOR_COMMITS).
  // tierMix is exposed on the report for future use (a "by score band" subline
  // or a tier-distribution mini-chart) but not currently consumed by the web
  // layer. The polished CommitTimingTab uses a repo-aggregate subline instead.
  // Mirrors parallel-dev / bus-factor exposure even though the consumer is
  // different.
  const tierMix = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of files) {
    if (f.stressScore < 25) tierMix.low++;
    else if (f.stressScore < 50) tierMix.medium++;
    else if (f.stressScore < 75) tierMix.high++;
    else tierMix.critical++;
  }

  const highStress = files.filter((f) => f.stressScore >= 70).length;

  // Per-author profiles — apply MIN_AUTHOR_COMMITS floor; sub-floor authors dropped entirely
  const authorStress: AuthorStressProfile[] = [];
  for (const [email, data] of authorData) {
    if (data.totalCommits < MIN_AUTHOR_COMMITS) continue;
    const lateNightPercent = Math.round(
      (data.lateNightCommits / data.totalCommits) * 100,
    );
    const weekendPercent = Math.round(
      (data.weekendCommits / data.totalCommits) * 100,
    );
    const stressScore = Math.min(
      100,
      Math.max(0, Math.round(lateNightPercent * 0.6 + weekendPercent * 0.4)),
    );
    const activeWeeks = data.weeks.size;
    // A bot's or an agent's schedule isn't anyone's evening: never regular.
    const person = classifyAuthor(email) === 'human';
    const regular = (weeks: number) =>
      person &&
      activeWeeks >= REGULAR_MIN_WEEKS &&
      weeks >= REGULAR_SHARE * activeWeeks;
    authorStress.push({
      email,
      name: data.name,
      totalCommits: data.totalCommits,
      lateNightCommits: data.lateNightCommits,
      weekendCommits: data.weekendCommits,
      lateNightPercent,
      weekendPercent,
      stressScore,
      activeWeeks,
      weekendWeeks: data.weekendWeeks.size,
      lateNightWeeks: data.lateNightWeeks.size,
      lateNights: data.lateNights.size,
      regularWeekends: regular(data.weekendWeeks.size),
      regularLateNights: regular(data.lateNightWeeks.size),
    });
  }
  authorStress.sort((a, b) => {
    const diff = b.stressScore - a.stressScore;
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  // Name-collision disambiguation — handle 2-author and N-author collisions identically
  const byName = new Map<string, AuthorStressProfile[]>();
  for (const profile of authorStress) {
    if (!byName.has(profile.name)) byName.set(profile.name, []);
    byName.get(profile.name)!.push(profile);
  }
  for (const [, group] of byName) {
    const distinctEmails = new Set(group.map((p) => p.email));
    if (distinctEmails.size >= 2) {
      for (const profile of group) {
        const localPart = profile.email.split('@')[0];
        profile.name = `${profile.name} (${localPart})`;
      }
    }
  }

  // Per-month — sort ascending, compute total
  const byMonth: CommitTimingMonthlyBucket[] = [];
  for (const [month, data] of monthData) {
    byMonth.push({
      month,
      weekendLateNight: data.weekendLateNight,
      singleCriterion: data.singleCriterion,
      healthy: data.healthy,
      total: data.weekendLateNight + data.singleCriterion + data.healthy,
    });
  }
  byMonth.sort((a, b) => a.month.localeCompare(b.month));

  const repoLateNightPercent =
    repoTotal > 0 ? Math.round((repoLateNight / repoTotal) * 100) : 0;
  const repoWeekendPercent =
    repoTotal > 0 ? Math.round((repoWeekend / repoTotal) * 100) : 0;

  const summary = `${repoLateNightPercent}% of commits happen after hours, ${repoWeekendPercent}% on weekends`;

  return {
    files,
    stressFiles,
    repoLateNightPercent,
    repoWeekendPercent,
    summary,
    repoHourDayMatrix,
    highStress,
    tierMix,
    byMonth,
    authorStress,
    offHours: offHoursByPackage(commits, trackedSet, pkgOf),
  };
}
