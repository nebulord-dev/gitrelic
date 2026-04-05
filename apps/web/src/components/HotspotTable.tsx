import { useMemo } from 'react';
import type { GitloreReport } from '@gitlore/core';
import Badge from './Badge';
import { hotspotColor, fileName, filePath, fmt } from './theme';

export default function HotspotTable({ report }: { report: GitloreReport }) {
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

  const sorted = useMemo(
    () => [...report.hotspots.files].sort((a, b) => b.hotspotScore - a.hotspotScore).slice(0, 50),
    [report]
  );

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
        Hotspot Files — Ranked by Composite Risk
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
          <span>Score</span>
          <span>Churn</span>
          <span>LOC</span>
          <span>Severity</span>
        </div>

        {/* Rows — stacked cards on mobile, grid on desktop */}
        {sorted.map(f => {
          const busFactor = busFactorMap.get(f.file);
          const churnEntry = churnMap.get(f.file);
          const shameEntry = shameMap.get(f.file);
          const multiSignal = multiSignalMap.get(f.file);

          return (
            <div key={f.file} className="hotspot-row">
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
                  <Badge variant="ownership">{busFactor.uniqueAuthors} authors</Badge>
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
          );
        })}
      </div>
    </div>
  );
}
