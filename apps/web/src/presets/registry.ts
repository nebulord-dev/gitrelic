import { busFactorMetrics } from './metrics/bus-factor';
import { contributorsMetrics } from './metrics/contributors';
import { couplingMetrics } from './metrics/coupling';
import { cursedFilesMetrics } from './metrics/cursed-files';
import { deadCodeMetrics } from './metrics/dead-code';
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
  'bus-factor': {
    id: 'bus-factor',
    tier: 'analyzer',
    label: 'Bus Factor',
    group: 'ownership-risk',
    hero: {
      defaultViz: 'risk-heatmap',
      altTabs: ['risk-heatmap', 'ownership'],
    },
    bottomPanel: {
      defaultTab: 'bus-factor',
      altTabs: ['bus-factor', 'knowledge-silos'],
    },
    metrics: busFactorMetrics,
  },
  coupling: {
    id: 'coupling',
    tier: 'analyzer',
    label: 'Coupling',
    group: 'ownership-risk',
    hero: {
      defaultViz: 'coupling',
      altTabs: ['coupling'],
    },
    bottomPanel: {
      defaultTab: 'coupling',
      altTabs: ['coupling'],
    },
    metrics: couplingMetrics,
  },
  contributors: {
    id: 'contributors',
    tier: 'analyzer',
    label: 'Contributors',
    group: 'team-activity',
    hero: {
      defaultViz: 'ownership',
      altTabs: ['ownership', 'swimlanes', 'ownership-sunburst'],
    },
    bottomPanel: {
      defaultTab: 'contributors',
      altTabs: ['contributors'],
    },
    metrics: contributorsMetrics,
  },
  'cursed-files': {
    id: 'cursed-files',
    tier: 'analyzer',
    label: 'Cursed Files',
    group: 'code-health',
    hero: {
      defaultViz: 'risk-heatmap',
      altTabs: ['risk-heatmap', 'treemap', 'scatter'],
    },
    bottomPanel: {
      defaultTab: 'cursed-files',
      altTabs: ['cursed-files'],
    },
    metrics: cursedFilesMetrics,
  },
  'dead-code': {
    id: 'dead-code',
    tier: 'analyzer',
    label: 'Stale Files',
    group: 'code-health',
    hero: {
      defaultViz: 'scatter',
      altTabs: ['scatter', 'treemap'],
    },
    bottomPanel: {
      defaultTab: 'dead-code',
      altTabs: ['dead-code'],
    },
    metrics: deadCodeMetrics,
  },
};
