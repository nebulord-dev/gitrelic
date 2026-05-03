import { cn } from '../../utils/cn';
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

const sectionLabel =
  'text-[9px] uppercase tracking-[1px] text-text-tertiary mb-1.5 mt-3.5';
const statRow = 'flex justify-between items-center py-[3px] text-[11px]';
const statLabel = 'text-text-secondary';
const statValue = 'font-mono text-text-primary font-medium';

export function ActivityInspector({ report, file }: ActivityInspectorProps) {
  const churn = report.churn.files.find((f) => f.file === file);
  const velocity = report.churnVelocity.files.find((f) => f.file === file);
  const forensics = report.forensics.files.find((f) => f.file === file);
  const bf = report.busFactors.files.find((f) => f.file === file);
  const age = report.ageMap.files.find((f) => f.file === file);

  return (
    <div>
      {/* File header */}
      <div className="text-xs font-mono text-text-primary font-semibold mb-1">
        {fileName(file)}
      </div>

      {/* Churn */}
      <div className={sectionLabel}>Churn</div>
      <div className={statRow}>
        <span className={statLabel}>Commits</span>
        <span className={statValue}>{churn?.commitCount ?? 0}</span>
      </div>
      {age && (
        <div className={statRow}>
          <span className={statLabel}>Last modified</span>
          <span className={cn(statValue, 'text-[10px]')}>
            {age.lastCommitDate.split('T')[0]}
          </span>
        </div>
      )}

      {/* Velocity */}
      {velocity && (
        <>
          <div className={sectionLabel}>Velocity</div>
          <div className={statRow}>
            <span className={statLabel}>Trend</span>
            <Badge variant={trendVariant(velocity.trend)}>
              {velocity.trend}
            </Badge>
          </div>
          <div className={statRow}>
            <span className={statLabel}>Score</span>
            <span className={statValue}>{velocity.velocityScore}</span>
          </div>
          <div className={statRow}>
            <span className={statLabel}>Recent / Older</span>
            <span className={statValue}>
              {velocity.recentCommits} / {velocity.olderCommits}
            </span>
          </div>
        </>
      )}

      {/* Ownership */}
      {bf && (
        <>
          <div className={sectionLabel}>Ownership</div>
          <div className={statRow}>
            <span className={statLabel}>Authors</span>
            <span className={statValue}>{bf.uniqueAuthors}</span>
          </div>
          {bf.dominantAuthor && (
            <div className={statRow}>
              <span className={statLabel}>Dominant</span>
              <span className={cn(statValue, 'text-[10px]')}>
                {bf.dominantAuthor.split(' <')[0]} ({bf.dominantAuthorPercent}%)
              </span>
            </div>
          )}
        </>
      )}

      {/* Shame commits */}
      {forensics && forensics.topShameCommits.length > 0 && (
        <>
          <div className={sectionLabel}>Shame Commits</div>
          {forensics.topShameCommits.map((c) => (
            <div key={c.hash} className="py-1.5 border-b border-border-primary">
              <div className="text-[10px] text-text-primary mb-[3px]">
                {c.message.length > 60
                  ? `${c.message.slice(0, 60)}...`
                  : c.message}
              </div>
              <div className="flex gap-1 items-center">
                <span className="text-[9px] text-text-tertiary font-mono">
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
        <div className="text-text-tertiary text-[11px] mt-5 text-center">
          No activity data for this file
        </div>
      )}
    </div>
  );
}
