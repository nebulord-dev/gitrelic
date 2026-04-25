import type { GitrelicReport } from '@gitrelic/core';

export type PresetTier = 'dashboard' | 'analyzer';

export type SidebarGroupLabel =
  | 'overview'
  | 'code-health'
  | 'ownership-risk'
  | 'team-activity'
  | 'structure';

export type HeroViz =
  | 'treemap'
  | 'treemap-age'
  | 'treemap-test'
  | 'ownership'
  | 'ownership-bar'
  | 'coupling'
  | 'commit-graph'
  | 'scatter'
  | 'timeline'
  | 'swimlanes'
  | 'risk-heatmap'
  | 'ownership-sunburst'
  | 'ownership-sunburst-ghosts'
  | 'ownership-sunburst-silos'
  | 'author-force-graph'
  | 'shame-leaderboard'
  | 'rename-sankey'
  | 'growth-timeline'
  | 'debt-scatter'
  | 'rewrite-diverging-bar'
  | 'staleness-scatter';

export type BottomTab =
  | 'hotspots'
  | 'cursed-files'
  | 'bus-factor'
  | 'coupling'
  | 'contributors'
  | 'parallel-dev'
  | 'shame'
  | 'age-map'
  | 'dead-code'
  | 'complexity-trend'
  | 'rewrite-ratio'
  | 'churn-velocity'
  | 'blast-radius'
  | 'ghost-files'
  | 'knowledge-silos'
  | 'co-authors'
  | 'commit-timing'
  | 'languages'
  | 'test-coverage'
  | 'renames'
  | 'risk-register'
  | 'debt-inventory';

export interface Metric {
  label: string;
  value: string;
  color: string;
}

export type DashboardPresetId = 'overview' | 'risk' | 'tech-debt';

export type AnalyzerPresetId =
  | 'hotspots'
  | 'bus-factor'
  | 'coupling'
  | 'contributors'
  | 'cursed-files'
  | 'dead-code'
  | 'blast-radius'
  | 'complexity-trend'
  | 'knowledge-silos'
  | 'parallel-dev'
  | 'age-map'
  | 'languages'
  | 'test-coverage'
  | 'rewrite-ratio'
  | 'commit-timing'
  | 'ghost-files'
  | 'co-authors'
  | 'shame'
  | 'renames';

export type PresetId = DashboardPresetId | AnalyzerPresetId;

export interface PresetDefinition {
  id: PresetId;
  tier: PresetTier;
  label: string;
  group: SidebarGroupLabel;
  hero: {
    defaultViz: HeroViz;
    altTabs: HeroViz[];
  };
  bottomPanel: {
    defaultTab: BottomTab;
    altTabs: BottomTab[];
  };
  metrics: (report: GitrelicReport) => Metric[];
}
