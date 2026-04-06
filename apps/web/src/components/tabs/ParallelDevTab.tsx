import type { FileParallelDev, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath } from "../theme";

interface ParallelDevTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function ParallelDevTab({ report, onSelectFile }: ParallelDevTabProps) {
  const columns: Column<FileParallelDev>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span
            style={{
              color: "var(--text-tertiary)",
              marginLeft: 6,
              fontSize: 10,
            }}
          >
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: "score",
      label: "Score",
      width: "80px",
      align: "right",
      sortValue: (f) => f.parallelScore,
      render: (f) => (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--severity-warning)",
            fontWeight: 600,
          }}
        >
          {f.parallelScore}
        </span>
      ),
    },
    {
      key: "weeks",
      label: "Parallel Weeks",
      width: "100px",
      align: "right",
      sortValue: (f) => f.parallelWeeks,
      render: (f) => (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          {f.parallelWeeks}/{f.totalActiveWeeks}
        </span>
      ),
    },
    {
      key: "peak",
      label: "Peak Authors",
      width: "90px",
      align: "right",
      sortValue: (f) => f.peakAuthors,
      render: (f) => (
        <Badge variant="parallel">{f.peakAuthors} authors</Badge>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.parallelDev.hotFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
