import { useMemo, useState } from 'react';
import type { GitloreReport } from '@gitlore/core';
import Badge from './Badge';
import { hotspotColor, fileName, filePath, fmt } from './theme';
import type { StatsFilter } from './StatsBar';

type SortKey = 'score' | 'churn' | 'loc';
type SortDir = 'asc' | 'desc';

export default function HotspotTable({ report, filter }: { report: GitloreReport; filter?: StatsFilter }) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' ▼' : ' ▲';
  }
  const busFactorMap = useMemo(
    () => new Map(report.busFactors.files.map(f => [f.file, f])),
    [report]
  );
  const churnMap = useMemo(
    () => new Map(report.churn.files.map(f => [f.file, f])),
    [report]
  );
  const shameMap = useMemo(
    () => new Map(report.forensics.files.map(f => [f.file, f])),
    [report]
  );
  const parallelSet = useMemo(
    () => new Set(report.parallelDev.hotFiles.map(f => f.file)),
    [report]
  );
  const couplingSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of report.coupling.topPairs) { s.add(p.fileA); s.add(p.fileB); }
    return s;
  }, [report]);
  const multiSignalMap = useMemo(
    () => new Map(report.hotspotClusters.multiSignalFiles.map(f => [f.file, f])),
    [report]
  );
  const emailToName = useMemo(
    () => new Map(report.contributors.contributors.map(c => [c.email, c.name])),
    [report]
  );
  const couplingProfileMap = useMemo(
    () => new Map(report.coupling.fileProfiles.map(p => [p.file, p])),
    [report]
  );

  const sorted = useMemo(() => {
    const files = [...report.hotspots.files].slice(0, 50);
    const mul = sortDir === 'desc' ? -1 : 1;
    return files.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case 'churn':
          va = churnMap.get(a.file)?.commitCount ?? 0;
          vb = churnMap.get(b.file)?.commitCount ?? 0;
          break;
        case 'loc':
          va = a.loc; vb = b.loc;
          break;
        default:
          va = a.hotspotScore; vb = b.hotspotScore;
      }
      return mul * (va - vb);
    });
  }, [report, sortKey, sortDir, churnMap]);

  const cursedSet = useMemo(
    () => new Set(report.cursedFiles.map(f => f.file)),
    [report]
  );
  const busFactorCriticalSet = useMemo(
    () => new Set(report.busFactors.criticalFiles.map(f => f.file)),
    [report]
  );

  const filtered = useMemo(() => {
    if (!filter) return sorted;
    return sorted.filter(f => {
      switch (filter) {
        case 'critical': return f.category === 'critical';
        case 'warning': return f.category === 'warning';
        case 'cursed': return cursedSet.has(f.file);
        case 'busfactor': return busFactorCriticalSet.has(f.file);
        default: return true;
      }
    });
  }, [sorted, filter, cursedSet, busFactorCriticalSet]);

  if (sorted.length === 0) return null;

  return (
    <div>
      <p style={{
        fontSize: 11,
        textTransform: 'uppercase',
        color: 'var(--fg3)',
        letterSpacing: '0.08em',
        marginBottom: 12,
      }}>
        Hotspot Files — {filter ? `Filtered: ${filter}` : 'Ranked by Composite Risk'}
      </p>

      <div style={{ width: '100%', maxHeight: 520, overflowY: 'auto' }}>
        {/* Header — hidden on mobile, grid on desktop */}
        <div className="hotspot-header" style={{
          padding: '6px 12px',
          fontSize: 11,
          textTransform: 'uppercase' as const,
          color: 'var(--fg3)',
          letterSpacing: '0.06em',
          borderBottom: '0.5px solid var(--border)',
        }}>
          <span>File</span>
          <span>Signals</span>
          <span onClick={() => toggleSort('score')} style={{ cursor: 'pointer' }}>Score{sortIndicator('score')}</span>
          <span onClick={() => toggleSort('churn')} style={{ cursor: 'pointer' }}>Churn{sortIndicator('churn')}</span>
          <span onClick={() => toggleSort('loc')} style={{ cursor: 'pointer' }}>LOC{sortIndicator('loc')}</span>
          <span>Severity</span>
        </div>

        {/* Rows — stacked cards on mobile, grid on desktop */}
        {filtered.map(f => {
          const busFactor = busFactorMap.get(f.file);
          const churnEntry = churnMap.get(f.file);
          const shameEntry = shameMap.get(f.file);
          const multiSignal = multiSignalMap.get(f.file);

          const isExpanded = expandedFile === f.file;
          const couplingProfile = couplingProfileMap.get(f.file);

          return (
            <div key={f.file}>
            <div
              className="hotspot-row"
              onClick={() => setExpandedFile(isExpanded ? null : f.file)}
              style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg2)' : undefined }}
            >
              {/* File */}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--fg)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {fileName(f.file)}
                </div>
                {filePath(f.file) && (
                  <div style={{
                    fontSize: 11,
                    color: 'var(--fg3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {filePath(f.file)}
                  </div>
                )}
              </div>

              {/* Signals */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                {(f.category === 'critical' || f.category === 'warning') && (
                  <Badge variant={f.category}>{f.category}</Badge>
                )}
                {busFactor && busFactor.uniqueAuthors >= 3 && (
                  <span className="tooltip-wrap">
                    <Badge variant="ownership">{busFactor.uniqueAuthors} authors</Badge>
                    <span className="tooltip">
                      {busFactor.authors.map(email => emailToName.get(email) ?? email).join(', ')}
                    </span>
                  </span>
                )}
                {couplingSet.has(f.file) && (
                  <Badge variant="coupling">coupling hub</Badge>
                )}
                {multiSignal && (
                  <Badge variant="coupling">{multiSignal.clusterCount} clusters</Badge>
                )}
                {shameEntry && shameEntry.shameScore > 30 && (
                  <Badge variant="shame">fix churn</Badge>
                )}
                {parallelSet.has(f.file) && (
                  <Badge variant="parallel">parallel dev</Badge>
                )}
              </div>

              {/* Stats — flex row on mobile, display:contents on desktop (fills grid cells) */}
              <div className="hotspot-row-stats">
                {/* Score */}
                <div style={{ width: 80 }}>
                  <div style={{
                    height: 4,
                    width: '100%',
                    background: 'var(--bg3)',
                    borderRadius: 2,
                    marginBottom: 4,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${f.hotspotScore}%`,
                      background: hotspotColor(f.category),
                      borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg)' }}>
                    {fmt(f.hotspotScore)}
                  </span>
                </div>

                {/* Churn */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg)' }}>
                  {churnEntry ? fmt(churnEntry.commitCount) : '—'}
                </div>

                {/* LOC */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg)' }}>
                  {fmt(f.loc)}
                </div>

                {/* Severity */}
                <div style={{ marginLeft: 'auto' }}>
                  {(f.category === 'critical' || f.category === 'warning') ? (
                    <Badge variant={f.category}>{f.category}</Badge>
                  ) : (
                    <Badge variant="stale">{f.category}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Detail panel */}
            {isExpanded && (
              <div style={{
                padding: '12px 16px',
                background: 'var(--bg2)',
                borderBottom: '0.5px solid var(--border)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                fontSize: 12,
              }}>
                {/* Bus factor */}
                {busFactor && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg3)', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Ownership
                    </div>
                    <div style={{ color: 'var(--fg2)', marginBottom: 4 }}>
                      {busFactor.uniqueAuthors} author{busFactor.uniqueAuthors !== 1 ? 's' : ''} · dominant: {emailToName.get(busFactor.dominantAuthor) ?? busFactor.dominantAuthor} ({busFactor.dominantAuthorPercent}%)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {busFactor.authors.slice(0, 6).map(email => (
                        <span key={email} style={{
                          fontSize: 10,
                          background: 'var(--bg)',
                          color: 'var(--fg2)',
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {emailToName.get(email) ?? email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coupling partners */}
                {couplingProfile && couplingProfile.partners.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg3)', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Coupled with
                    </div>
                    {couplingProfile.partners.slice(0, 4).map(p => {
                      const partner = p.fileA === f.file ? p.fileB : p.fileA;
                      return (
                        <div key={partner} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{p.couplingStrength}%</span>
                          <span style={{ color: 'var(--fg2)', fontFamily: 'var(--font-mono)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName(partner)}</span>
                          <span style={{ color: 'var(--fg3)', fontSize: 10 }}>{p.coCommits} commits</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Shame commits */}
                {shameEntry && shameEntry.shameScore > 0 && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg3)', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Shame ({shameEntry.shameScore}/100)
                    </div>
                    {shameEntry.topShameCommits.slice(0, 3).map(c => (
                      <div key={c.hash} style={{ color: 'var(--fg2)', fontFamily: 'var(--font-mono)', fontSize: 10, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        "{c.message}"
                      </div>
                    ))}
                    <div style={{ color: 'var(--fg3)', fontSize: 10, marginTop: 4 }}>
                      {shameEntry.dominantKeywords.join(', ')}
                    </div>
                  </div>
                )}

                {/* Churn velocity */}
                {churnEntry && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--fg3)', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Activity
                    </div>
                    <div style={{ color: 'var(--fg2)' }}>
                      {fmt(churnEntry.commitCount)} commits · {fmt(f.loc)} lines
                    </div>
                    <div style={{ color: 'var(--fg2)', marginTop: 2 }}>
                      Hotspot score: {f.hotspotScore}/100 ({f.category})
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
