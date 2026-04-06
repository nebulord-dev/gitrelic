import type { DirectoryCoverage, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";

interface TestCoverageTabProps {
  report: GitloreReport;
}

export function TestCoverageTab({ report }: TestCoverageTabProps) {
  const columns: Column<DirectoryCoverage>[] = [
    {
      key: "directory",
      label: "Directory",
      render: (d) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)" }}>
          {d.directory}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "90px",
      render: (d) => (
        <Badge variant={d.hasTests ? (d.coverageRatio >= 0.5 ? "healthy" : "warning") : "critical"}>
          {d.hasTests ? (d.coverageRatio >= 0.5 ? "covered" : "low") : "untested"}
        </Badge>
      ),
    },
    {
      key: "source",
      label: "Source Files",
      width: "90px",
      align: "right",
      sortValue: (d) => d.sourceFiles,
      render: (d) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {d.sourceFiles}
        </span>
      ),
    },
    {
      key: "test",
      label: "Test Files",
      width: "80px",
      align: "right",
      sortValue: (d) => d.testFiles,
      render: (d) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {d.testFiles}
        </span>
      ),
    },
    {
      key: "ratio",
      label: "Ratio",
      width: "100px",
      align: "right",
      sortValue: (d) => d.coverageRatio,
      render: (d) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <div style={{ width: 50, height: 4, background: "var(--surface-tertiary)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(100, d.coverageRatio * 100)}%`,
              height: "100%",
              borderRadius: 2,
              background: d.coverageRatio >= 0.5 ? "var(--severity-healthy)" : "var(--severity-warning)",
            }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", width: 32, textAlign: "right" }}>
            {(d.coverageRatio * 100).toFixed(0)}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.testCoverage.directories}
      columns={columns}
      rowKey={(d) => d.directory}
    />
  );
}
