import { useEffect, useState } from 'react';

import { useSelection } from '../../hooks/useSelection';
import { ChurnTreemap } from '../hero/ChurnTreemap';
import { CommitGraph } from '../hero/CommitGraph';
import { ContributorSwimlanes } from '../hero/ContributorSwimlanes';
import { CouplingHeatmap } from '../hero/CouplingHeatmap';
import { DebtScatter } from '../hero/DebtScatter';
import { GrowthTimeline } from '../hero/GrowthTimeline';
import { HotspotScatter } from '../hero/HotspotScatter';
import { OwnershipBubble } from '../hero/OwnershipBubble';
import { OwnershipSunburst } from '../hero/OwnershipSunburst';
import { RiskHeatmap } from '../hero/RiskHeatmap';
import { Timeline } from '../hero/Timeline';
import { BottomPanel } from './BottomPanel';
import { InspectorPanel } from './InspectorPanel';
import { MetricsStrip } from './MetricsStrip';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

import type { DashboardMode, HeroViz } from '../../hooks/useSelection';
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

function getHeroVizzes(mode: DashboardMode): { id: HeroViz; label: string }[] {
  switch (mode) {
    case 'risk':
      return [
        { id: 'risk-heatmap', label: 'Heatmap' },
        { id: 'ownership-sunburst', label: 'Sunburst' },
      ];
    case 'tech-debt':
      return [
        { id: 'growth-timeline', label: 'Timeline' },
        { id: 'debt-scatter', label: 'Scatter' },
      ];
    default:
      return [
        { id: 'treemap', label: 'Treemap' },
        { id: 'ownership', label: 'Ownership' },
        { id: 'coupling', label: 'Coupling' },
        { id: 'commit-graph', label: 'Graph' },
        { id: 'scatter', label: 'Scatter' },
        { id: 'timeline', label: 'Timeline' },
        { id: 'swimlanes', label: 'Swimlanes' },
      ];
  }
}

interface ShellProps {
  report: GitrelicReport;
}

export function Shell({ report }: ShellProps) {
  const selection = useSelection();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('default');
  const visibility = computeVisibility(layoutMode);
  const heroVizzes = getHeroVizzes(selection.dashboardMode);

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--surface-primary)',
      }}
    >
      {/* Top bar */}
      <TopBar report={report} layoutMode={layoutMode} onLayoutModeChange={setLayoutMode} />

      {/* Body: sidebar + center + inspector */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left sidebar */}
        {visibility.sidebar && (
          <Sidebar
            report={report}
            activeItem={selection.activeNavItem}
            dashboardMode={selection.dashboardMode}
            onNavigate={selection.navigateTo}
            onDashboardMode={selection.setDashboardMode}
          />
        )}

        {/* Center area: metrics + hero + bottom */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {visibility.metricsStrip && (
            <MetricsStrip report={report} dashboardMode={selection.dashboardMode} />
          )}

          {/* Hero visualization */}
          {visibility.hero && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: 'var(--space-md)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Repository Map
                </span>
                <div
                  style={{
                    display: 'flex',
                    gap: 2,
                    background: 'var(--surface-tertiary)',
                    borderRadius: 6,
                    padding: 2,
                  }}
                >
                  {heroVizzes.map((viz) => (
                    <span
                      key={viz.id}
                      onClick={() => selection.setActiveHeroViz(viz.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 10,
                        cursor: 'pointer',
                        color:
                          selection.activeHeroViz === viz.id
                            ? 'var(--text-primary)'
                            : 'var(--text-secondary)',
                        background:
                          selection.activeHeroViz === viz.id
                            ? 'var(--surface-elevated)'
                            : 'transparent',
                      }}
                    >
                      {viz.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {selection.activeHeroViz === 'treemap' && (
                  <ChurnTreemap
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                  />
                )}
                {selection.activeHeroViz === 'ownership' && (
                  <OwnershipBubble
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
              </div>
            </div>
          )}

          {/* Bottom panel */}
          {visibility.bottomPanel && (
            <BottomPanel
              report={report}
              activeGroup={selection.activeGroup}
              activeTab={selection.activeBottomTab}
              onTabChange={selection.setActiveBottomTab}
              selectedFile={selection.selectedFile}
              onSelectFile={selection.selectFile}
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
