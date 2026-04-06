import type { GitloreReport } from "@gitlore/core";

interface ShameTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function ShameTab({ report: _report, onSelectFile: _onSelectFile }: ShameTabProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Shame tab — coming soon
    </div>
  );
}
