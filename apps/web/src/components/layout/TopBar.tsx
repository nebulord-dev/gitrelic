import { fmt } from '../theme';
import { LayoutControls } from './LayoutControls';

import type { LayoutMode } from './Shell';
import type { GitrelicReport } from '@gitrelic/core';

interface TopBarProps {
  report: GitrelicReport;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
}

export function TopBar({ report, layoutMode, onLayoutModeChange }: TopBarProps) {
  const { meta, repoName } = report;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'var(--surface-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 1,
            color: 'var(--text-primary)',
          }}
        >
          GITRELIC
        </span>
        {meta.gitrelicVersion && (
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
            v{meta.gitrelicVersion}
          </span>
        )}
        <span style={{ color: 'var(--accent-primary)', fontSize: 14 }}>{repoName}</span>
        {meta.analyzedBranch && (
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {meta.analyzedBranch}
          </span>
        )}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
          • {fmt(meta.totalCommits)} commits • {fmt(meta.totalAuthors)} authors •{' '}
          {new Date(meta.firstCommit).toLocaleDateString()} –{' '}
          {new Date(meta.lastCommit).toLocaleDateString()}
        </span>
      </div>
      <LayoutControls mode={layoutMode} onModeChange={onLayoutModeChange} />
      {/* Theme toggle hidden until light theme covers all graphs/visualizations */}
      {/* <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={toggleTheme}
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 4,
          }}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
      </div> */}
    </div>
  );
}
