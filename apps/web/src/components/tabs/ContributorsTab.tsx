import type { GitloreReport } from "@gitlore/core";

interface ContributorsTabProps {
  report: GitloreReport;
}

export function ContributorsTab({ report: _report }: ContributorsTabProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Contributors tab — coming soon
    </div>
  );
}
