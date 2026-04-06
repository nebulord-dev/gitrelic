import type { GitloreReport } from "@gitlore/core";

interface CursedFilesTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function CursedFilesTab({ report: _report, onSelectFile: _onSelectFile }: CursedFilesTabProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Cursed Files tab — coming soon
    </div>
  );
}
