import type { Metric } from '../../presets/types';

interface MetricsStripProps {
  metrics: Metric[];
}

export function MetricsStrip({ metrics }: MetricsStripProps) {
  return (
    <div className="flex gap-px bg-border-primary border-b border-border-primary shrink-0">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex-1 px-4 py-3 bg-surface-primary text-center"
        >
          <div className="text-xl font-bold" style={{ color: m.color }}>
            {m.value}
          </div>
          <div className="text-[9px] uppercase tracking-[1px] text-text-tertiary mt-0.5">
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}
