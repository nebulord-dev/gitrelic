import type { GitloreReport } from "@gitlore/core";

interface CommitTimingTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function CommitTimingTab({ report, onSelectFile }: CommitTimingTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Commit Timing — {report.commitTiming.stressFiles.length} files</div>;
}
