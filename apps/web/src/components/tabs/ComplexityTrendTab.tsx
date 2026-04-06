import type { GitloreReport } from "@gitlore/core";

interface ComplexityTrendTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function ComplexityTrendTab({ report, onSelectFile }: ComplexityTrendTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Complexity Trend — {report.complexityTrend.growingFiles.length} files</div>;
}
