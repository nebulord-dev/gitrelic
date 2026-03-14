import React, { useState } from 'react';
import type { CodeloreReport } from '@codelore/core';

type Tab = 'overview' | 'churn' | 'contributors' | 'cursed' | 'age' | 'coupling';

export default function Dashboard({ report }: { report: CodeloreReport }) {
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'overview', label: 'Overview', emoji: '◎' },
    { id: 'churn', label: 'Hotspots', emoji: '🔥' },
    { id: 'contributors', label: 'Contributors', emoji: '👥' },
    { id: 'cursed', label: 'Cursed Files', emoji: '☠' },
    { id: 'age', label: 'Age Map', emoji: '⏳' },
    { id: 'coupling', label: 'Coupling', emoji: '🔗' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-purple-400 font-bold text-xl tracking-wider">CODELORE</h1>
            <p className="text-gray-500 text-xs">git archaeology · <span className="text-gray-300">{report.repoName}</span></p>
          </div>
          <div className="flex gap-6 text-sm">
            <Stat label="Commits" value={report.meta.totalCommits.toLocaleString()} />
            <Stat label="Files" value={report.meta.totalFiles.toLocaleString()} />
            <Stat label="Authors" value={String(report.meta.totalAuthors)} />
            <Stat label="Age" value={`${(report.meta.ageInDays / 365).toFixed(1)}y`} />
            <Stat label="Language" value={report.meta.primaryLanguage} />
          </div>
        </div>
        {/* Tabs */}
        <nav className="flex gap-1 mt-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm rounded-t transition-colors ${
                tab === t.id
                  ? 'bg-gray-800 text-white border-t border-x border-gray-700'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        {tab === 'overview' && <OverviewTab report={report} />}
        {tab === 'churn' && <ChurnTab report={report} />}
        {tab === 'contributors' && <ContributorsTab report={report} />}
        {tab === 'cursed' && <CursedTab report={report} />}
        {tab === 'age' && <AgeTab report={report} />}
        {tab === 'coupling' && <CouplingTab report={report} />}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-gray-500 text-xs">{label}</div>
      <div className="text-white font-mono font-semibold">{value}</div>
    </div>
  );
}

