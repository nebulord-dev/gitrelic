import type { GitloreReport } from "@gitlore/core";

interface GhostFilesTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function GhostFilesTab({ report, onSelectFile }: GhostFilesTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Ghost Files — {report.ghostFiles.files.length} files</div>;
}
