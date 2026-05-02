import { useEffect, useState } from 'react';

import { useSelection } from '../../hooks/useSelection';
import { PRESETS } from '../../presets/registry';
import { cn } from '../../utils/cn';
import { AuthorForceGraph } from '../hero/AuthorForceGraph';
import { BlastHistogram } from '../hero/BlastHistogram';
import { BusFactorHistogram } from '../hero/BusFactorHistogram';
import { ChurnBar } from '../hero/ChurnBar';
import { ChurnTreemap } from '../hero/ChurnTreemap';
import { CommitGraph } from '../hero/CommitGraph';
import { ContributorSwimlanes } from '../hero/ContributorSwimlanes';
import { CouplingHeatmap } from '../hero/CouplingHeatmap';
import { DebtScatter } from '../hero/DebtScatter';
import { GrowthTimeline } from '../hero/GrowthTimeline';
import { HotspotScatter } from '../hero/HotspotScatter';
import { LanguagesStackedBar } from '../hero/LanguagesStackedBar';
import { OwnershipBar } from '../hero/OwnershipBar';
import { OwnershipBubble } from '../hero/OwnershipBubble';
import { OwnershipSunburst } from '../hero/OwnershipSunburst';
import { RenameSankey } from '../hero/RenameSankey';
import { RewriteDivergingBar } from '../hero/RewriteDivergingBar';
import { RewriteHistogram } from '../hero/RewriteHistogram';
import { RiskHeatmap } from '../hero/RiskHeatmap';
import { ShameLeaderboard } from '../hero/ShameLeaderboard';
import { ShameTrend } from '../hero/ShameTrend';
import { StalenessScatter } from '../hero/StalenessScatter';
import { TestCoverageByDir } from '../hero/TestCoverageByDir';
import { Timeline } from '../hero/Timeline';
import { BottomPanel } from './BottomPanel';
import { InspectorPanel } from './InspectorPanel';
import { MetricsStrip } from './MetricsStrip';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

import type { HeroViz } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

export type LayoutMode =
  | 'default'
  | 'focus-canvas'
  | 'fullscreen-hero'
  | 'fullscreen-table'
  | 'canvas-minimal';

interface PanelVisibility {
  sidebar: boolean;
  bottomPanel: boolean;
  inspector: boolean;
  metricsStrip: boolean;
  hero: boolean;
}

export function computeVisibility(mode: LayoutMode): PanelVisibility {
  switch (mode) {
    case 'focus-canvas':
      return {
        sidebar: false,
        bottomPanel: true,
        inspector: false,
        metricsStrip: true,
        hero: true,
      };
    case 'fullscreen-hero':
      return {
        sidebar: false,
        bottomPanel: false,
        inspector: false,
        metricsStrip: false,
        hero: true,
      };
    case 'fullscreen-table':
      return {
        sidebar: false,
        bottomPanel: true,
        inspector: false,
        metricsStrip: false,
        hero: false,
      };
    case 'canvas-minimal':
      return {
        sidebar: false,
        bottomPanel: false,
        inspector: false,
        metricsStrip: true,
        hero: true,
      };
    default:
      return {
        sidebar: true,
        bottomPanel: true,
        inspector: true,
        metricsStrip: true,
        hero: true,
      };
  }
}

export const HERO_LABELS: Record<HeroViz, string> = {
  treemap: 'Treemap',
  'treemap-age': 'Age',
  'treemap-test': 'Coverage',
  ownership: 'Ownership',
  'ownership-bar': 'Bus Bar',
  'churn-bar': 'Top Churn',
  coupling: 'Coupling',
  'commit-graph': 'Graph',
  scatter: 'Scatter',
  timeline: 'Timeline',
  swimlanes: 'Swimlanes',
  'risk-heatmap': 'Heatmap',
  'ownership-sunburst': 'Sunburst',
  'ownership-sunburst-ghosts': 'Ghosts',
  'ownership-sunburst-silos': 'Silos',
  'author-force-graph': 'Pairs',
  'shame-leaderboard': 'Leaderboard',
  'shame-trend': 'Trend',
  'rename-sankey': 'Sankey',
  'growth-timeline': 'Growth',
  'debt-scatter': 'Debt',
  'rewrite-diverging-bar': 'Rewrites',
  'rewrite-histogram': 'Distribution',
  'staleness-scatter': 'Staleness',
  'blast-histogram': 'Distribution',
  'bus-factor-histogram': 'Distribution',
  'languages-stacked': 'Stacked',
  'test-coverage-by-dir': 'By Dir',
};

