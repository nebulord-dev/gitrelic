import { useState, type ReactNode } from 'react';

import type { HotspotClusterReport, ClusterDimension } from '@gitlore/core';

const dimensionBadge: Record<ClusterDimension, string> = {
  structural: 'bg-green-950 text-green-400',
  ownership: 'bg-blue-950 text-blue-400',
  temporal: 'bg-amber-950 text-amber-400',
  'coupling-hub': 'bg-red-950 text-red-400',
};

function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-800 rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-gray-500 text-xs shrink-0">{open ? '▼' : '▶'}</span>
        <div className="min-w-0">
          <span className="text-white font-semibold text-sm">{title}</span>
          {subtitle && <p className="text-gray-500 text-xs mt-0.5 truncate">{subtitle}</p>}
        </div>
      </button>
      {open && <div className="border-t border-gray-800">{children}</div>}
    </div>
  );
}

export default function HotspotClusters({ data }: { data: HotspotClusterReport }) {
  if (data.clusters.length === 0) return null;

  return (
    <div className="space-y-4">
      {data.multiSignalFiles.length > 0 && (
        <Collapsible
          title="Multi-Signal Files"
          subtitle={`${data.multiSignalFiles.length} files flagged across multiple clusters`}
        >
          <div className="bg-red-950 p-3">
            {data.multiSignalFiles.slice(0, 10).map((f) => (
              <div key={f.file} className="flex items-center gap-2 py-1">
                <span className="text-red-400 text-sm font-mono truncate flex-1">{f.file}</span>
                <span className="text-red-500 text-xs">{f.clusterCount} clusters</span>
                <div className="flex gap-1">
                  {f.dimensions.map((d) => (
                    <span
                      key={d}
                      className={`text-xs px-1.5 py-0.5 rounded-sm ${dimensionBadge[d]}`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {data.multiSignalFiles.length > 10 && (
              <p className="text-red-500 text-xs mt-1">
                + {data.multiSignalFiles.length - 10} more
              </p>
            )}
          </div>
        </Collapsible>
      )}

      <Collapsible title="Root Cause Clusters" subtitle={data.summary}>
        <div className="space-y-3 p-4">
          {data.clusters.slice(0, 20).map((c) => (
            <div
              key={`${c.dimension}-${c.sharedTrait}`}
              className="bg-gray-900 border border-gray-800 rounded-sm p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs px-2 py-1 rounded-sm ${dimensionBadge[c.dimension]}`}>
                  {c.dimension}
                </span>
                <span className="text-white font-mono text-sm">{c.label}</span>
                <span className="text-gray-500 text-xs ml-auto">
                  {c.members.length} hotspots · score {c.clusterScore}
                </span>
              </div>
              <p className="text-gray-400 text-sm italic mb-3">"{c.narrative}"</p>
              <div className="flex flex-wrap gap-2">
                {c.members.map((m) => (
                  <span
                    key={m.file}
                    className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded-sm"
                  >
                    {m.file} <span className="text-gray-500">({m.hotspotScore})</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {data.clusters.length > 20 && (
            <p className="text-gray-500 text-sm text-center py-2">
              + {data.clusters.length - 20} more clusters
            </p>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
