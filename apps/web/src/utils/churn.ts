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

// Short human-readable description of each churn band, suitable for tooltips
// and explanations. Lines up with the thresholds shown in ChurnLegend.
export function churnCategoryDescription(category: ChurnCategory): string {
  switch (category) {
    case 'hot':
      return 'top tier — 76+ churn score';
    case 'warm':
      return 'mid-high tier — 41–75 churn score';
    case 'cold':
      return 'low tier — 11–40 churn score';
    case 'frozen':
      return 'rarely touched — ≤10 churn score';
  }
}
