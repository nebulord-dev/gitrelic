import type { GitloreReport } from "@gitlore/core";
import { fmt } from "../theme";

interface TopBarProps {
  report: GitloreReport;
}

export function TopBar({ report }: TopBarProps) {
  const { meta, repoName } = report;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        background: "var(--surface-secondary)",
        borderBottom: "1px solid var(--border-primary)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 1,
            color: "var(--text-primary)",
          }}
        >
          GITLORE
        </span>
        <span style={{ color: "var(--accent-primary)", fontSize: 12 }}>
          {repoName}
        </span>
        <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>
          • {fmt(meta.totalCommits)} commits • {fmt(meta.totalAuthors)} authors
          • {Math.round((meta.ageInDays / 365) * 10) / 10}y
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          style={{
            fontSize: 10,
            color: "var(--text-tertiary)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ?
        </button>
      </div>
    </div>
  );
}
