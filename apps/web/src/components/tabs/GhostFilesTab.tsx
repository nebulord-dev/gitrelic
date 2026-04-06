import type { GhostFile, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface GhostFilesTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function GhostFilesTab({ report, onSelectFile }: GhostFilesTabProps) {
  const columns: Column<GhostFile>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      width: "140px",
      render: (f) => (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {f.dominantAuthor.split(" <")[0]}
        </span>
      ),
    },
    {
      key: "ownership",
      label: "Ownership",
      width: "90px",
      align: "right",
      sortValue: (f) => f.dominantAuthorPercent,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ownership)" }}>
          {f.dominantAuthorPercent}%
        </span>
      ),
    },
    {
      key: "inactive",
      label: "Days Inactive",
      width: "110px",
      align: "right",
      sortValue: (f) => f.authorInactiveDays,
      render: (f) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <Badge variant={f.authorInactiveDays > 180 ? "critical" : "warning"}>
            {f.authorInactiveDays > 365 ? "ghost" : "fading"}
          </Badge>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
            {fmt(f.authorInactiveDays)}d
          </span>
        </div>
      ),
    },
    {
      key: "loc",
      label: "LOC",
      width: "60px",
      align: "right",
      sortValue: (f) => f.loc,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(f.loc)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.ghostFiles.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
