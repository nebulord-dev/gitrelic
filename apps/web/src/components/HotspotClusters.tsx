import type { HotspotClusterReport, ClusterDimension } from '@codelore/core';

const dimensionBadge: Record<ClusterDimension, string> = {
  'structural': 'bg-green-950 text-green-400',
  'ownership': 'bg-blue-950 text-blue-400',
  'temporal': 'bg-amber-950 text-amber-400',
  'coupling-hub': 'bg-red-950 text-red-400',
};

export default function HotspotClusters({ data }: { data: HotspotClusterReport }) {
  if (data.clusters.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-white font-semibold mb-1">Root Cause Clusters</h3>
      <p className="text-gray-500 text-xs mb-4">{data.summary}</p>

      {data.multiSignalFiles.length > 0 && (
        <div className="bg-red-950 border border-red-800 rounded p-3 mb-4">
          <p className="text-red-300 text-sm font-semibold mb-1">Multi-Signal Files</p>
          {data.multiSignalFiles.slice(0, 10).map(f => (
            <div key={f.file} className="flex items-center gap-2 py-1">
              <span className="text-red-400 text-sm font-mono truncate flex-1">{f.file}</span>
              <span className="text-red-500 text-xs">{f.clusterCount} clusters</span>
              <div className="flex gap-1">
                {f.dimensions.map(d => (
                  <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${dimensionBadge[d]}`}>{d}</span>
                ))}
              </div>
            </div>
          ))}
          {data.multiSignalFiles.length > 10 && (
            <p className="text-red-500 text-xs mt-1">+ {data.multiSignalFiles.length - 10} more</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {data.clusters.slice(0, 20).map(c => (
          <div key={`${c.dimension}-${c.sharedTrait}`} className="bg-gray-900 border border-gray-800 rounded p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs px-2 py-1 rounded ${dimensionBadge[c.dimension]}`}>{c.dimension}</span>
              <span className="text-white font-mono text-sm">{c.label}</span>
              <span className="text-gray-500 text-xs ml-auto">{c.members.length} hotspots · score {c.clusterScore}</span>
            </div>
            <p className="text-gray-400 text-sm italic mb-3">"{c.narrative}"</p>
            <div className="flex flex-wrap gap-2">
              {c.members.map(m => (
                <span key={m.file} className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded">
                  {m.file} <span className="text-gray-500">({m.hotspotScore})</span>
                </span>
              ))}
            </div>
          </div>
        ))}
        {data.clusters.length > 20 && (
          <p className="text-gray-500 text-sm text-center py-2">+ {data.clusters.length - 20} more clusters</p>
        )}
      </div>
    </div>
  );
}
