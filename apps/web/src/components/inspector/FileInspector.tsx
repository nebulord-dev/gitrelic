import Badge from '../shared/Badge';
import { fileName, fmt, severityColor } from '../theme';

import type { GitloreReport } from '@gitlore/core';

interface FileInspectorProps {
  report: GitloreReport;
  file: string;
  onSelectContributor: (email: string) => void;
}

interface InspectorRow {
  label: string;
  value: string;
  color?: string;
}

function getFileData(file: string, report: GitloreReport): InspectorRow[] {
  const rows: InspectorRow[] = [];

  const hotspot = report.hotspots.topHotspots.find((h) => h.file === file);
  if (hotspot) {
    rows.push({
      label: 'Hotspot Score',
      value: String(hotspot.hotspotScore),
      color: `var(--severity-${severityColor(hotspot.category)})`,
    });
  }

  const churn = report.churn.files.find((f) => f.file === file);
  if (churn) {
    rows.push({ label: 'Churn (commits)', value: fmt(churn.commitCount) });
  }

  const loc = report.loc.files.find((f) => f.file === file);
  if (loc) {
    rows.push({ label: 'Lines of Code', value: fmt(loc.lines) });
    rows.push({ label: 'Language', value: loc.language });
  }

  const bf = report.busFactors.files.find((f) => f.file === file);
  if (bf) {
    rows.push({
      label: 'Bus Factor',
      value: `${bf.uniqueAuthors} (${bf.dominantAuthor.split('@')[0]}: ${bf.dominantAuthorPercent}%)`,
      color: bf.risk === 'critical' ? 'var(--severity-critical)' : undefined,
    });
  }

  const age = report.ageMap.files.find((f) => f.file === file);
  if (age) {
    rows.push({ label: 'Age', value: `${age.ageInDays} days (${age.status})` });
  }

  const blast = report.blastRadius.files.find((f) => f.file === file);
  if (blast) {
    rows.push({
      label: 'Blast Radius',
      value: `${blast.avgCoChangedFiles.toFixed(1)} avg files`,
      color: blast.blastScore > 50 ? 'var(--severity-warning)' : undefined,
    });
  }

  const cp = report.coupling.fileProfiles.find((f) => f.file === file);
  if (cp && cp.topPartner) {
    rows.push({
      label: 'Coupled With',
      value: `${fileName(cp.topPartner)} (${Math.round(cp.couplingScore)}%)`,
    });
  }

  const cursed = report.cursedFiles.find((f) => f.file === file);
  if (cursed) {
    rows.push({
      label: 'Curse Score',
      value: String(cursed.curseScore),
      color: 'var(--severity-critical)',
    });
  }

  const rr = report.rewriteRatio.files.find((f) => f.file === file);
  if (rr) {
    rows.push({ label: 'Rewrite Ratio', value: rr.ratio.toFixed(2) });
  }

  const sh = report.forensics.files.find((f) => f.file === file);
  if (sh && sh.shameScore > 0) {
    rows.push({
      label: 'Shame Score',
      value: String(sh.shameScore),
      color: 'var(--severity-warning)',
    });
  }

  const cv = report.churnVelocity.files.find((f) => f.file === file);
  if (cv) {
    rows.push({ label: 'Churn Trend', value: cv.trend });
  }

  const rename = report.renameTracking.chains.find((c) => c.currentPath === file);
  if (rename && rename.renameCount > 0) {
    rows.push({ label: 'Renames', value: `${rename.renameCount} times` });
  }

  return rows;
}

export function FileInspector({ report, file, onSelectContributor }: FileInspectorProps) {
  const rows = getFileData(file, report);
  const hotspot = report.hotspots.topHotspots.find((h) => h.file === file);
  const bf = report.busFactors.files.find((f) => f.file === file);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 8,
          wordBreak: 'break-all',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {file}
      </div>

      {hotspot && (
        <div style={{ marginBottom: 12 }}>
          <Badge variant={severityColor(hotspot.category)}>{hotspot.category} hotspot</Badge>
        </div>
      )}

      {/* Signal rows */}
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid var(--border-primary)',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--text-tertiary)' }}>{row.label}</span>
          <span style={{ color: row.color ?? 'var(--text-primary)', fontWeight: 500 }}>
            {row.value}
          </span>
        </div>
      ))}

      {/* Top contributors for this file */}
      {bf && bf.authors.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Top Contributors
          </div>
          {bf.authors.slice(0, 5).map((email) => {
            const contributor = report.contributors.contributors.find((c) => c.email === email);
            return (
              <div
                key={email}
                onClick={() => onSelectContributor(email)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border-primary)',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--surface-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {(contributor?.name ?? email).slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-primary)' }}>
                    {contributor?.name ?? email.split('@')[0]}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {email === bf.dominantAuthor ? `${bf.dominantAuthorPercent}%` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
