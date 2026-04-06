import type { GitloreReport } from "@gitlore/core";

interface RewriteRatioTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function RewriteRatioTab({ report, onSelectFile }: RewriteRatioTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Rewrite Ratio — {report.rewriteRatio.topRewriters.length} files</div>;
}
