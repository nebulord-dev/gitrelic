import type { GitloreReport, LanguageBreakdown } from "@gitlore/core";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fmt } from "../theme";

interface LanguagesTabProps {
  report: GitloreReport;
}

export function LanguagesTab({ report }: LanguagesTabProps) {
  const columns: Column<LanguageBreakdown>[] = [
    {
      key: "language",
      label: "Language",
      render: (l) => (
        <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500 }}>
          {l.language}
        </span>
      ),
    },
    {
      key: "percentage",
      label: "% of Codebase",
      width: "160px",
      sortValue: (l) => l.percentage,
      render: (l) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 80, height: 4, background: "var(--surface-tertiary)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${l.percentage}%`, height: "100%", borderRadius: 2, background: "var(--accent-primary)" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", width: 40 }}>
            {l.percentage.toFixed(1)}%
          </span>
        </div>
      ),
    },
    {
      key: "files",
      label: "Files",
      width: "70px",
      align: "right",
      sortValue: (l) => l.files,
      render: (l) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(l.files)}
        </span>
      ),
    },
    {
      key: "lines",
      label: "Lines",
      width: "80px",
      align: "right",
      sortValue: (l) => l.lines,
      render: (l) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(l.lines)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.loc.languages}
      columns={columns}
      rowKey={(l) => l.language}
    />
  );
}
