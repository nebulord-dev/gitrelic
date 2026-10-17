import type { GitrelicReport, HotspotCategory } from '@gitrelic/core';

export type FactTier = 'critical' | 'warning' | 'moderate' | 'healthy';

export interface FileFact {
  label: string;
  value: string;
  /** Severity to color the value with; absent means neutral. */
  tier?: FactTier;
}

const fmt = (n: number) => n.toLocaleString();
const baseName = (path: string) => path.split('/').pop() ?? path;

function hotspotTier(category: HotspotCategory): FactTier {
  return category === 'low' ? 'healthy' : category;
}

/**
 * Every analyzer's verdict on one file, in inspector order. Rows appear only
 * for analyzers that report the file. Tiers are semantic; each dashboard maps
 * them to its own colors.
 */
export function fileFacts(file: string, report: GitrelicReport): FileFact[] {
  const facts: FileFact[] = [];

  const hotspot = report.hotspots.topHotspots.find((h) => h.file === file);
  if (hotspot) {
    facts.push({
      label: 'Hotspot Score',
      value: String(hotspot.hotspotScore),
      tier: hotspotTier(hotspot.category),
    });
  }

  const churn = report.churn.files.find((f) => f.file === file);
  if (churn) {
    facts.push({ label: 'Churn (commits)', value: fmt(churn.commitCount) });
  }

  const loc = report.loc.files.find((f) => f.file === file);
  if (loc) {
    facts.push({ label: 'Lines of Code', value: fmt(loc.lines) });
    facts.push({ label: 'Language', value: loc.language });
  }

  const bf = report.busFactors.files.find((f) => f.file === file);
  if (bf) {
    facts.push({
      label: 'Bus Factor',
      value: `${bf.uniqueAuthors} (${bf.dominantAuthor.split('@')[0]}: ${bf.dominantAuthorPercent}%)`,
      tier: bf.risk === 'critical' ? 'critical' : undefined,
    });
  }

  const age = report.ageMap.files.find((f) => f.file === file);
  if (age) {
    facts.push({
      label: 'Age',
      value: `${age.ageInDays} days (${age.status})`,
    });
  }

  const blast = report.blastRadius.files.find((f) => f.file === file);
  if (blast) {
    facts.push({
      label: 'Blast Radius',
      value: `${blast.avgCoChangedFiles.toFixed(1)} avg files`,
      tier: blast.blastScore > 50 ? 'warning' : undefined,
    });
  }

  const cp = report.coupling.fileProfiles.find((f) => f.file === file);
  if (cp && cp.topPartner) {
    facts.push({
      label: 'Coupled With',
      value: `${baseName(cp.topPartner)} (${Math.round(cp.couplingScore)}%)`,
    });
  }

  const cursed = report.cursedFiles.files.find((f) => f.file === file);
  if (cursed) {
    facts.push({
      label: 'Curse Score',
      value: String(cursed.curseScore),
      tier: 'critical',
    });
  }

  const rr = report.rewriteRatio.files.find((f) => f.file === file);
  if (rr) {
    facts.push({ label: 'Rewrite Ratio', value: rr.ratio.toFixed(2) });
  }

  const sh = report.forensics.files.find((f) => f.file === file);
  if (sh && sh.shameScore > 0) {
    facts.push({
      label: 'Shame Score',
      value: String(sh.shameScore),
      tier: 'warning',
    });
  }

  const cv = report.churnVelocity.files.find((f) => f.file === file);
  if (cv) {
    facts.push({ label: 'Churn Trend', value: cv.trend });
  }

  const rename = report.renameTracking.chains.find(
    (c) => c.currentPath === file,
  );
  if (rename && rename.renameCount > 0) {
    facts.push({ label: 'Renames', value: `${rename.renameCount} times` });
  }

  return facts;
}
