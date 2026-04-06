import type { GitloreReport } from "@gitlore/core";

interface BusFactorTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function BusFactorTab({ report: _report, onSelectFile: _onSelectFile }: BusFactorTabProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Bus Factor tab — coming soon
    </div>
  );
}
