import type { FileComplexityTrend, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface ComplexityTrendTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

function trendVariant(trend: string): "critical" | "warning" | "healthy" | "stale" {
  switch (trend) {
    case "growing": return "critical";
    case "stable": return "healthy";
    case "shrinking": return "healthy";
    default: return "stale";
  }
}

export function ComplexityTrendTab({ report, onSelectFile }: ComplexityTrendTabProps) {
  const columns: Column<FileComplexityTrend>[] = [
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
      key: "trend",
      label: "Trend",
      width: "100px",
      render: (f) => <Badge variant={trendVariant(f.trend)}>{f.trend}</Badge>,
    },
    {
      key: "growthRate",
      label: "Growth Rate",
      width: "100px",
      align: "right",
      sortValue: (f) => f.recentGrowthRate,
      render: (f) => (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: f.recentGrowthRate > 0 ? "var(--severity-critical)" : "var(--severity-healthy)",
        }}>
          {f.recentGrowthRate > 0 ? "+" : ""}{f.recentGrowthRate.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "netLines",
      label: "Net Lines",
      width: "90px",
      align: "right",
      sortValue: (f) => f.totalNetLines,
      render: (f) => (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: f.totalNetLines > 0 ? "var(--severity-warning)" : "var(--text-secondary)",
        }}>
          {f.totalNetLines > 0 ? "+" : ""}{fmt(f.totalNetLines)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.complexityTrend.growingFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
