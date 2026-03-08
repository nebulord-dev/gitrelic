import React, { useEffect, useState } from 'react';
import type { LoreReport } from '@lore/core';
import Dashboard from './components/Dashboard.js';

export default function App() {
  const [report, setReport] = useState<LoreReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/lore-report.json')
      .then(r => {
        if (!r.ok) throw new Error('No report found. Run lore --web to generate one.');
        return r.json() as Promise<LoreReport>;
      })
      .then(setReport)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">☠</div>
          <p className="text-red-400 text-lg">{error}</p>
          <p className="text-gray-500 mt-2 text-sm">Run: <code className="text-purple-400">lore --path ./your-repo --web</code></p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-purple-400 text-4xl mb-4 animate-pulse">◎</div>
          <p className="text-gray-400">Excavating git history...</p>
        </div>
      </div>
    );
  }

  return <Dashboard report={report} />;
}
