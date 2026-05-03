import { severityForChurn } from '../../utils/churn';
import { categoryColor } from '../../utils/colors';
import type { ChurnCategory } from '@gitrelic/core';

interface SwatchProps {
  category: ChurnCategory;
  label: string;
  range: string;
}

function Swatch({ category, label, range }: SwatchProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="w-2 h-2 rounded-[1px] inline-block"
        style={{ background: categoryColor(severityForChurn(category), 0.85) }}
      />
      <span>
        {label} <span className="text-text-tertiary">({range})</span>
      </span>
    </span>
  );
}

export function ChurnLegend() {
  return (
    <div
      role="group"
      aria-label="Churn category legend"
      className="flex gap-3.5 text-[9px] text-text-secondary px-4 py-1"
    >
      <Swatch category="hot" label="hot" range="76+" />
      <Swatch category="warm" label="warm" range="41–75" />
      <Swatch category="cold" label="cold" range="11–40" />
      <Swatch category="frozen" label="frozen" range="≤10" />
    </div>
  );
}
