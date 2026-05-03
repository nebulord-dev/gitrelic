import { useEffect, useState } from 'react';

import { Shell } from './components/layout/Shell';
import { normalizeReport } from './utils/normalizeReport';

import type { GitrelicReport } from '@gitrelic/core';

export default function App() {
  const [report, setReport] = useState<GitrelicReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/gitrelic-report.json')
      .then((r) => {
        if (!r.ok)
          throw new Error(
            'No report found. Run gitrelic --web to generate one.',
          );
        return r.json().catch(() => {
          throw new Error('Report file is malformed. Re-run gitrelic --web.');
        }) as Promise<Partial<GitrelicReport>>;
      })
      .then((raw) => setReport(normalizeReport(raw)))
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-3 text-text-secondary">
        <div className="text-[32px]">☠</div>
        <div>{error}</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-3 text-text-secondary">
        <div className="text-lg">◌</div>
        <div className="text-xs">Excavating git history...</div>
      </div>
    );
  }

  return <Shell report={report} />;
}
