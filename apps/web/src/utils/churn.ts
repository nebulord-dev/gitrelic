import type { ChurnCategory } from '@gitrelic/core';

// Maps churn categories to the severity tokens used by the shared `Badge`
// component and the `categoryColor` palette, so all churn surfaces
// (ChurnBar tooltips, ChurnTab badges, future ones) agree on what
// each category looks like.
export function severityForChurn(
  category: ChurnCategory,
): 'critical' | 'warning' | 'moderate' | 'healthy' {
  switch (category) {
    case 'hot':
      return 'critical';
    case 'warm':
      return 'warning';
    case 'cold':
      return 'moderate';
    case 'frozen':
      return 'healthy';
  }
}
