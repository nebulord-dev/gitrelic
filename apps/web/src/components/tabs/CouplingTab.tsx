import type { GitloreReport } from "@gitlore/core";

interface CouplingTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function CouplingTab({ report: _report, onSelectFile: _onSelectFile }: CouplingTabProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Coupling tab — coming soon
    </div>
  );
}
