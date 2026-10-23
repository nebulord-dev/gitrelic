import { sinceText } from '../age/strata';
import { fixPointOf, ratePct } from '../fixRate/points';
import type { GitrelicReport, HotspotCategory } from '@gitrelic/core';

export type FactTier = 'critical' | 'warning' | 'moderate' | 'healthy';

export interface FileFact {
  label: string;
  value: string;
  /** Severity to color the value with; absent means neutral. */
  tier?: FactTier;
  /** The preset (lens) the row comes from, so a dashboard can link to it. */
  lens?: string;
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

  // Every scored file, not `topHotspots` (the top 20 only): a file scoring
  // 40 is still flagged.
  const hotspot = report.hotspots.files.find((h) => h.file === file);
  if (hotspot) {
    facts.push({
      label: 'Hotspot Score',
      value: String(hotspot.hotspotScore),
      tier: hotspotTier(hotspot.category),
      lens: 'hotspots',
    });
  }

  const churn = report.churn.files.find((f) => f.file === file);
  if (churn) {
    facts.push({
      label: 'Churn (commits)',
      value: fmt(churn.commitCount),
      lens: 'churn',
    });
  }

  const loc = report.loc.files.find((f) => f.file === file);
  if (loc) {
    facts.push({ label: 'Lines of Code', value: fmt(loc.lines) });
    facts.push({ label: 'Language', value: loc.language, lens: 'languages' });
  }

  const bf = report.busFactors.files.find((f) => f.file === file);
  if (bf) {
    facts.push({
      label: 'Bus Factor',
      value: `${bf.uniqueAuthors} (${bf.dominantAuthor.split('@')[0]}: ${bf.dominantAuthorPercent}%)`,
      tier: bf.risk === 'critical' ? 'critical' : undefined,
      lens: 'bus-factor',
    });
  }

  const age = report.ageMap.files.find((f) => f.file === file);
  if (age) {
    const notes = [
      ...(age.orphaned ? ['orphaned'] : []),
      ...(age.wokeAfterDays !== undefined
        ? [`woke after ${sinceText(age.wokeAfterDays)}`]
        : []),
    ];
    facts.push({
      label: 'Last changed',
      value: [`${sinceText(age.ageInDays)} ago`, ...notes].join(' · '),
      // Nobody left who changed it: the one age worth a warning.
      tier: age.orphaned ? 'warning' : undefined,
      lens: 'age-map',
    });
  }

  const ghost = report.ghostFiles.files.find((f) => f.file === file);
  if (ghost) {
    facts.push({
      label: 'Owner Inactive',
      value: `${ghost.dominantAuthor.split('@')[0]} (${ghost.authorInactiveDays} days)`,
      tier: 'warning',
      lens: 'ghost-files',
    });
  }

  const blast = report.blastRadius.files.find((f) => f.file === file);
  if (blast) {
    facts.push({
      label: 'Blast Radius',
      value: `${blast.avgCoChangedFiles.toFixed(1)} avg files`,
      tier: blast.blastScore > 50 ? 'warning' : undefined,
      lens: 'blast-radius',
    });
  }

  const cp = report.coupling.fileProfiles.find((f) => f.file === file);
  if (cp && cp.topPartner) {
    facts.push({
      label: 'Coupled With',
      value: `${baseName(cp.topPartner)} (${Math.round(cp.couplingScore)}%)`,
      lens: 'coupling',
    });
  }

  const cursed = report.cursedFiles.files.find((f) => f.file === file);
  if (cursed) {
    facts.push({
      label: 'Curse Score',
      value: String(cursed.curseScore),
      tier: 'critical',
      lens: 'cursed-files',
    });
  }

  const rr = report.rewriteRatio.files.find((f) => f.file === file);
  if (rr) {
    facts.push({
      label: 'Rewrite Ratio',
      value: rr.ratio.toFixed(2),
      lens: 'rewrite-ratio',
    });
  }

  // Rated files only; a warning when chance can't explain its fixes.
  const fx = fixPointOf(report, file);
  if (fx) {
    facts.push({
      label: 'Fix rate',
      value: `${ratePct(fx.rate)} (${fmt(fx.fixedAfter)} of ${fmt(fx.changes)})`,
      ...(fx.aboveChance ? { tier: 'warning' as const } : {}),
      lens: 'fix-rate',
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
    facts.push({
      label: 'Renames',
      value: `${rename.renameCount} times`,
      lens: 'renames',
    });
  }

  return facts;
}
