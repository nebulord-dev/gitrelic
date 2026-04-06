import type { GitloreReport } from "@gitlore/core";

interface LanguagesTabProps {
  report: GitloreReport;
}

export function LanguagesTab({ report }: LanguagesTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Languages — {report.loc.languages.length} languages</div>;
}
