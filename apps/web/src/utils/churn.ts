import type { ChurnCategory } from '@gitrelic/core';

// Maps ChurnCategory → BadgeVariant token, shared by ChurnBar and ChurnTab.
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

// Human-readable band description; thresholds match ChurnLegend.
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
