import type { GitloreReport } from "@gitlore/core";

interface HotspotsTabProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function HotspotsTab({ report: _report, selectedFile: _selectedFile, onSelectFile: _onSelectFile }: HotspotsTabProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Hotspots tab — Task 8
    </div>
  );
}
