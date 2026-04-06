import Badge from '../shared/Badge';
import { fileName, fmt } from '../theme';

import type { GitloreReport } from '@gitlore/core';

interface ContributorsInspectorProps {
  report: GitloreReport;
  file: string | null;
  contributor: string | null;
  onSelectFile: (file: string) => void;
}

export function ContributorsInspector({
  report,
  file,
  contributor,
  onSelectFile,
}: ContributorsInspectorProps) {
  // If a contributor is selected, show their profile
  if (contributor) {
    const person = report.contributors.contributors.find((c) => c.email === contributor);
    if (!person)
      return (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Contributor not found</div>
      );

    // Find files owned by this contributor
    const ownedFiles = report.busFactors.files.filter((f) => f.dominantAuthor === contributor);

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--surface-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            {person.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {person.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{person.email}</div>
          </div>
          {!person.isActive && <Badge variant="stale">ghost</Badge>}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid var(--border-primary)',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--text-tertiary)' }}>Commits</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {fmt(person.commitCount)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid var(--border-primary)',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--text-tertiary)' }}>Active Days</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {fmt(person.activeDays)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid var(--border-primary)',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--text-tertiary)' }}>Files Owned</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{person.filesOwned}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid var(--border-primary)',
            fontSize: 10,
          }}
        >
          <span style={{ color: 'var(--text-tertiary)' }}>Focus Areas</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {person.focusAreas.slice(0, 2).join(', ')}
          </span>
        </div>

        {ownedFiles.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Dominant Owner Of
            </div>
            {ownedFiles.slice(0, 10).map((f) => (
              <div
                key={f.file}
                onClick={() => onSelectFile(f.file)}
                style={{
                  padding: '4px 0',
                  borderBottom: '1px solid var(--border-primary)',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {fileName(f.file)}
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
                  {f.dominantAuthorPercent}%
                </span>
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
    if (!bf)
      return <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>No contributor data</div>;

    return (
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 12,
            fontFamily: 'var(--font-mono)',
            wordBreak: 'break-all',
          }}
        >
          {file}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          {bf.uniqueAuthors} contributor{bf.uniqueAuthors !== 1 ? 's' : ''}
        </div>
        {bf.authors.map((email) => {
          const person = report.contributors.contributors.find((c) => c.email === email);
          const isDominant = email === bf.dominantAuthor;
          return (
            <div
              key={email}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderBottom: '1px solid var(--border-primary)',
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
                {(person?.name ?? email).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-primary)' }}>
                  {person?.name ?? email.split('@')[0]}
                </div>
              </div>
              {isDominant && (
                <span style={{ fontSize: 10, color: 'var(--accent-ownership)', fontWeight: 500 }}>
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
    <div
      style={{ color: 'var(--text-tertiary)', fontSize: 11, textAlign: 'center', marginTop: 40 }}
    >
      Select a file or contributor
    </div>
  );
}
