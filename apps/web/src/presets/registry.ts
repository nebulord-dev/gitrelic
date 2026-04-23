import { hotspotsMetrics } from './metrics/hotspots';
import { overviewMetrics } from './metrics/overview';
import { riskMetrics } from './metrics/risk';
import { techDebtMetrics } from './metrics/tech-debt';

import type { PresetDefinition, PresetId } from './types';

export const PRESETS: Record<PresetId, PresetDefinition> = {
  overview: {
    id: 'overview',
    tier: 'dashboard',
    label: 'Overview',
    group: 'overview',
    hero: {
      defaultViz: 'treemap',
      altTabs: [
        'treemap',
        'ownership',
        'coupling',
        'commit-graph',
        'scatter',
        'timeline',
        'swimlanes',
      ],
    },
    bottomPanel: {
      defaultTab: 'hotspots',
      altTabs: ['hotspots', 'cursed-files', 'bus-factor', 'churn-velocity', 'ghost-files'],
    },
    metrics: overviewMetrics,
  },
  risk: {
    id: 'risk',
    tier: 'dashboard',
    label: 'Risk',
    group: 'overview',
    hero: {
      defaultViz: 'risk-heatmap',
      altTabs: ['risk-heatmap', 'ownership-sunburst'],
    },
    bottomPanel: {
      defaultTab: 'risk-register',
      altTabs: ['risk-register', 'bus-factor', 'ghost-files', 'knowledge-silos'],
    },
    metrics: riskMetrics,
  },
  'tech-debt': {
    id: 'tech-debt',
    tier: 'dashboard',
    label: 'Tech Debt',
    group: 'overview',
    hero: {
      defaultViz: 'growth-timeline',
      altTabs: ['growth-timeline', 'debt-scatter'],
    },
    bottomPanel: {
      defaultTab: 'debt-inventory',
      altTabs: [
        'debt-inventory',
        'dead-code',
        'complexity-trend',
        'rewrite-ratio',
        'churn-velocity',
      ],
    },
    metrics: techDebtMetrics,
  },
  // Tier 2 entries (Tasks 2.11 – 2.14) go below this line.
  hotspots: {
    id: 'hotspots',
    tier: 'analyzer',
    label: 'Hotspots',
    group: 'code-health',
    hero: {
      defaultViz: 'scatter',
      altTabs: ['scatter', 'treemap', 'risk-heatmap'],
    },
    bottomPanel: {
      defaultTab: 'hotspots',
      altTabs: ['hotspots'],
    },
    metrics: hotspotsMetrics,
  },
  'bus-factor': undefined as unknown as PresetDefinition,
  coupling: undefined as unknown as PresetDefinition,
  contributors: undefined as unknown as PresetDefinition,
};
