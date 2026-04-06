import type { GitloreReport } from "@gitlore/core";

interface ContributorsInspectorProps {
  report: GitloreReport;
  file: string | null;
  contributor: string | null;
  onSelectFile: (file: string) => void;
}

export function ContributorsInspector({ report: _report, file: _file, contributor: _contributor, onSelectFile: _onSelectFile }: ContributorsInspectorProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Contributors inspector — Task 17
    </div>
  );
}
