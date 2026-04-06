import type { GitloreReport } from "@gitlore/core";

interface TestCoverageTabProps {
  report: GitloreReport;
}

export function TestCoverageTab({ report }: TestCoverageTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Test Coverage — {report.testCoverage.directories.length} directories</div>;
}
