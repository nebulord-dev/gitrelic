import type { GitloreReport } from "@gitlore/core";

interface DeadCodeTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function DeadCodeTab({ report, onSelectFile }: DeadCodeTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Dead Code — {report.deadCode.candidates.length} candidates</div>;
}
