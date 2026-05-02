import { useState } from 'react';

import { cn } from '../../utils/cn';
import { ActivityInspector } from '../inspector/ActivityInspector';
import { ContributorsInspector } from '../inspector/ContributorsInspector';
import { FileInspector } from '../inspector/FileInspector';
import { GuidePanel } from '../inspector/GuidePanel';

import type { InspectorTab } from '../../hooks/useSelection';
import type { GitrelicReport } from '@gitrelic/core';

interface InspectorPanelProps {
  report: GitrelicReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
}

const CONTEXT_TABS: { id: InspectorTab; label: string }[] = [
  { id: 'file', label: 'Inspector' },
  { id: 'contributors', label: 'Contributors' },
  { id: 'activity', label: 'Activity' },
];

type UtilityTab = 'guide' | 'narrative' | 'refactor';

const UTILITY_TABS: { id: UtilityTab; label: string }[] = [
  { id: 'guide', label: 'Guide' },
  { id: 'narrative', label: 'Narrative' },
  { id: 'refactor', label: 'Refactor' },
];

function TabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 text-center py-2 px-1 text-[10px] border-none bg-transparent cursor-pointer border-b-2',
        isActive
          ? 'text-text-primary border-accent-primary'
          : 'text-text-tertiary border-transparent',
      )}
    >
      {children}
    </button>
  );
}

export function InspectorPanel({
  report,
  selectedFile,
  selectedContributor,
  activeTab,
  onTabChange,
  onSelectFile,
  onSelectContributor,
}: InspectorPanelProps) {
  const hasSelection = selectedFile != null || selectedContributor != null;
  const [utilityTab, setUtilityTab] = useState<UtilityTab>('guide');

  return (
    <div className="w-[260px] min-w-[260px] border-l border-border-primary bg-surface-primary flex flex-col shrink-0">
      {/* ─── Top: Context tabs ─── */}
      <div className="flex border-b border-border-primary shrink-0">
        {CONTEXT_TABS.map((tab) => (
          <TabButton
            key={tab.id}
            isActive={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      {/* Top content */}
      <div className="flex-1 overflow-auto p-3 min-h-0">
        {!hasSelection ? (
          <div className="text-text-tertiary text-[11px] text-center mt-10">
            Select a file or contributor to inspect
          </div>
        ) : activeTab === 'file' && selectedFile ? (
          <FileInspector
            report={report}
            file={selectedFile}
            onSelectContributor={onSelectContributor}
          />
        ) : activeTab === 'contributors' ? (
          <ContributorsInspector
            report={report}
            file={selectedFile}
            contributor={selectedContributor}
            onSelectFile={onSelectFile}
          />
        ) : activeTab === 'activity' && selectedFile ? (
          <ActivityInspector report={report} file={selectedFile} />
        ) : (
          <div className="text-text-tertiary text-[11px] text-center mt-10">
            Select a file to view activity
          </div>
        )}
      </div>

      {/* ─── Bottom: Utility tabs ─── */}
      <div className="border-t border-border-primary flex flex-col h-1/2 min-h-[120px] shrink-0">
        <div className="flex border-b border-border-primary shrink-0">
          {UTILITY_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              isActive={utilityTab === tab.id}
              onClick={() => setUtilityTab(tab.id)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {utilityTab === 'guide' ? (
            <GuidePanel />
          ) : (
            <div className="text-text-tertiary text-[11px] text-center mt-5">
              {utilityTab === 'narrative'
                ? 'AI Narrative \u2014 coming soon'
                : 'Refactor Brief \u2014 coming soon'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
