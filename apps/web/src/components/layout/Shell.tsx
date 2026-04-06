import { useSelection } from '../../hooks/useSelection';
import { ChurnTreemap } from '../hero/ChurnTreemap';
import { BottomPanel } from './BottomPanel';
import { InspectorPanel } from './InspectorPanel';
import { MetricsStrip } from './MetricsStrip';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

import type { GitloreReport } from '@gitlore/core';

interface ShellProps {
  report: GitloreReport;
}

export function Shell({ report }: ShellProps) {
  const selection = useSelection();

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
          onNavigate={selection.navigateTo}
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
          <MetricsStrip report={report} />

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
                {['Treemap', 'Ownership', 'Coupling', 'Graph'].map((label, i) => (
                  <span
                    key={label}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 10,
                      cursor: 'pointer',
                      color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: i === 0 ? 'var(--surface-elevated)' : 'transparent',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ChurnTreemap
                report={report}
                selectedFile={selection.selectedFile}
                onSelectFile={selection.selectFile}
              />
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
