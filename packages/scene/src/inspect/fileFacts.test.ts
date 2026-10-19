import { describe, expect, it } from 'vitest';

import { normalizeReport } from '../report/normalizeReport';
import { fileFacts } from './fileFacts';
import type { GitrelicReport } from '@gitrelic/core';

const F = 'src/core/engine.ts';

// Only the fields fileFacts reads; the casts keep fixtures readable.
function reportWith(file: string): GitrelicReport {
  const r = normalizeReport({});
  r.hotspots.files = [
    { file, hotspotScore: 88, category: 'critical' } as never,
  ];
  r.churn.files = [{ file, commitCount: 1234 } as never];
  r.loc.files = [{ file, lines: 5120, language: 'TypeScript' } as never];
  r.busFactors.files = [
    {
      file,
      uniqueAuthors: 1,
      dominantAuthor: 'ann@corp.com',
      dominantAuthorPercent: 97,
      risk: 'critical',
    } as never,
  ];
  r.ageMap.files = [{ file, ageInDays: 400, status: 'stale' } as never];
  r.ghostFiles.files = [
    { file, dominantAuthor: 'bo@corp.com', authorInactiveDays: 210 } as never,
  ];
  r.deadCode.candidates = [{ file, ageInDays: 400 } as never];
  r.blastRadius.files = [
    { file, avgCoChangedFiles: 7.25, blastScore: 61 } as never,
  ];
  r.coupling.fileProfiles = [
    { file, topPartner: 'src/core/scheduler.ts', couplingScore: 72.6 } as never,
  ];
  r.cursedFiles.files = [{ file, curseScore: 64 } as never];
  r.rewriteRatio.files = [{ file, ratio: 1.456 } as never];
  r.forensics.files = [{ file, shameScore: 40 } as never];
  r.churnVelocity.files = [{ file, trend: 'accelerating' } as never];
  r.renameTracking.chains = [{ currentPath: file, renameCount: 2 } as never];
  return r;
}

describe('fileFacts', () => {
  it('scores a file outside the top 20 hotspots', () => {
    const r = reportWith(F);
    r.hotspots.topHotspots = [];
    r.hotspots.files = [
      { file: F, hotspotScore: 40, category: 'moderate' } as never,
    ];
    expect(fileFacts(F, r)[0]).toMatchObject({
      label: 'Hotspot Score',
      value: '40',
      lens: 'hotspots',
    });
  });

  it('lists every analyzer verdict in inspector order', () => {
    expect(fileFacts(F, reportWith(F))).toEqual([
      {
        label: 'Hotspot Score',
        value: '88',
        tier: 'critical',
        lens: 'hotspots',
      },
      {
        label: 'Churn (commits)',
        value: (1234).toLocaleString(),
        lens: 'churn',
      },
      { label: 'Lines of Code', value: (5120).toLocaleString() },
      { label: 'Language', value: 'TypeScript', lens: 'languages' },
      {
        label: 'Bus Factor',
        value: '1 (ann: 97%)',
        tier: 'critical',
        lens: 'bus-factor',
      },
      { label: 'Age', value: '400 days (stale)', lens: 'age-map' },
      {
        label: 'Owner Inactive',
        value: 'bo (210 days)',
        tier: 'warning',
        lens: 'ghost-files',
      },
      {
        label: 'Stale',
        value: 'untouched 400 days',
        tier: 'moderate',
        lens: 'dead-code',
      },
      {
        label: 'Blast Radius',
        value: '7.3 avg files',
        tier: 'warning',
        lens: 'blast-radius',
      },
      { label: 'Coupled With', value: 'scheduler.ts (73%)', lens: 'coupling' },
      {
        label: 'Curse Score',
        value: '64',
        tier: 'critical',
        lens: 'cursed-files',
      },
      { label: 'Rewrite Ratio', value: '1.46', lens: 'rewrite-ratio' },
      { label: 'Shame Score', value: '40', tier: 'warning', lens: 'shame' },
      { label: 'Churn Trend', value: 'accelerating' },
      { label: 'Renames', value: '2 times', lens: 'renames' },
    ]);
  });

  it('returns nothing for a file no analyzer reports', () => {
    expect(fileFacts('other.ts', reportWith(F))).toEqual([]);
  });

  it('omits zero-signal rows and neutral tiers', () => {
    const r = reportWith(F);
    r.forensics.files = [{ file: F, shameScore: 0 } as never];
    r.renameTracking.chains = [{ currentPath: F, renameCount: 0 } as never];
    r.coupling.fileProfiles = [
      { file: F, topPartner: null, couplingScore: 0 } as never,
    ];
    r.blastRadius.files = [
      { file: F, avgCoChangedFiles: 2, blastScore: 50 } as never,
    ];
    r.busFactors.files[0] = { ...r.busFactors.files[0], risk: 'high' } as never;
    const facts = fileFacts(F, r);
    const labels = facts.map((f) => f.label);
    expect(labels).not.toContain('Shame Score');
    expect(labels).not.toContain('Renames');
    expect(labels).not.toContain('Coupled With');
    expect(facts.find((f) => f.label === 'Blast Radius')?.tier).toBeUndefined();
    expect(facts.find((f) => f.label === 'Bus Factor')?.tier).toBeUndefined();
  });

  it.each([
    ['critical', 'critical'],
    ['warning', 'warning'],
    ['moderate', 'moderate'],
    ['low', 'healthy'],
  ])('maps hotspot category %s to tier %s', (category, tier) => {
    const r = reportWith(F);
    r.hotspots.files = [{ file: F, hotspotScore: 10, category } as never];
    expect(fileFacts(F, r)[0].tier).toBe(tier);
  });

  it('tiers shame against its notable bar of 70', () => {
    const tierAt = (shameScore: number) => {
      const r = reportWith(F);
      r.forensics.files = [{ file: F, shameScore } as never];
      return fileFacts(F, r).find((f) => f.label === 'Shame Score')?.tier;
    };
    expect(tierAt(9)).toBeUndefined();
    expect(tierAt(25)).toBe('moderate');
    expect(tierAt(40)).toBe('warning');
    expect(tierAt(75)).toBe('critical');
  });
});
