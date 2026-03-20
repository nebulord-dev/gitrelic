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
      multiSignalFiles.push({ file, clusterCount: dimensions.length, dimensions });
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
    summary += ` \`${msf.file}\` appears in ${msf.clusterCount} clusters (${msf.dimensions.join(', ')}) — this file is hot for multiple systemic reasons and is the strongest candidate for intervention.`;
  }

  return { clusters, multiSignalFiles, summary };
}
