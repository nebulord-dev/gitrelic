import { fmt } from '../theme';
import { LayoutControls } from './LayoutControls';

import type { LayoutMode } from './Shell';
import type { GitrelicReport } from '@gitrelic/core';

interface TopBarProps {
  report: GitrelicReport;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
}

export function TopBar({
  report,
  layoutMode,
  onLayoutModeChange,
}: TopBarProps) {
  const { meta, repoName } = report;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface-secondary border-b border-border-primary shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-bold text-sm tracking-[1px] text-text-primary">
          GITRELIC
        </span>
        {meta.gitrelicVersion && (
          <span className="text-text-tertiary text-sm">
            v{meta.gitrelicVersion}
          </span>
        )}
        <span className="text-accent-primary text-sm">{repoName}</span>
        {meta.analyzedBranch && (
          <span className="text-text-secondary text-sm">
            {meta.analyzedBranch}
          </span>
        )}
        <span className="text-text-tertiary text-sm">
          • {fmt(meta.totalCommits)} commits • {fmt(meta.totalAuthors)} authors
          • {new Date(meta.firstCommit).toLocaleDateString()} –{' '}
          {new Date(meta.lastCommit).toLocaleDateString()}
        </span>
      </div>
      <LayoutControls mode={layoutMode} onModeChange={onLayoutModeChange} />
      {/* Theme toggle hidden until light theme covers all graphs/visualizations */}
      {/* <div className="flex gap-3 items-center">
        <button
          onClick={toggleTheme}
          className="text-sm text-text-secondary bg-transparent border-none cursor-pointer px-1 py-0.5 rounded"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
      </div> */}
    </div>
  );
}
