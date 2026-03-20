import type { RawCommit } from '../utils/git.js';
import type {
  HotspotReport, BusFactorReport, CouplingReport, ContributorReport,
  HotspotClusterReport, HotspotCluster, ClusterMember, MultiSignalFile, ClusterDimension,
} from '../types.js';

export function analyzeHotspotClustering(
  hotspots: HotspotReport,
  busFactor: BusFactorReport,
  coupling: CouplingReport,
  contributors: ContributorReport,
  commits: RawCommit[],
  trackedFiles: string[],
): HotspotClusterReport {
  const top = hotspots.topHotspots.map(h => ({ file: h.file, hotspotScore: h.hotspotScore }));

  const allClusters: HotspotCluster[] = [
    ...clusterByStructure(top, trackedFiles),
    ...clusterByOwnership(top, busFactor, contributors),
    ...clusterByTemporal(top, commits),
    ...clusterByCouplingHub(top, coupling),
  ];

  return assembleReport(allClusters);
}

// ─── Structural ──────────────────────────────────────────────────────────────

function getDirectoryPrefix(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 2) return parts[0];
  return parts.slice(0, 2).join('/');
}

function clusterByStructure(hotspots: ClusterMember[], trackedFiles: string[]): HotspotCluster[] {
  const prefixCounts = new Map<string, number>();
  for (const f of trackedFiles) {
    const prefix = getDirectoryPrefix(f);
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
  }
  const halfTotal = trackedFiles.length / 2;

  const groups = new Map<string, ClusterMember[]>();
  for (const h of hotspots) {
    const prefix = getDirectoryPrefix(h.file);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(h);
  }

  const clusters: HotspotCluster[] = [];
  for (const [prefix, members] of groups) {
    if (members.length < 2) continue;
    if ((prefixCounts.get(prefix) ?? 0) > halfTotal) continue;

    const avgScore = Math.round(members.reduce((s, m) => s + m.hotspotScore, 0) / members.length);
    clusters.push({
      dimension: 'structural',
      label: prefix,
      members,
      clusterScore: members.length * avgScore,
      narrative: `${members.length} of your top 20 hotspots live in \`${prefix}/\`. The problem may not be individual files — this subsystem's design is concentrating risk.`,
      sharedTrait: prefix,
    });
  }

  return clusters;
}

// ─── Ownership ───────────────────────────────────────────────────────────────

function clusterByOwnership(
  hotspots: ClusterMember[],
  busFactor: BusFactorReport,
  contributors: ContributorReport,
): HotspotCluster[] {
  if (contributors.contributors.length <= 1) return [];

  const busFactorByFile = new Map(busFactor.files.map(f => [f.file, f]));
  const groups = new Map<string, { members: ClusterMember[]; percents: number[] }>();

  for (const h of hotspots) {
    const bf = busFactorByFile.get(h.file);
    if (!bf) continue;
    const author = bf.dominantAuthor;
    if (!groups.has(author)) groups.set(author, { members: [], percents: [] });
    const g = groups.get(author)!;
    g.members.push(h);
    g.percents.push(bf.dominantAuthorPercent);
  }

  const clusters: HotspotCluster[] = [];
  for (const [author, { members, percents }] of groups) {
    if (members.length < 2) continue;

    const avgScore = Math.round(members.reduce((s, m) => s + m.hotspotScore, 0) / members.length);
    const avgPercent = Math.round(percents.reduce((s, p) => s + p, 0) / percents.length);
    clusters.push({
      dimension: 'ownership',
      label: `${author} (avg ${avgPercent}%)`,
      members,
      clusterScore: members.length * avgScore,
      narrative: `${author} owns ${members.length} of the top 20 hotspots (avg ${avgPercent}% ownership). Either they're the team's most critical contributor or they're spreading complexity.`,
      sharedTrait: author,
    });
  }

  return clusters;
}

// ─── Temporal ────────────────────────────────────────────────────────────────

function toMonthKey(dateStr: string): string {
  // Parse only the YYYY-MM portion to avoid timezone shift issues
  const [year, month] = dateStr.slice(0, 7).split('-');
  return `${year}-${month}`;
}

function findInflectionMonth(timestamps: string[]): string | null {
  if (timestamps.length < 4) return null;

  const monthlyCounts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = toMonthKey(ts);
    monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
  }

  const avg = timestamps.length / monthlyCounts.size;

  // Find first month exceeding the average — that's the inflection
  const sorted = [...monthlyCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [month, count] of sorted) {
    if (count > avg) return month;
  }

  return null;
}

