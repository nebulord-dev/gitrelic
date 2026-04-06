import { useState } from 'react';

import { CommitBranches } from './CommitBranches';
import { CommitDAG } from './CommitDAG';
import { CommitHeatmap } from './CommitHeatmap';

import type { GitloreReport } from '@gitlore/core';

interface CommitGraphProps {
  report: GitloreReport;
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

export function CommitGraph({ report, selectedFile, onSelectFile }: CommitGraphProps) {
  const commits = report.commits ?? [];
  const [mode, setMode] = useState<CommitGraphMode>(() => getDefaultMode(commits.length));
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flexShrink: 0, marginBottom: 8 }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            background: 'var(--surface-tertiary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 10,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {MODE_LABELS[mode]}
          <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>▾</span>
        </button>

        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 2,
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              padding: 2,
              zIndex: 10,
            }}
          >
            {(['dag', 'branches', 'heatmap'] as CommitGraphMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setDropdownOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 12px',
                  fontSize: 10,
                  border: 'none',
                  background: m === mode ? 'var(--surface-tertiary)' : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 3,
                }}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {mode === 'dag' && (
          <CommitDAG commits={commits} selectedFile={selectedFile} onSelectFile={onSelectFile} />
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
