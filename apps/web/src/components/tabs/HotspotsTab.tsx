import { useState } from 'react';

import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt, severityColor } from '../theme';

import type { GitrelicReport, HotspotEntry } from '@gitrelic/core';

interface HotspotsTabProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface Signal {
  label: string;
  title?: string;
}

function getSignals(file: string, report: GitrelicReport): Signal[] {
  const signals: Signal[] = [];
  const hotspot = report.hotspots.topHotspots.find((h) => h.file === file);
  if (hotspot?.category === 'critical') signals.push({ label: 'critical' });
  else if (hotspot?.category === 'warning') signals.push({ label: 'warning' });

  const bf = report.busFactors.files.find((f) => f.file === file);
  if (bf && bf.uniqueAuthors > 1)
    signals.push({
      label: `${bf.uniqueAuthors} authors`,
      title: bf.authors.map((a) => a.split('@')[0]).join(', '),
    });
  else if (bf && bf.uniqueAuthors === 1)
    signals.push({
      label: 'single owner',
      title: bf.authors[0]?.split('@')[0],
    });

  const cp = report.coupling.fileProfiles.find((f) => f.file === file);
  if (cp && cp.partners.length > 2) signals.push({ label: 'coupling hub' });

  const pd = report.parallelDev.hotFiles.find((f) => f.file === file);
  if (pd) signals.push({ label: 'parallel dev' });

  return signals;
}

function signalVariant(
  label: string,
): 'critical' | 'warning' | 'ownership' | 'coupling' | 'parallel' {
  if (label === 'critical') return 'critical';
  if (label === 'warning') return 'warning';
  if (label.includes('author') || label === 'single owner') return 'ownership';
  if (label === 'coupling hub') return 'coupling';
  return 'parallel';
}

function ExpandedDetail({ file, report }: { file: string; report: GitrelicReport }) {
  const bf = report.busFactors.files.find((f) => f.file === file);
  const cp = report.coupling.fileProfiles.find((f) => f.file === file);
  const sh = report.forensics.files.find((f) => f.file === file);
  const churn = report.churn.files.find((f) => f.file === file);

  const cellStyle = {
    flex: 1,
    minWidth: 0,
    padding: '0 8px',
  };
  const labelStyle = {
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: 'var(--text-tertiary)',
    marginBottom: 6,
  };
  const valueStyle = { fontSize: 10, color: 'var(--text-secondary)' };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={cellStyle}>
        <div style={labelStyle}>Ownership</div>
        {bf ? (
          <div style={valueStyle}>
            {bf.uniqueAuthors} author{bf.uniqueAuthors !== 1 ? 's' : ''}
            {bf.dominantAuthor && (
              <div>
                dominant: {bf.dominantAuthor.split('@')[0]} ({bf.dominantAuthorPercent}%)
              </div>
            )}
          </div>
        ) : (
          <div style={valueStyle}>—</div>
        )}
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>Coupled With</div>
        {cp && cp.partners.length > 0 ? (
          <div style={valueStyle}>
            {cp.partners.slice(0, 3).map((p) => (
              <div key={p.fileB === file ? p.fileA : p.fileB}>
                {Math.round(p.couplingStrength)}% {fileName(p.fileB === file ? p.fileA : p.fileB)}
              </div>
            ))}
          </div>
        ) : (
          <div style={valueStyle}>—</div>
        )}
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>Shame ({sh?.shameScore ?? 0})</div>
        {sh && sh.topShameCommits.length > 0 ? (
          <div style={valueStyle}>
            <div style={{ fontStyle: 'italic' }}>
              "{sh.topShameCommits[0].message.slice(0, 40)}..."
            </div>
            <div>{sh.dominantKeywords.slice(0, 3).join(', ')}</div>
          </div>
        ) : (
          <div style={valueStyle}>—</div>
        )}
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>Activity</div>
        <div style={valueStyle}>
          {churn ? `${fmt(churn.commitCount)} commits` : '—'}
          {report.loc.files.find((f) => f.file === file) && (
            <div>{fmt(report.loc.files.find((f) => f.file === file)!.lines)} lines</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HotspotsTab({ report, selectedFile, onSelectFile }: HotspotsTabProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const columns: Column<HotspotEntry>[] = [
    {
      key: 'file',
      label: 'File',
      render: (h) => (
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-primary)',
            }}
          >
            {fileName(h.file)}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              marginLeft: 6,
            }}
          >
            {filePath(h.file)}
          </span>
        </div>
      ),
    },
    {
      key: 'signals',
      label: 'Signals',
      width: '280px',
      render: (h) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {getSignals(h.file, report).map((s) => (
            <Badge key={s.label} variant={signalVariant(s.label)} title={s.title}>
              {s.label}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      width: '120px',
      align: 'right',
      sortValue: (h) => h.hotspotScore,
      render: (h) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              width: 60,
              height: 4,
              background: 'var(--surface-tertiary)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${h.hotspotScore}%`,
                height: '100%',
                borderRadius: 2,
                background: `var(--severity-${severityColor(h.category)})`,
              }}
            />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              width: 24,
              textAlign: 'right',
            }}
          >
            {h.hotspotScore}
          </span>
        </div>
      ),
    },
    {
      key: 'churn',
      label: 'Churn',
      width: '60px',
      align: 'right',
      sortValue: (h) => h.churnScore,
      render: (h) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {h.churnScore}
        </span>
      ),
    },
    {
      key: 'loc',
      label: 'LOC',
      width: '60px',
      align: 'right',
      sortValue: (h) => h.loc,
      render: (h) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {fmt(h.loc)}
        </span>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      width: '70px',
      align: 'center',
      render: (h) => <Badge variant={severityColor(h.category)}>{h.category}</Badge>,
    },
  ];

  return (
    <SortableTable
      data={report.hotspots.topHotspots}
      columns={columns}
      rowKey={(h) => h.file}
      selectedKey={selectedFile}
      onRowClick={(h) => onSelectFile(h.file)}
      expandedKey={expandedFile}
      onRowExpand={setExpandedFile}
      renderExpanded={(h) => <ExpandedDetail file={h.file} report={report} />}
    />
  );
}