function OverviewTab({ report }: { report: CodeloreReport }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <Card title="🔥 Top Hotspots" subtitle={report.hotspots.summary}>
        {report.hotspots.topHotspots.slice(0, 8).map(f => (
          <div key={f.file} className="flex items-center gap-3 py-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hotspotDot(f.category)}`} />
            <span className="text-gray-300 text-sm font-mono truncate flex-1">{f.file}</span>
            <span className="text-gray-500 text-xs flex-shrink-0">{f.hotspotScore}</span>
          </div>
        ))}
      </Card>

      <Card title="☠ Cursed Files" subtitle={`${report.cursedFiles.length} files flagged`}>
        {report.cursedFiles.length === 0 ? (
          <p className="text-green-400 text-sm">No cursed files found. Clean history!</p>
        ) : report.cursedFiles.slice(0, 5).map(f => (
          <div key={f.file} className="py-2 border-b border-gray-800 last:border-0">
            <div className="flex justify-between items-center">
              <span className="text-red-300 text-sm font-mono truncate">{f.file}</span>
              <span className="text-red-500 text-xs ml-2 flex-shrink-0">{f.curseScore}/100</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">{f.narrative}</p>
          </div>
        ))}
      </Card>

      <Card title="👥 Contributors" subtitle={report.contributors.summary}>
        {report.contributors.contributors.slice(0, 8).map(c => (
          <div key={c.email} className="flex items-center gap-3 py-1">
            <span className={`text-xs ${c.isActive ? 'text-green-400' : 'text-gray-600'}`}>●</span>
            <span className="text-gray-300 text-sm flex-1 truncate">{c.name}</span>
            <span className="text-gray-500 text-xs">{c.commitCount} commits</span>
          </div>
        ))}
      </Card>

      <Card title="⚠ Bus Factor Risk" subtitle={report.busFactors.summary}>
        {report.busFactors.criticalFiles.length === 0 ? (
          <p className="text-green-400 text-sm">No single-author hotspots found.</p>
        ) : report.busFactors.criticalFiles.slice(0, 6).map(f => (
          <div key={f.file} className="flex items-center gap-3 py-1">
            <span className="text-red-400 text-xs">⚠</span>
            <span className="text-gray-300 text-sm font-mono truncate flex-1">{f.file}</span>
            <span className="text-gray-500 text-xs">{f.dominantAuthorPercent}%</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ChurnTab({ report }: { report: CodeloreReport }) {
  return (
    <div>
      <p className="text-gray-400 mb-4 text-sm">{report.hotspots.summary}</p>
      <div className="space-y-1">
        {report.hotspots.files.slice(0, 50).map(f => (
          <div key={f.file} className="flex items-center gap-3 py-1 hover:bg-gray-900 rounded px-2">
            <div className={`h-3 rounded ${hotspotBar(f.category)}`} style={{ width: `${f.hotspotScore * 2}px`, minWidth: '4px' }} />
            <span className="text-gray-300 text-sm font-mono flex-1">{f.file}</span>
            <span className="text-gray-500 text-xs">{f.loc} LOC</span>
            <span className="text-gray-500 text-xs">{f.churnScore} churn</span>
            <span className={`text-xs px-2 py-0.5 rounded ${hotspotBadge(f.category)}`}>{f.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CouplingTab({ report }: { report: CodeloreReport }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (report.coupling.pairs.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔗</div>
        <p className="text-green-400 text-lg">No temporal coupling detected</p>
        <p className="text-gray-500 text-sm mt-2">Files change independently — clean architecture</p>
      </div>
    );
  }

  const selectedProfile = selectedFile
    ? report.coupling.fileProfiles.find(p => p.file === selectedFile)
    : null;

  return (
    <div>
      <p className="text-gray-400 mb-4 text-sm">{report.coupling.summary}</p>

      <h3 className="text-white font-semibold mb-2">Strongest Pairs</h3>
      <div className="space-y-2 mb-6">
        {report.coupling.topPairs.map(p => (
          <div key={`${p.fileA}-${p.fileB}`} className="bg-gray-900 border border-gray-800 rounded p-3">
            <div className="flex items-center gap-3">
              <div className="h-3 rounded bg-blue-600" style={{ width: `${p.couplingStrength * 1.5}px`, minWidth: '4px' }} />
              <span className="text-blue-400 font-bold text-sm">{p.couplingStrength}%</span>
              <button onClick={() => setSelectedFile(p.fileA)} className="text-gray-300 text-sm font-mono truncate hover:text-blue-300">{p.fileA}</button>
              <span className="text-gray-500">↔</span>
              <button onClick={() => setSelectedFile(p.fileB)} className="text-gray-300 text-sm font-mono truncate hover:text-blue-300">{p.fileB}</button>
            </div>
            <div className="mt-1 flex gap-4 text-xs text-gray-500">
              <span>{p.coCommits} shared commits</span>
              <span>{p.fileA.split('/').pop()}: {p.totalCommitsA} total</span>
              <span>{p.fileB.split('/').pop()}: {p.totalCommitsB} total</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-white font-semibold mb-2">Per-File View</h3>
      <div className="flex gap-4">
        <div className="w-1/3 space-y-1 max-h-96 overflow-auto">
          {report.coupling.fileProfiles.map(p => (
            <button
              key={p.file}
              onClick={() => setSelectedFile(p.file)}
              className={`w-full text-left px-2 py-1 rounded text-sm font-mono truncate ${
                selectedFile === p.file ? 'bg-blue-900 text-blue-300' : 'text-gray-400 hover:bg-gray-900'
              }`}
            >
              {p.file}
              <span className="text-gray-500 ml-2">{p.partners.length}</span>
            </button>
          ))}
        </div>
        <div className="flex-1">
          {selectedProfile ? (
            <div className="bg-gray-900 border border-gray-800 rounded p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-white font-mono text-sm">{selectedProfile.file}</span>
                <span className="text-blue-400 text-sm">{selectedProfile.partners.length} partner{selectedProfile.partners.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {selectedProfile.partners.map(p => {
                  const partner = p.fileA === selectedProfile.file ? p.fileB : p.fileA;
                  return (
                    <div key={partner} className="flex items-center gap-3">
                      <span className="text-blue-400 text-sm w-12 text-right">{p.couplingStrength}%</span>
                      <div className="h-2 rounded bg-blue-600" style={{ width: `${p.couplingStrength}px` }} />
                      <button onClick={() => setSelectedFile(partner)} className="text-gray-300 text-sm font-mono truncate hover:text-blue-300">{partner}</button>
                      <span className="text-gray-500 text-xs">{p.coCommits} commits</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm p-4">Click a file to see its coupling partners</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContributorsTab({ report }: { report: CodeloreReport }) {
  return (
    <div>
      <p className="text-gray-400 mb-4 text-sm">{report.contributors.summary}</p>
      <div className="grid gap-3">
        {report.contributors.contributors.map(c => (
          <div key={c.email} className="bg-gray-900 border border-gray-800 rounded p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${c.isActive ? 'text-green-400' : 'text-gray-600'}`}>●</span>
                  <span className="text-white font-semibold">{c.name}</span>
                  {!c.isActive && <span className="text-gray-500 text-xs">ghost</span>}
                </div>
                <p className="text-gray-500 text-xs mt-1">{c.email}</p>
              </div>
              <div className="text-right">
                <div className="text-white font-mono font-bold">{c.commitCount}</div>
                <div className="text-gray-500 text-xs">commits</div>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-gray-500">
              <span>{c.activeDays} active days</span>
              <span>{c.filesOwned} files owned</span>
              <span>Focus: {c.focusAreas.slice(0, 2).join(', ') || '-'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CursedTab({ report }: { report: CodeloreReport }) {
  if (report.cursedFiles.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">✨</div>
        <p className="text-green-400 text-lg">No cursed files found</p>
        <p className="text-gray-500 text-sm mt-2">Clean history — no red flags in churn, ownership, or age patterns</p>
      </div>
    );
  }

  const emailToName = new Map(
    report.contributors.contributors.map(c => [c.email, c.name])
  );

  const fileToAuthors = new Map(
    report.busFactors.files.map(bf => [
      bf.file,
      bf.authors.map(email => emailToName.get(email) ?? email),
    ])
  );

  return (
    <div className="space-y-4">
      {report.cursedFiles.map(f => {
        const authorNames = fileToAuthors.get(f.file) ?? [];
        return (
          <div key={f.file} className="bg-gray-900 border border-red-900 rounded p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-red-300 font-mono text-sm">{f.file}</span>
              <span className="text-red-500 font-bold text-lg">{f.curseScore}/100</span>
            </div>
            <p className="text-gray-400 text-sm mb-3 italic">"{f.narrative}"</p>
            <div className="flex flex-wrap gap-2">
              {f.reasons.map((r, i) => (
                <span key={i} className={`text-xs px-2 py-1 rounded ${reasonBadge(r)}`}>{r}</span>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-gray-500">
              <span>🔥 {f.churn} commits</span>
              <span className="relative group cursor-help">
                <span>👥 {f.authors} authors</span>
                {authorNames.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 z-10 hidden group-hover:block">
                    <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 shadow-lg whitespace-nowrap">
                      <p className="text-gray-400 text-xs font-semibold mb-1 uppercase tracking-wide">Authors</p>
                      {authorNames.map((name, i) => (
                        <p key={i} className="text-gray-200 text-xs">{name}</p>
                      ))}
                    </div>
                  </div>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgeTab({ report }: { report: CodeloreReport }) {
  return (
    <div>
      <p className="text-gray-400 mb-4 text-sm">{report.ageMap.summary}</p>
      <div className="grid grid-cols-4 gap-4 mb-6 text-center">
        {(['fresh', 'aging', 'stale', 'ancient'] as const).map(status => {
          const count = report.ageMap.files.filter(f => f.status === status).length;
          return (
            <div key={status} className={`bg-gray-900 border rounded p-3 ${ageBorder(status)}`}>
              <div className="text-xl font-bold text-white">{count}</div>
              <div className={`text-xs ${ageColor(status)}`}>{status}</div>
            </div>
          );
        })}
      </div>
      <div className="space-y-1">
        {report.ageMap.files.slice(0, 50).map(f => (
          <div key={f.file} className="flex items-center gap-3 py-1 hover:bg-gray-900 rounded px-2">
            <span className={`text-xs w-14 flex-shrink-0 ${ageColor(f.status)}`}>{f.status}</span>
            <span className="text-gray-300 text-sm font-mono flex-1">{f.file}</span>
            <span className="text-gray-500 text-xs">{f.ageInDays}d ago</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-4">
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      {subtitle && <p className="text-gray-500 text-xs mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

function churnDot(cat: string) {
  switch (cat) {
    case 'hot': return 'bg-red-500';
    case 'warm': return 'bg-yellow-500';
    case 'cold': return 'bg-cyan-500';
    default: return 'bg-gray-600';
  }
}

function churnBar(score: number, cat: string) {
  switch (cat) {
    case 'hot': return 'bg-red-600';
    case 'warm': return 'bg-yellow-600';
    case 'cold': return 'bg-cyan-700';
    default: return 'bg-gray-700';
  }
}

function churnBadge(cat: string) {
  switch (cat) {
    case 'hot': return 'bg-red-950 text-red-400';
    case 'warm': return 'bg-yellow-950 text-yellow-400';
    case 'cold': return 'bg-cyan-950 text-cyan-400';
    default: return 'bg-gray-800 text-gray-400';
  }
}

function ageColor(status: string) {
  switch (status) {
    case 'fresh': return 'text-green-400';
    case 'aging': return 'text-yellow-400';
    case 'stale': return 'text-orange-400';
    case 'ancient': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

function reasonBadge(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('parallel development')) return 'bg-purple-950 text-purple-300';
  if (r.includes('shame') || r.includes('revert') || r.includes('keeps breaking')) return 'bg-pink-950 text-pink-300';
  if (r.includes('author') || r.includes('ownership')) return 'bg-amber-950 text-amber-300';
  if (r.includes('modified') || r.includes('commit')) return 'bg-orange-950 text-orange-300';
  if (r.includes('changing') || r.includes('core file')) return 'bg-cyan-950 text-cyan-300';
  if (r.includes('coordination')) return 'bg-blue-950 text-blue-300';
  return 'bg-red-950 text-red-300';
}

function ageBorder(status: string) {
  switch (status) {
    case 'fresh': return 'border-green-800';
    case 'aging': return 'border-yellow-800';
    case 'stale': return 'border-orange-800';
    case 'ancient': return 'border-red-800';
    default: return 'border-gray-700';
  }
}

function hotspotDot(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-500';
    case 'warning': return 'bg-yellow-500';
    case 'moderate': return 'bg-cyan-500';
    default: return 'bg-gray-600';
  }
}

function hotspotBar(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-600';
    case 'warning': return 'bg-yellow-600';
    case 'moderate': return 'bg-cyan-700';
    default: return 'bg-gray-700';
  }
}

function hotspotBadge(cat: string) {
  switch (cat) {
    case 'critical': return 'bg-red-950 text-red-400';
    case 'warning': return 'bg-yellow-950 text-yellow-400';
    case 'moderate': return 'bg-cyan-950 text-cyan-400';
    default: return 'bg-gray-800 text-gray-400';
  }
}
