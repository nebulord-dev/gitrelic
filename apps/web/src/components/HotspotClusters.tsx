import { useState } from 'react';
import type { HotspotClusterReport } from '@gitlore/core';
import Badge from './Badge';
import { clusterVariant } from './theme';

function ClusterCard({ cluster, defaultOpen = false }: {
  cluster: HotspotClusterReport['clusters'][number];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        background: 'var(--bg2)',
        borderRadius: 6,
        padding: '12px 14px',
        marginBottom: 8,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant={clusterVariant(cluster.dimension)}>{cluster.dimension}</Badge>
          <span style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 500 }}>{cluster.label}</span>
          <span style={{ color: 'var(--fg3)', fontSize: 11, marginLeft: 'auto' }}>
            {cluster.members.length} hotspots · score {cluster.clusterScore}
          </span>
          <span style={{ color: 'var(--fg3)', fontSize: 10, marginLeft: 4 }}>{open ? '▼' : '▶'}</span>
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <p style={{ color: 'var(--fg2)', fontSize: 12, marginBottom: 8, fontStyle: 'italic' }}>
            {cluster.narrative}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {cluster.members.map(m => (
              <span
                key={m.file}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  background: 'var(--bg)',
                  color: 'var(--fg2)',
                  borderRadius: 3,
                  padding: '2px 6px',
                }}
              >
                {m.file}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HotspotClusters({ data }: { data: HotspotClusterReport }) {
  if (data.clusters.length === 0) return null;

  return (
    <div>
      <p style={{
        fontSize: 11,
        textTransform: 'uppercase',
        color: 'var(--fg3)',
        letterSpacing: '0.08em',
        marginBottom: 12,
      }}>
        Root Cause Clusters
      </p>

      {data.clusters.slice(0, 20).map((c, i) => (
        <ClusterCard key={`${c.dimension}-${c.sharedTrait}`} cluster={c} defaultOpen={i === 0} />
      ))}

      {data.clusters.length > 20 && (
        <p style={{ color: 'var(--fg3)', fontSize: 11, textAlign: 'center', paddingTop: 8 }}>
          + {data.clusters.length - 20} more clusters
        </p>
      )}
    </div>
  );
}
