// Human-readable age formatter used in tables ("Last Touched" column).
// Buckets: null → '—', <1d → 'today', <30d → 'Xd ago',
//          <365d → 'Xmo ago', 1–10y → 'X.Xy ago', 10+y → 'Xy ago'.
export function formatRelative(days: number | null): string {
  if (days == null) return '—';
  if (days < 1) return 'today';
  if (days < 30) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  const years = days / 365;
  return `${years.toFixed(years >= 10 ? 0 : 1)}y ago`;
}
