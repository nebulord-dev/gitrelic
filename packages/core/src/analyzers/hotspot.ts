import type {
  ChurnReport,
  LocReport,
  HotspotReport,
  HotspotEntry,
  HotspotCategory,
} from '../types.js';

function getCategory(score: number): HotspotCategory {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'warning';
  if (score >= 25) return 'moderate';
  return 'low';
}

export function analyzeHotspots(
  churnReport: ChurnReport,
  locReport: LocReport,
): HotspotReport {
  const locMap = new Map<string, number>();
  for (const f of locReport.files) {
    locMap.set(f.file, f.lines);
  }

  const rawEntries: {
    file: string;
    churnScore: number;
    loc: number;
    rawScore: number;
  }[] = [];

  for (const churnFile of churnReport.files) {
    const loc = locMap.get(churnFile.file);
    if (loc === undefined) continue;
    const clampedLoc = Math.max(1, loc);
    const rawScore = churnFile.churnScore * Math.log2(clampedLoc);
    rawEntries.push({
      file: churnFile.file,
      churnScore: churnFile.churnScore,
      loc,
      rawScore,
    });
  }

  const maxRaw = Math.max(...rawEntries.map((e) => e.rawScore), 1);

  const files: HotspotEntry[] = rawEntries
    .map((e) => {
      const hotspotScore = Math.round((e.rawScore / maxRaw) * 100);
      return {
        file: e.file,
        hotspotScore,
        churnScore: e.churnScore,
        loc: e.loc,
        category: getCategory(hotspotScore),
      };
    })
    .sort((a, b) => b.hotspotScore - a.hotspotScore);

  const topHotspots = files.slice(0, 20);

  const criticalCount = files.filter((f) => f.category === 'critical').length;
  const warningCount = files.filter((f) => f.category === 'warning').length;
  const summary = `${criticalCount} critical hotspot${criticalCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''} across ${files.length} files`;

  return { files, topHotspots, summary };
}
