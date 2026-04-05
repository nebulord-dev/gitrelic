import type { GitloreReport } from '@gitlore/core';
import { StatsBar } from './StatsBar';
import HotspotTable from './HotspotTable';
import ContributorsSection from './ContributorsSection';
import HotspotClusters from './HotspotClusters';
import { BusFactorSection } from './BusFactorSection';
import { AgeDistribution } from './AgeDistribution';
import { ShameSection } from './ShameSection';
import { fmt } from './theme';

export default function Dashboard({ report }: { report: GitloreReport }) {
  const { meta } = report;
  const ageYears = Math.round(meta.ageInDays / 365);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 var(--space-lg)' }}>
      {/* Header */}
      <header style={{ padding: 'var(--space-lg) 0 var(--space-md) 0' }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--fg)' }}>
          {report.repoName}
        </div>
        <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg3)' }}>
          git archaeology
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg3)', marginTop: 4 }}>
          {fmt(meta.totalCommits)} commits &middot; {fmt(meta.totalFiles)} files &middot; {fmt(meta.totalAuthors)} authors &middot; {ageYears}y &middot; {meta.primaryLanguage}
        </div>
      </header>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border)' }}>
        <span
          style={{
            fontSize: 13,
            padding: '8px 16px',
            color: 'var(--fg)',
            borderBottom: '1.5px solid var(--fg)',
          }}
        >
          Dashboard
        </span>
        <span
          style={{
            fontSize: 13,
            padding: '8px 16px',
            color: 'var(--fg3)',
            borderBottom: '1.5px solid transparent',
          }}
        >
          Coupling graph
        </span>
        <span
          style={{
            fontSize: 13,
            padding: '8px 16px',
            color: 'var(--fg3)',
            borderBottom: '1.5px solid transparent',
          }}
        >
          Age map
        </span>
      </nav>

      {/* Body */}
      <div style={{ padding: 'var(--space-lg) 0' }}>
        <StatsBar report={report} />

        <div style={{ borderTop: '0.5px solid var(--border)', margin: 'var(--space-lg) 0' }} />

        <HotspotTable report={report} />

        <div style={{ borderTop: '0.5px solid var(--border)', margin: 'var(--space-lg) 0' }} />

        {/* Three-column grid */}
        <div className="grid-three">
          <ContributorsSection report={report} />
          <HotspotClusters data={report.hotspotClusters} />
          <BusFactorSection report={report} />
        </div>

        <div style={{ borderTop: '0.5px solid var(--border)', margin: 'var(--space-lg) 0' }} />

        {/* Two-column grid */}
        <div className="grid-two">
          <AgeDistribution report={report} />
          <ShameSection report={report} />
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: '0.5px solid var(--border)',
          textAlign: 'center',
          padding: 'var(--space-md) 0',
          fontSize: 11,
          color: 'var(--fg3)',
        }}
      >
        GitLore &mdash; git archaeology
      </footer>
    </div>
  );
}
