import React, { useEffect, useState } from 'react';
import type { GitloreReport } from '@gitlore/core';
import Dashboard from './components/Dashboard.js';

export default function App() {
  const [report, setReport] = useState<GitloreReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/gitlore-report.json')
      .then(r => {
        if (!r.ok) throw new Error('No report found. Run gitlore --web to generate one.');
        return r.json() as Promise<GitloreReport>;
      })
      .then(setReport)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div style={{ fontSize: '3.75rem', marginBottom: '1rem' }}>☠</div>
          <p style={{ color: 'var(--red)', fontSize: '1.125rem' }}>{error}</p>
          <p style={{ color: 'var(--fg3)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Run: <code style={{ color: 'var(--purple)' }}>gitlore --path ./your-repo --web</code>
          </p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-pulse" style={{ color: 'var(--fg2)', fontSize: '2.25rem', marginBottom: '1rem' }}>◎</div>
          <p style={{ color: 'var(--fg3)' }}>Excavating git history...</p>
        </div>
      </div>
    );
  }

  return <Dashboard report={report} />;
}
