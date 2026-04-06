import type { GitloreReport } from "@gitlore/core";

interface RenamesTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function RenamesTab({ report, onSelectFile }: RenamesTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Renames — {report.renameTracking.chains.length} chains</div>;
}
