import Badge from '../shared/Badge';
import { fileName, fmt } from '../theme';

import type { GitrelicReport } from '@gitrelic/core';

interface ContributorsInspectorProps {
  report: GitrelicReport;
  file: string | null;
  contributor: string | null;
  onSelectFile: (file: string) => void;
}

const statRow =
  'flex justify-between items-center py-1.5 border-b border-border-primary text-[10px]';
const statLabel = 'text-text-tertiary';
const statValue = 'text-text-primary font-medium';

export function ContributorsInspector({
  report,
  file,
  contributor,
  onSelectFile,
}: ContributorsInspectorProps) {
  // If a contributor is selected, show their profile
  if (contributor) {
    const person = report.contributors.contributors.find((c) => c.email === contributor);
    if (!person) return <div className="text-text-tertiary text-[11px]">Contributor not found</div>;

    // Find files owned by this contributor
    const ownedFiles = report.busFactors.files.filter((f) => f.dominantAuthor === contributor);

    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-[28px] h-[28px] rounded-full bg-surface-tertiary flex items-center justify-center text-[11px] text-text-secondary shrink-0">
            {person.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-text-primary">{person.name}</div>
            <div className="text-[10px] text-text-tertiary">{person.email}</div>
          </div>
          {!person.isActive && <Badge variant="stale">ghost</Badge>}
        </div>

        <div className={statRow}>
          <span className={statLabel}>Commits</span>
          <span className={statValue}>{fmt(person.commitCount)}</span>
        </div>
        <div className={statRow}>
          <span className={statLabel}>Active Days</span>
          <span className={statValue}>{fmt(person.activeDays)}</span>
        </div>
        <div className={statRow}>
          <span className={statLabel}>Files Owned</span>
          <span className={statValue}>{person.filesOwned}</span>
        </div>
        <div className={statRow}>
          <span className={statLabel}>Focus Areas</span>
          <span className={statValue}>{person.focusAreas.slice(0, 2).join(', ')}</span>
        </div>

        {ownedFiles.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] text-text-tertiary mb-2">Dominant Owner Of</div>
            {ownedFiles.slice(0, 10).map((f) => (
              <div
                key={f.file}
                onClick={() => onSelectFile(f.file)}
                className="py-1 border-b border-border-primary text-[10px] font-mono text-text-primary cursor-pointer"
              >
                {fileName(f.file)}
                <span className="text-text-tertiary ml-2">{f.dominantAuthorPercent}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If a file is selected, show its contributors
  if (file) {
    const bf = report.busFactors.files.find((f) => f.file === file);
    if (!bf) return <div className="text-text-tertiary text-[11px]">No contributor data</div>;

    return (
      <div>
        <div className="text-[11px] font-semibold text-text-primary mb-3 font-mono break-all">
          {file}
        </div>
        <div className="text-[10px] text-text-tertiary mb-2">
          {bf.uniqueAuthors} contributor{bf.uniqueAuthors !== 1 ? 's' : ''}
        </div>
        {bf.authors.map((email) => {
          const person = report.contributors.contributors.find((c) => c.email === email);
          const isDominant = email === bf.dominantAuthor;
          return (
            <div
              key={email}
              className="flex items-center gap-2 py-1.5 border-b border-border-primary"
            >
              <div className="w-[22px] h-[22px] rounded-full bg-surface-tertiary flex items-center justify-center text-[9px] text-text-secondary shrink-0">
                {(person?.name ?? email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-text-primary">
                  {person?.name ?? email.split('@')[0]}
                </div>
              </div>
              {isDominant && (
                <span className="text-[10px] text-accent-ownership font-medium">
                  {bf.dominantAuthorPercent}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="text-text-tertiary text-[11px] text-center mt-10">
      Select a file or contributor
    </div>
  );
}
