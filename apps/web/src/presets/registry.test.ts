import { describe, expect, it } from 'vitest';

import { PRESETS } from './registry';

import type { PresetDefinition, PresetId } from './types';
import type { GitrelicReport } from '@gitrelic/core';

// Minimal report fixture for metrics() invocation. Expand as new metric functions need it.
function makeReport(): GitrelicReport {
  return {
    meta: { totalAuthors: 5, ageInDays: 365 },
    churn: { files: [], topFiles: [], hotspotCount: 0, summary: '' },
    loc: { totalFiles: 10, totalLines: 1000, files: [], languages: [], summary: '' },
    hotspots: { files: [], topHotspots: [], summary: '' },
    cursedFiles: [],
    busFactors: { criticalFiles: [] },
    deadCode: { totalDeadFiles: 0, candidates: [] },
    ghostFiles: { totalGhostFiles: 0 },
    knowledgeConcentration: { concentrationIndex: 0 },
    blastRadius: { files: [] },
    complexityTrend: { growingFiles: [] },
    rewriteRatio: { topRewriters: [] },
    churnVelocity: { acceleratingFiles: [] },
  } as unknown as GitrelicReport;
}

const DEFINED_PRESETS = (Object.entries(PRESETS) as [PresetId, PresetDefinition | undefined][])
  .filter(([, def]) => def !== undefined)
  .map(([id, def]) => ({ id, def: def as PresetDefinition }));

describe('PRESETS registry contract', () => {
  it.each(DEFINED_PRESETS)('$id: defaultViz is included in hero.altTabs', ({ def }) => {
    expect(def.hero.altTabs).toContain(def.hero.defaultViz);
  });

  it.each(DEFINED_PRESETS)('$id: defaultTab is included in bottomPanel.altTabs', ({ def }) => {
    expect(def.bottomPanel.altTabs).toContain(def.bottomPanel.defaultTab);
  });

  it.each(DEFINED_PRESETS)('$id: metrics returns 1 to 5 entries', ({ def }) => {
    const result = def.metrics(makeReport());
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it.each(DEFINED_PRESETS)('$id: id field matches the registry key', ({ id, def }) => {
    expect(def.id).toBe(id);
  });

  it('includes all three Tier 1 presets', () => {
    const tier1Ids = DEFINED_PRESETS.filter(({ def }) => def.tier === 'dashboard').map(
      ({ id }) => id,
    );
    expect(tier1Ids).toEqual(expect.arrayContaining(['overview', 'risk', 'tech-debt']));
  });
});
