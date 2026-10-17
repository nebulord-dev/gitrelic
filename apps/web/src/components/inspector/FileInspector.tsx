import { fileFacts } from '@gitrelic/scene';

import Badge from '../shared/Badge';
import { severityColor } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface FileInspectorProps {
  report: GitrelicReport;
  file: string;
  onSelectContributor: (email: string) => void;
}

export function FileInspector({
  report,
  file,
  onSelectContributor,
}: FileInspectorProps) {
  const rows = fileFacts(file, report);
  const hotspot = report.hotspots.topHotspots.find((h) => h.file === file);
  const bf = report.busFactors.files.find((f) => f.file === file);

  return (
    <div>
      {/* Header */}
      <div className="text-[11px] font-semibold text-text-primary mb-2 break-all font-mono">
        {file}
      </div>

      {hotspot && (
        <div className="mb-3">
          <Badge variant={severityColor(hotspot.category)}>
            {hotspot.category} hotspot
          </Badge>
        </div>
      )}

      {/* Signal rows */}
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex justify-between py-1.5 border-b border-border-primary text-[10px]"
        >
          <span className="text-text-tertiary">{row.label}</span>
          {/* tier picks a runtime CSS var token — kept as inline style */}
          <span
            className="font-medium"
            style={{
              color: row.tier
                ? `var(--severity-${row.tier})`
                : 'var(--text-primary)',
            }}
          >
            {row.value}
          </span>
        </div>
      ))}

      {/* Top contributors for this file */}
      {bf && bf.authors.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] text-text-tertiary mb-2">
            Top Contributors
          </div>
          {bf.authors.slice(0, 5).map((email) => {
            const contributor = report.contributors.contributors.find(
              (c) => c.email === email,
            );
            return (
              <div
                key={email}
                onClick={() => onSelectContributor(email)}
                className="flex items-center gap-2 py-1.5 border-b border-border-primary cursor-pointer"
              >
                <div className="w-[22px] h-[22px] rounded-full bg-surface-tertiary flex items-center justify-center text-[9px] text-text-secondary shrink-0">
                  {(contributor?.name ?? email).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-text-primary">
                    {contributor?.name ?? email.split('@')[0]}
                  </div>
                </div>
                <span className="text-[10px] text-text-secondary">
                  {email === bf.dominantAuthor
                    ? `${bf.dominantAuthorPercent}%`
                    : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
