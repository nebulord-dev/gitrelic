import type { GitloreReport } from "@gitlore/core";

interface BlastRadiusTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function BlastRadiusTab({ report, onSelectFile }: BlastRadiusTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Blast Radius — {report.blastRadius.topBlasters.length} files</div>;
}
