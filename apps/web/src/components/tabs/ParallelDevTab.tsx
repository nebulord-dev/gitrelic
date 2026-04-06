import type { GitloreReport } from "@gitlore/core";

interface ParallelDevTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function ParallelDevTab({ report: _report, onSelectFile: _onSelectFile }: ParallelDevTabProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Parallel Dev tab — coming soon
    </div>
  );
}
