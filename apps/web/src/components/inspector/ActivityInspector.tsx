import Badge from '../shared/Badge';
import { fileName } from '../theme';

import type { GitrelicReport } from '@gitrelic/core';

interface ActivityInspectorProps {
  report: GitrelicReport;
  file: string;
}

function trendVariant(trend: string): 'critical' | 'warning' | 'healthy' {
  switch (trend) {
    case 'accelerating':
      return 'critical';
    case 'stable':
      return 'warning';
    case 'decelerating':
      return 'healthy';
    default:
      return 'warning';
  }
}

const sectionLabel: React.CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: 'var(--text-tertiary)',
  marginBottom: 6,
  marginTop: 14,
};

const statRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  fontSize: 11,
};

const statLabel: React.CSSProperties = {
  color: 'var(--text-secondary)',
};

const statValue: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  fontWeight: 500,
};

export function ActivityInspector({ report, file }: ActivityInspectorProps) {
  const churn = report.churn.files.find((f) => f.file === file);
  const velocity = report.churnVelocity.files.find((f) => f.file === file);
  const forensics = report.forensics.files.find((f) => f.file === file);
  const bf = report.busFactors.files.find((f) => f.file === file);
  const age = report.ageMap.files.find((f) => f.file === file);

  return (
    <div>
      {/* File header */}
      <div
        style={{
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {fileName(file)}
      </div>

      {/* Churn */}
      <div style={sectionLabel}>Churn</div>
      <div style={statRow}>
        <span style={statLabel}>Commits</span>
        <span style={statValue}>{churn?.commitCount ?? 0}</span>
      </div>
      {age && (
        <div style={statRow}>
          <span style={statLabel}>Last modified</span>
          <span style={{ ...statValue, fontSize: 10 }}>{age.lastCommitDate.split('T')[0]}</span>
        </div>
      )}

      {/* Velocity */}
      {velocity && (
        <>
          <div style={sectionLabel}>Velocity</div>
          <div style={statRow}>
            <span style={statLabel}>Trend</span>
            <Badge variant={trendVariant(velocity.trend)}>{velocity.trend}</Badge>
          </div>
          <div style={statRow}>
            <span style={statLabel}>Score</span>
            <span style={statValue}>{velocity.velocityScore}</span>
          </div>
          <div style={statRow}>
            <span style={statLabel}>Recent / Older</span>
            <span style={statValue}>
              {velocity.recentCommits} / {velocity.olderCommits}
            </span>
          </div>
        </>
      )}

      {/* Ownership */}
      {bf && (
        <>
          <div style={sectionLabel}>Ownership</div>
          <div style={statRow}>
            <span style={statLabel}>Authors</span>
            <span style={statValue}>{bf.uniqueAuthors}</span>
          </div>
          {bf.dominantAuthor && (
            <div style={statRow}>
              <span style={statLabel}>Dominant</span>
              <span style={{ ...statValue, fontSize: 10 }}>
                {bf.dominantAuthor.split(' <')[0]} ({bf.dominantAuthorPercent}%)
              </span>
            </div>
          )}
        </>
      )}

      {/* Shame commits */}
      {forensics && forensics.topShameCommits.length > 0 && (
        <>
          <div style={sectionLabel}>Shame Commits</div>
          {forensics.topShameCommits.map((c) => (
            <div
              key={c.hash}
              style={{
                padding: '6px 0',
                borderBottom: '1px solid var(--border-primary)',
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-primary)', marginBottom: 3 }}>
                {c.message.length > 60 ? `${c.message.slice(0, 60)}...` : c.message}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {c.date.split('T')[0]}
                </span>
                {c.keywords.slice(0, 3).map((k) => (
                  <Badge key={k} variant="shame">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Empty state if no meaningful activity data */}
      {!churn && !velocity && !forensics && (
        <div
          style={{
            color: 'var(--text-tertiary)',
            fontSize: 11,
            marginTop: 20,
            textAlign: 'center',
          }}
        >
          No activity data for this file
        </div>
      )}
    </div>
  );
}
