import { useCallback, useState } from 'react';

import { fmt } from '../theme';

import type { GitloreReport } from '@gitlore/core';

interface TopBarProps {
  report: GitloreReport;
}

export function TopBar({ report }: TopBarProps) {
  const { meta, repoName } = report;
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (document.documentElement.dataset.theme as 'light') || 'dark',
  );

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = next;
    }
    setTheme(next);
  }, [theme]);

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
            fontSize: 13,
            letterSpacing: 1,
            color: 'var(--text-primary)',
          }}
        >
          GITLORE
        </span>
        <span style={{ color: 'var(--accent-primary)', fontSize: 12 }}>{repoName}</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
          • {fmt(meta.totalCommits)} commits • {fmt(meta.totalAuthors)} authors •{' '}
          {Math.round((meta.ageInDays / 365) * 10) / 10}y
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ?
        </button>
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
      </div>
    </div>
  );
}
