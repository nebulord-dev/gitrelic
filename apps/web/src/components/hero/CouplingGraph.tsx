import { useMemo } from 'react';

import { CouplingForceGraph } from './CouplingForceGraph';
import { CouplingHeatmap } from './CouplingHeatmap';

import type { GitloreReport, CoupledPair } from '@gitlore/core';

interface CouplingGraphProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export const COUPLING_THRESHOLD = 50;

export function countUniqueFiles(pairs: CoupledPair[]): number {
  const files = new Set<string>();
  for (const p of pairs) {
    files.add(p.fileA);
    files.add(p.fileB);
  }
  return files.size;
}

export function CouplingGraph({ report, selectedFile, onSelectFile }: CouplingGraphProps) {
  return (
    <CouplingHeatmap report={report} selectedFile={selectedFile} onSelectFile={onSelectFile} />
  );
}
