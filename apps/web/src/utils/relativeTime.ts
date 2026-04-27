// Bucketed age formatter for "Last Touched" columns.
export function formatRelative(days: number | null): string {
  if (days == null) return '—';
  if (days < 1) return 'today';
  if (days < 30) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  const years = days / 365;
  return `${years.toFixed(years >= 10 ? 0 : 1)}y ago`;
}
