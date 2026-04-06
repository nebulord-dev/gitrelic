import type { GitloreReport } from "@gitlore/core";

interface KnowledgeSilosTabProps {
  report: GitloreReport;
}

export function KnowledgeSilosTab({ report }: KnowledgeSilosTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Knowledge Silos — {report.knowledgeConcentration.concentrationIndex} index</div>;
}
