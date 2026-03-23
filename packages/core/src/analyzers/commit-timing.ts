import type { RawCommit } from '../utils/git.js';
import type { CommitTimingReport, FileTimingProfile } from '../types.js';

/**
 * Parses an ISO date string and returns the hour (0-23) and day-of-week (0-6, Sun=0)
 * using the timezone offset embedded in the string (the author's local time).
 */
function parseLocalTime(isoDate: string): { hour: number; day: number } {
  // Match timezone offset like +05:30, -04:00, or Z
  const match = isoDate.match(/([+-])(\d{2}):(\d{2})$/);
  const date = new Date(isoDate);

  if (!match) {
    // Z or no offset — use UTC
    return { hour: date.getUTCHours(), day: date.getUTCDay() };
  }

  const sign = match[1] === '+' ? 1 : -1;
  const offsetHours = parseInt(match[2], 10);
  const offsetMinutes = parseInt(match[3], 10);
  const totalOffsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60_000;

  // Get UTC time and apply offset to get local time
  const localMs = date.getTime() + totalOffsetMs;
  const local = new Date(localMs);

  return { hour: local.getUTCHours(), day: local.getUTCDay() };
}

function isLateNight(hour: number): boolean {
  return hour === 23 || hour <= 4; // 11pm to 4am (hours 23, 0, 1, 2, 3, 4)
}

function isWeekend(day: number): boolean {
  return day === 0 || day === 6; // Sunday or Saturday
}

export function analyzeCommitTiming(commits: RawCommit[], trackedFiles: string[]): CommitTimingReport {
  if (commits.length === 0) {
    return {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 0,
      repoWeekendPercent: 0,
      summary: '0% of commits happen after hours, 0% on weekends',
    };
  }

  const trackedSet = new Set(trackedFiles);

  // Per-file accumulators
  const fileData = new Map<string, { hours: number[]; totalCommits: number; lateNight: number; weekend: number; dayCount: number[] }>();

  // Repo-wide counters
  let repoTotal = 0;
  let repoLateNight = 0;
  let repoWeekend = 0;

  for (const commit of commits) {
    const { hour, day } = parseLocalTime(commit.date);
    const late = isLateNight(hour);
    const wknd = isWeekend(day);

    repoTotal++;
    if (late) repoLateNight++;
    if (wknd) repoWeekend++;

    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;

      if (!fileData.has(file)) {
        fileData.set(file, { hours: new Array(24).fill(0), totalCommits: 0, lateNight: 0, weekend: 0, dayCount: new Array(7).fill(0) });
      }
      const data = fileData.get(file)!;
      data.hours[hour]++;
      data.dayCount[day]++;
      data.totalCommits++;
      if (late) data.lateNight++;
      if (wknd) data.weekend++;
    }
  }

  // Build file profiles, excluding files with < 3 commits
  const files: FileTimingProfile[] = [];
  for (const [file, data] of fileData) {
    if (data.totalCommits < 3) continue;

    const lateNightPercent = Math.round((data.lateNight / data.totalCommits) * 100);
    const weekendPercent = Math.round((data.weekend / data.totalCommits) * 100);
    const peakHour = data.hours.indexOf(Math.max(...data.hours));
    const peakDay = data.dayCount.indexOf(Math.max(...data.dayCount));
    const stressScore = Math.min(100, Math.max(0, Math.round(lateNightPercent * 0.6 + weekendPercent * 0.4)));

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

  // Sort by stressScore desc, alphabetical tiebreaker
  files.sort((a, b) => {
    const diff = b.stressScore - a.stressScore;
    return diff !== 0 ? diff : a.file.localeCompare(b.file);
  });

  const stressFiles = files.slice(0, 10);

  const repoLateNightPercent = repoTotal > 0 ? Math.round((repoLateNight / repoTotal) * 100) : 0;
  const repoWeekendPercent = repoTotal > 0 ? Math.round((repoWeekend / repoTotal) * 100) : 0;

  const summary = `${repoLateNightPercent}% of commits happen after hours, ${repoWeekendPercent}% on weekends`;

  return {
    files,
    stressFiles,
    repoLateNightPercent,
    repoWeekendPercent,
    summary,
  };
}
