import type { GitloreReport } from "@gitlore/core";

interface AgeMapTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function AgeMapTab({ report: _report, onSelectFile: _onSelectFile }: AgeMapTabProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Age Map tab — coming soon
    </div>
  );
}
