import type { GitloreReport } from "@gitlore/core";

interface ChurnVelocityTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function ChurnVelocityTab({ report, onSelectFile }: ChurnVelocityTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Churn Velocity — {report.churnVelocity.acceleratingFiles.length} files</div>;
}
