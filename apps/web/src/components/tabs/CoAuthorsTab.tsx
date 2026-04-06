import type { GitloreReport } from "@gitlore/core";

interface CoAuthorsTabProps {
  report: GitloreReport;
}

export function CoAuthorsTab({ report }: CoAuthorsTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Co-Authors — {report.coAuthors.pairs.length} pairs</div>;
}
