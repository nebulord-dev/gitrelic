import { useEffect } from 'react';

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
  const heroVizzes = getHeroVizzes(selection.dashboardMode);

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
      <TopBar report={report} />

      {/* Body: sidebar + center + inspector */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left sidebar */}
        <Sidebar
          report={report}
          activeItem={selection.activeNavItem}
          dashboardMode={selection.dashboardMode}
          onNavigate={selection.navigateTo}
          onDashboardMode={selection.setDashboardMode}
        />

        {/* Center area: metrics + hero + bottom */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <MetricsStrip report={report} dashboardMode={selection.dashboardMode} />

          {/* Hero visualization */}
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

          {/* Bottom panel */}
          <BottomPanel
            report={report}
            activeGroup={selection.activeGroup}
            activeTab={selection.activeBottomTab}
            onTabChange={selection.setActiveBottomTab}
            selectedFile={selection.selectedFile}
            onSelectFile={selection.selectFile}
          />
        </div>

        {/* Right inspector */}
        <InspectorPanel
          report={report}
          selectedFile={selection.selectedFile}
          selectedContributor={selection.selectedContributor}
          activeTab={selection.activeInspectorTab}
          onTabChange={selection.setActiveInspectorTab}
          onSelectFile={selection.selectFile}
          onSelectContributor={selection.selectContributor}
        />
      </div>
    </div>
  );
}
