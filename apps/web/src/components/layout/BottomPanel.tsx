import { useCallback, useEffect, useRef, useState } from 'react';

import { AgeMapTab } from '../tabs/AgeMapTab';
import { BlastRadiusTab } from '../tabs/BlastRadiusTab';
import { BusFactorTab } from '../tabs/BusFactorTab';
import { ChurnTab } from '../tabs/ChurnTab';
import { ChurnVelocityTab } from '../tabs/ChurnVelocityTab';
import { CoAuthorsTab } from '../tabs/CoAuthorsTab';
import { CommitTimingTab } from '../tabs/CommitTimingTab';
import { ComplexityTrendTab } from '../tabs/ComplexityTrendTab';
import { ContributorsTab } from '../tabs/ContributorsTab';
import { CouplingTab } from '../tabs/CouplingTab';
import { CursedFilesTab } from '../tabs/CursedFilesTab';
import { DeadCodeTab } from '../tabs/DeadCodeTab';
import { DebtInventoryTab } from '../tabs/DebtInventoryTab';
import { GhostFilesTab } from '../tabs/GhostFilesTab';
import { HotspotsTab } from '../tabs/HotspotsTab';
import { KnowledgeSilosTab } from '../tabs/KnowledgeSilosTab';
import { LanguagesTab } from '../tabs/LanguagesTab';
import { ParallelDevTab } from '../tabs/ParallelDevTab';
import { RenamesTab } from '../tabs/RenamesTab';
import { RewriteRatioTab } from '../tabs/RewriteRatioTab';
import { RiskRegisterTab } from '../tabs/RiskRegisterTab';
import { ShameTab } from '../tabs/ShameTab';
import { TestCoverageTab } from '../tabs/TestCoverageTab';

import type { BottomTab, PresetId } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

interface BottomPanelProps {
  report: GitrelicReport;
  activeTab: BottomTab;
  altTabs: BottomTab[];
  onTabChange: (tab: BottomTab) => void;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  onApplyPreset: (id: PresetId) => void;
  // When true, fill the available vertical space instead of a fixed height.
  // Used in fullscreen-table layout mode where the hero is hidden.
  fillAvailable?: boolean;
}

const TAB_LABELS: Record<BottomTab, string> = {
  hotspots: 'Hotspots',
  churn: 'Churn',
  'cursed-files': 'Cursed Files',
  'bus-factor': 'Bus Factor',
  coupling: 'Coupling',
  contributors: 'Contributors',
  'parallel-dev': 'Parallel Dev',
  shame: 'Shame',
  'age-map': 'Age Map',
  'dead-code': 'Stale Files',
  'complexity-trend': 'Complexity Trend',
  'rewrite-ratio': 'Rewrite Ratio',
  'churn-velocity': 'Churn Velocity',
  'blast-radius': 'Blast Radius',
  'ghost-files': 'Ghost Files',
  'knowledge-silos': 'Knowledge Silos',
  'co-authors': 'Co-Authors',
  'commit-timing': 'Commit Timing',
  languages: 'Languages',
  'test-coverage': 'Test Coverage',
  renames: 'Renames',
  'risk-register': 'Risk Register',
  'debt-inventory': 'Debt Inventory',
};

function TabContent({
  tab,
  report,
  selectedFile,
  onSelectFile,
  onApplyPreset,
}: {
  tab: BottomTab;
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  onApplyPreset: (id: PresetId) => void;
}) {
  switch (tab) {
    case 'hotspots':
      return (
        <HotspotsTab report={report} selectedFile={selectedFile} onSelectFile={onSelectFile} />
      );
    case 'churn':
      return (
        <ChurnTab
          report={report}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          onApplyPreset={onApplyPreset}
        />
      );
    case 'cursed-files':
      return <CursedFilesTab report={report} onSelectFile={onSelectFile} />;
    case 'bus-factor':
      return <BusFactorTab report={report} onSelectFile={onSelectFile} />;
    case 'coupling':
      return <CouplingTab report={report} onSelectFile={onSelectFile} />;
    case 'contributors':
      return <ContributorsTab report={report} />;
    case 'parallel-dev':
      return <ParallelDevTab report={report} onSelectFile={onSelectFile} />;
    case 'shame':
      return <ShameTab report={report} onSelectFile={onSelectFile} />;
    case 'age-map':
      return <AgeMapTab report={report} onSelectFile={onSelectFile} />;
    case 'dead-code':
      return <DeadCodeTab report={report} onSelectFile={onSelectFile} />;
    case 'complexity-trend':
      return <ComplexityTrendTab report={report} onSelectFile={onSelectFile} />;
    case 'rewrite-ratio':
      return <RewriteRatioTab report={report} onSelectFile={onSelectFile} />;
    case 'churn-velocity':
      return <ChurnVelocityTab report={report} onSelectFile={onSelectFile} />;
    case 'blast-radius':
      return <BlastRadiusTab report={report} onSelectFile={onSelectFile} />;
    case 'ghost-files':
      return <GhostFilesTab report={report} onSelectFile={onSelectFile} />;
    case 'knowledge-silos':
      return <KnowledgeSilosTab report={report} onApplyPreset={onApplyPreset} />;
    case 'co-authors':
      return <CoAuthorsTab report={report} />;
    case 'commit-timing':
      return <CommitTimingTab report={report} onSelectFile={onSelectFile} />;
    case 'languages':
      return <LanguagesTab report={report} />;
    case 'test-coverage':
      return <TestCoverageTab report={report} />;
    case 'renames':
      return <RenamesTab report={report} onSelectFile={onSelectFile} />;
    case 'risk-register':
      return <RiskRegisterTab report={report} onSelectFile={onSelectFile} />;
    case 'debt-inventory':
      return <DebtInventoryTab report={report} onSelectFile={onSelectFile} />;
  }
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 320;

export function BottomPanel({
  report,
  activeTab,
  altTabs,
  onTabChange,
  selectedFile,
  onSelectFile,
  onApplyPreset,
  fillAvailable = false,
}: BottomPanelProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: height };

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - e.clientY;
        const newHeight = Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, dragRef.current.startHeight + delta),
        );
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [height],
  );

  useEffect(() => {
    if (!altTabs.includes(activeTab)) {
      onTabChange(altTabs[0]);
    }
  }, [activeTab, onTabChange, altTabs]);

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-primary)',
        ...(fillAvailable ? { flex: 1, minHeight: 0 } : { height, flexShrink: 0 }),
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-primary)',
        position: 'relative',
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          top: -3,
          left: 0,
          right: 0,
          height: 6,
          cursor: 'row-resize',
          zIndex: 10,
        }}
      />

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border-primary)',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        {altTabs.map((tabId) => (
          <button
            key={tabId}
            onClick={() => onTabChange(tabId)}
            style={{
              padding: '8px 14px',
              fontSize: 10,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === tabId ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${
                activeTab === tabId ? 'var(--accent-primary)' : 'transparent'
              }`,
            }}
          >
            {TAB_LABELS[tabId]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        <TabContent
          tab={activeTab}
          report={report}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          onApplyPreset={onApplyPreset}
        />
      </div>
    </div>
  );
}
