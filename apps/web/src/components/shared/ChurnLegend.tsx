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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 1,
          background: categoryColor(severityForChurn(category), 0.85),
          display: 'inline-block',
        }}
      />
      <span>
        {label} <span style={{ color: 'var(--text-tertiary)' }}>({range})</span>
      </span>
    </span>
  );
}

export function ChurnLegend() {
  return (
    <div
      role="group"
      aria-label="Churn category legend"
      style={{
        display: 'flex',
        gap: 14,
        fontSize: 9,
        color: 'var(--text-secondary)',
        padding: '4px 16px',
      }}
    >
      <Swatch category="hot" label="hot" range="≥75" />
      <Swatch category="warm" label="warm" range="40–75" />
      <Swatch category="cold" label="cold" range="10–40" />
      <Swatch category="frozen" label="frozen" range="≤10" />
    </div>
  );
}
