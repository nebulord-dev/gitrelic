import { useState } from 'react';

import { cn } from '../../utils/cn';
import { CommitBranches } from './CommitBranches';
import { CommitDAG } from './CommitDAG';
import { CommitHeatmap } from './CommitHeatmap';

import type { GitrelicReport } from '@gitrelic/core';

interface CommitGraphProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export type CommitGraphMode = 'dag' | 'branches' | 'heatmap';

const COMMIT_THRESHOLD = 500;

export function getDefaultMode(commitCount: number): CommitGraphMode {
  return commitCount <= COMMIT_THRESHOLD ? 'dag' : 'heatmap';
}

const MODE_LABELS: Record<CommitGraphMode, string> = {
  dag: 'DAG',
  branches: 'Branches',
  heatmap: 'Heatmap',
};

export function CommitGraph({
  report,
  selectedFile,
  onSelectFile,
}: CommitGraphProps) {
  const commits = report.commits ?? [];
  const [mode, setMode] = useState<CommitGraphMode>(() =>
    getDefaultMode(commits.length),
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative shrink-0 mb-2">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="bg-surface-tertiary border border-border-primary rounded px-2.5 py-1 text-[10px] text-text-primary cursor-pointer flex items-center gap-1"
        >
          {MODE_LABELS[mode]}
          <span className="text-[8px] text-text-tertiary">▾</span>
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-0.5 bg-surface-elevated border border-border-primary rounded p-0.5 z-10">
            {(['dag', 'branches', 'heatmap'] as CommitGraphMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setDropdownOpen(false);
                }}
                className={cn(
                  'block w-full px-3 py-1.5 text-[10px] border-none text-text-primary cursor-pointer text-left rounded-[3px]',
                  m === mode ? 'bg-surface-tertiary' : 'bg-transparent',
                )}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {mode === 'dag' && (
          <CommitDAG
            commits={commits}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        )}
        {mode === 'branches' && (
          <CommitBranches
            commits={commits}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        )}
        {mode === 'heatmap' && <CommitHeatmap commits={commits} />}
      </div>
    </div>
  );
}