function clusterByTemporal(hotspots: ClusterMember[], commits: RawCommit[]): HotspotCluster[] {
  const hotspotSet = new Set(hotspots.map(h => h.file));

  // Collect per-file commit dates
  const fileDates = new Map<string, string[]>();
  for (const commit of commits) {
    for (const file of commit.files) {
      if (!hotspotSet.has(file)) continue;
      if (!fileDates.has(file)) fileDates.set(file, []);
      fileDates.get(file)!.push(commit.date);
    }
  }

  // Check minimum 3 distinct months across all hotspot commits
  const allMonths = new Set<string>();
  for (const dates of fileDates.values()) {
    for (const d of dates) allMonths.add(toMonthKey(d));
  }
  if (allMonths.size < 3) return [];

  // Find inflection month per file
  const scoreByFile = new Map(hotspots.map(h => [h.file, h.hotspotScore]));
  const inflections = new Map<string, ClusterMember[]>();
  for (const [file, dates] of fileDates) {
    const month = findInflectionMonth(dates);
    if (!month) continue;
    if (!inflections.has(month)) inflections.set(month, []);
    inflections.get(month)!.push({ file, hotspotScore: scoreByFile.get(file)! });
  }

  const clusters: HotspotCluster[] = [];
  for (const [month, members] of inflections) {
    if (members.length < 2) continue;

    const avgScore = Math.round(members.reduce((s, m) => s + m.hotspotScore, 0) / members.length);
    const [year, mo] = month.split('-');
    // Use UTC date to avoid timezone shifting the month
    const monthName = new Date(Date.UTC(Number(year), Number(mo) - 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
    const label = `${monthName} ${year} inflection`;

    clusters.push({
      dimension: 'temporal',
      label,
      members,
      clusterScore: members.length * avgScore,
      narrative: `${members.length} hotspots started accelerating in ${monthName} ${year}. Something happened that month — a migration, a feature push, or a staffing change — that destabilized multiple files simultaneously.`,
      sharedTrait: month,
    });
  }

  return clusters;
}

// ─── Coupling Hub ─────────────────────────────────────────────────────────────

function clusterByCouplingHub(hotspots: ClusterMember[], coupling: CouplingReport): HotspotCluster[] {
  if (coupling.pairs.length === 0) return [];

  const hotspotSet = new Set(hotspots.map(h => h.file));
  const scoreByFile = new Map(hotspots.map(h => [h.file, h.hotspotScore]));

  // For each pair, if one side is a hotspot and the other isn't, record the non-hotspot as a potential hub
  const hubToHotspots = new Map<string, Set<string>>();
  for (const pair of coupling.pairs) {
    const aIsHot = hotspotSet.has(pair.fileA);
    const bIsHot = hotspotSet.has(pair.fileB);

    if (aIsHot && !bIsHot) {
      if (!hubToHotspots.has(pair.fileB)) hubToHotspots.set(pair.fileB, new Set());
      hubToHotspots.get(pair.fileB)!.add(pair.fileA);
    }
    if (bIsHot && !aIsHot) {
      if (!hubToHotspots.has(pair.fileA)) hubToHotspots.set(pair.fileA, new Set());
      hubToHotspots.get(pair.fileA)!.add(pair.fileB);
    }
  }

  const clusters: HotspotCluster[] = [];
  for (const [hub, hotspotFiles] of hubToHotspots) {
    if (hotspotFiles.size < 2) continue;

    const members: ClusterMember[] = [...hotspotFiles].map(f => ({
      file: f,
      hotspotScore: scoreByFile.get(f)!,
    }));
    const avgScore = Math.round(members.reduce((s, m) => s + m.hotspotScore, 0) / members.length);

    clusters.push({
      dimension: 'coupling-hub',
      label: `${hub} (hub)`,
      members,
      clusterScore: members.length * avgScore,
      narrative: `\`${hub}\` isn't a hotspot itself, but it's temporally coupled to ${members.length} files that are. Changes to this quiet file ripple outward — it may be the root cause behind the churn you're seeing.`,
      sharedTrait: hub,
    });
  }

  return clusters;
}

// ─── Assembly ────────────────────────────────────────────────────────────────

function assembleReport(clusters: HotspotCluster[]): HotspotClusterReport {
  clusters.sort((a, b) => b.clusterScore - a.clusterScore);

  const fileClusters = new Map<string, ClusterDimension[]>();
  for (const cluster of clusters) {
    for (const member of cluster.members) {
      if (!fileClusters.has(member.file)) fileClusters.set(member.file, []);
      fileClusters.get(member.file)!.push(cluster.dimension);
    }
  }

  const multiSignalFiles: MultiSignalFile[] = [];
  for (const [file, dimensions] of fileClusters) {
    if (dimensions.length >= 2) {
      const uniqueDimensions = [...new Set(dimensions)];
      multiSignalFiles.push({ file, clusterCount: dimensions.length, dimensions: uniqueDimensions });
    }
  }
  multiSignalFiles.sort((a, b) => b.clusterCount - a.clusterCount);

  if (clusters.length === 0) {
    return { clusters, multiSignalFiles, summary: 'No root cause patterns detected — hotspots appear independent.' };
  }

  const dimensionCount = new Set(clusters.map(c => c.dimension)).size;
  const top = clusters[0];
  let summary = `${clusters.length} root cause cluster${clusters.length !== 1 ? 's' : ''} found across ${dimensionCount} dimension${dimensionCount !== 1 ? 's' : ''}. \`${top.label}\` (${top.dimension}) explains the most hotspots.`;

  if (multiSignalFiles.length > 0) {
    const msf = multiSignalFiles[0];
    summary += ` \`${msf.file}\` appears in ${msf.clusterCount} clusters across ${msf.dimensions.length} dimensions (${msf.dimensions.join(', ')}) — strongest candidate for intervention.`;
  }

  return { clusters, multiSignalFiles, summary };
}
