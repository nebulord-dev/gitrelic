import type { GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";

interface KnowledgeSilosTabProps {
  report: GitloreReport;
}

function riskLevel(index: number): { variant: "healthy" | "warning" | "critical"; label: string } {
  if (index < 40) return { variant: "healthy", label: "Low Risk" };
  if (index < 70) return { variant: "warning", label: "Moderate Risk" };
  return { variant: "critical", label: "High Risk" };
}

export function KnowledgeSilosTab({ report }: KnowledgeSilosTabProps) {
  const kc = report.knowledgeConcentration;
  const risk = riskLevel(kc.concentrationIndex);

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ textAlign: "center", minWidth: 120 }}>
          <div style={{
            fontSize: 36,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            color: `var(--severity-${risk.variant})`,
            lineHeight: 1,
          }}>
            {kc.concentrationIndex.toFixed(0)}%
          </div>
          <div style={{ marginTop: 4 }}>
            <Badge variant={risk.variant}>{risk.label}</Badge>
          </div>
          <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Concentration Index
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          <div style={{ color: "var(--text-secondary)" }}>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>
              {kc.singleAuthorFiles}
            </span>{" "}
            of {kc.totalFiles} files have a single dominant author (80%+ commits)
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 10, maxWidth: 400 }}>
            {kc.summary}
          </div>
        </div>
      </div>
    </div>
  );
}