interface ShellProps {
  report: GitrelicReport;
}

export function Shell({ report }: ShellProps) {
  const selection = useSelection();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('default');
  const visibility = computeVisibility(layoutMode);
  const heroVizzes = selection.heroAltTabs.map((id) => ({ id, label: HERO_LABELS[id] }));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && !e.shiftKey && e.key === '.') {
        e.preventDefault();
        setLayoutMode((m) => (m === 'focus-canvas' ? 'default' : 'focus-canvas'));
        return;
      }
      if (e.metaKey && e.shiftKey && e.key === '.') {
        e.preventDefault();
        setLayoutMode((m) => (m === 'fullscreen-hero' ? 'default' : 'fullscreen-hero'));
        return;
      }
      if (e.metaKey && e.shiftKey && e.key === ',') {
        e.preventDefault();
        setLayoutMode((m) => (m === 'fullscreen-table' ? 'default' : 'fullscreen-table'));
        return;
      }
      if (e.key === 'Escape') {
        setLayoutMode('default');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const top = report.hotspots.topHotspots[0];
    if (top) {
      selection.selectFile(top.file);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Style block 1: root container — flex column, full viewport height, surface-primary bg
    <div className="flex flex-col h-screen bg-surface-primary">
      {/* Top bar */}
      <TopBar report={report} layoutMode={layoutMode} onLayoutModeChange={setLayoutMode} />

      {/* Body: sidebar + center + inspector */}
      {/* Style block 2: body row — flex row, flex-1, min-h-0 to allow children to shrink */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        {visibility.sidebar && (
          <Sidebar
            report={report}
            activePresetId={selection.activePresetId}
            onApplyPreset={selection.applyPreset}
          />
        )}

        {/* Center area: metrics + hero + bottom */}
        {/* Style block 3: center column — flex-1, flex column, min-w-0 to allow text truncation */}
        <div className="flex-1 flex flex-col min-w-0">
          {visibility.metricsStrip && <MetricsStrip metrics={selection.metrics(report)} />}

          {/* Hero visualization */}
          {visibility.hero && (
            // Style block 4: hero outer — flex-1, min-h-0, p-4 (=1rem = --space-md), flex column
            <div className="flex-1 min-h-0 p-4 flex flex-col">
              {/* Style block 5: hero header row — flex, space-between, center-aligned, mb-3, shrink-0 */}
              <div className="flex justify-between items-center mb-3 shrink-0">
                {/* Style block 6: hero title — text-[13px], font-semibold, text-primary */}
                <span className="text-[13px] font-semibold text-text-primary">
                  {PRESETS[selection.activePresetId].heroLabel ?? 'Repository Map'}
                </span>
                {/* Style block 7: alt-tab pill bar — flex, gap-0.5, surface-tertiary bg, rounded-md, p-0.5 */}
                <div className="flex gap-0.5 bg-surface-tertiary rounded-md p-0.5">
                  {heroVizzes.map((viz) => (
                    // Style block 8: alt-tab pill — cn() for active/inactive state (color + bg are both conditional)
                    <span
                      key={viz.id}
                      onClick={() => selection.setHeroOverride(viz.id)}
                      className={cn(
                        'px-2.5 py-1 rounded text-[10px] cursor-pointer',
                        selection.activeHeroViz === viz.id
                          ? 'text-text-primary bg-surface-elevated'
                          : 'text-text-secondary bg-transparent',
                      )}
                    >
                      {viz.label}
                    </span>
                  ))}
                </div>
              </div>
              {/* Style block 9: hero canvas — flex-1, min-h-0 */}
              <div className="flex-1 min-h-0">
                {selection.activeHeroViz === 'treemap' && (
                  <ChurnTreemap
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'treemap-age' && (
                  <ChurnTreemap
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                    colorBy="age"
                  />
                )}
                {selection.activeHeroViz === 'treemap-test' && (
                  <ChurnTreemap
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                    colorBy="test-proximity"
                  />
                )}
                {selection.activeHeroViz === 'ownership' && (
                  <OwnershipBubble
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'ownership-bar' && (
                  <OwnershipBar
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'churn-bar' && (
                  <ChurnBar
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'scatter' && (
                  <HotspotScatter
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'timeline' && (
                  <Timeline
                    report={report}
                    selectedContributor={selection.selectedContributor}
                    onSelectContributor={selection.selectContributor}
                  />
                )}
                {selection.activeHeroViz === 'swimlanes' && (
                  <ContributorSwimlanes
                    report={report}
                    selectedFile={selection.selectedFile}
                    selectedContributor={selection.selectedContributor}
                    onSelectFile={selection.selectFile}
                    onSelectContributor={selection.selectContributor}
                  />
                )}
                {selection.activeHeroViz === 'coupling' && (
                  <CouplingHeatmap
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'commit-graph' && (
                  <CommitGraph
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'risk-heatmap' && (
                  <RiskHeatmap
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'ownership-sunburst' && (
                  <OwnershipSunburst
                    report={report}
                    selectedFile={selection.selectedFile}
                    selectedContributor={selection.selectedContributor}
                    onSelectFile={selection.selectFile}
                    onSelectContributor={selection.selectContributor}
                  />
                )}
                {selection.activeHeroViz === 'ownership-sunburst-ghosts' && (
                  <OwnershipSunburst
                    report={report}
                    selectedFile={selection.selectedFile}
                    selectedContributor={selection.selectedContributor}
                    onSelectFile={selection.selectFile}
                    onSelectContributor={selection.selectContributor}
                    mode="ghost"
                  />
                )}
                {selection.activeHeroViz === 'ownership-sunburst-silos' && (
                  <OwnershipSunburst
                    report={report}
                    selectedFile={selection.selectedFile}
                    selectedContributor={selection.selectedContributor}
                    onSelectFile={selection.selectFile}
                    onSelectContributor={selection.selectContributor}
                    mode="single-author"
                  />
                )}
                {selection.activeHeroViz === 'author-force-graph' && (
                  <AuthorForceGraph
                    report={report}
                    selectedContributor={selection.selectedContributor}
                    onSelectContributor={selection.selectContributor}
                  />
                )}
                {selection.activeHeroViz === 'shame-leaderboard' && (
                  <ShameLeaderboard
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'shame-trend' && <ShameTrend report={report} />}
                {selection.activeHeroViz === 'rename-sankey' && (
                  <RenameSankey
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'growth-timeline' && (
                  <GrowthTimeline
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'debt-scatter' && (
                  <DebtScatter
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'rewrite-diverging-bar' && (
                  <RewriteDivergingBar
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'rewrite-histogram' && (
                  <RewriteHistogram report={report} />
                )}
                {selection.activeHeroViz === 'staleness-scatter' && (
                  <StalenessScatter
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'blast-histogram' && (
                  <BlastHistogram report={report} />
                )}
                {selection.activeHeroViz === 'bus-factor-histogram' && (
                  <BusFactorHistogram report={report} />
                )}
                {selection.activeHeroViz === 'languages-stacked' && (
                  <LanguagesStackedBar report={report} />
                )}
                {selection.activeHeroViz === 'test-coverage-by-dir' && (
                  <TestCoverageByDir report={report} />
                )}
              </div>
            </div>
          )}

          {/* Bottom panel */}
          {visibility.bottomPanel && (
            <BottomPanel
              report={report}
              activeTab={selection.activeBottomTab}
              altTabs={selection.bottomAltTabs}
              onTabChange={selection.setBottomTabOverride}
              selectedFile={selection.selectedFile}
              onSelectFile={selection.selectFile}
              onApplyPreset={selection.applyPreset}
              fillAvailable={!visibility.hero}
            />
          )}
        </div>

        {/* Right inspector */}
        {visibility.inspector && (
          <InspectorPanel
            report={report}
            selectedFile={selection.selectedFile}
            selectedContributor={selection.selectedContributor}
            activeTab={selection.activeInspectorTab}
            onTabChange={selection.setActiveInspectorTab}
            onSelectFile={selection.selectFile}
            onSelectContributor={selection.selectContributor}
          />
        )}
      </div>
    </div>
  );
}
