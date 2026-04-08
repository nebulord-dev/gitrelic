import { useEffect, useState } from 'react';

import { Shell } from './components/layout/Shell';
import { normalizeReport } from './utils/normalizeReport';

import type { GitloreReport } from '@gitlore/core';

export default function App() {
  const [report, setReport] = useState<GitloreReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/gitlore-report.json')
      .then((r) => {
        if (!r.ok) throw new Error('No report found. Run gitlore --web to generate one.');
        return r.json() as Promise<Partial<GitloreReport>>;
      })
      .then((raw) => setReport(normalizeReport(raw)))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontSize: 32 }}>☠</div>
        <div>{error}</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontSize: 18 }}>◌</div>
        <div style={{ fontSize: 12 }}>Excavating git history...</div>
      </div>
    );
  }

  return <Shell report={report} />;
}
