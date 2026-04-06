import type { GitloreReport } from "@gitlore/core";

interface FileInspectorProps {
  report: GitloreReport;
  file: string;
  onSelectContributor: (email: string) => void;
}

export function FileInspector({ report: _report, file, onSelectContributor: _onSelectContributor }: FileInspectorProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      File inspector for {file} — Task 16
    </div>
  );
}
