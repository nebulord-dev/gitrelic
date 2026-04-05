export type BadgeVariant = 'critical' | 'warning' | 'ownership' | 'coupling' | 'temporal' | 'shame' | 'parallel' | 'stale';

export const badgeStyles: Record<BadgeVariant, { bg: string; fg: string }> = {
  critical:  { bg: 'var(--red-bg)',    fg: 'var(--red-fg)' },
  warning:   { bg: 'var(--amber-bg)',  fg: 'var(--amber-fg)' },
  ownership: { bg: 'var(--purple-bg)', fg: 'var(--purple-fg)' },
  coupling:  { bg: 'var(--blue-bg)',   fg: 'var(--blue-fg)' },
  temporal:  { bg: 'var(--teal-bg)',   fg: 'var(--teal-fg)' },
  shame:     { bg: 'var(--red-bg)',    fg: 'var(--red-fg)' },
  parallel:  { bg: 'var(--amber-bg)',  fg: 'var(--amber-fg)' },
  stale:     { bg: 'var(--bg3)',       fg: 'var(--fg3)' },
};

/** Hotspot category → CSS variable color string */
export function hotspotColor(category: string): string {
  if (category === 'critical') return 'var(--red)';
  if (category === 'warning') return 'var(--amber)';
  return 'var(--teal)';
}

/** Age status → CSS variable color string */
export function ageColor(status: string): string {
  if (status === 'fresh') return 'var(--teal)';
  if (status === 'aging') return 'var(--amber)';
  if (status === 'stale') return 'var(--red)';
  if (status === 'ancient') return 'var(--fg3)';
  return 'var(--fg3)';
}

/** Cluster dimension → BadgeVariant */
export function clusterVariant(dimension: string): BadgeVariant {
  if (dimension === 'structural') return 'temporal';
  if (dimension === 'ownership') return 'ownership';
  if (dimension === 'temporal') return 'warning';
  if (dimension === 'coupling-hub') return 'coupling';
  return 'stale';
}

/** Format numbers with locale separators (1234 → "1,234") */
export function fmt(n: number): string {
  return n.toLocaleString();
}

/** Extract filename from path ("src/components/App.tsx" → "App.tsx") */
export function fileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/** Extract directory from path ("src/components/App.tsx" → "src/components/") */
export function filePath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return path.slice(0, lastSlash + 1);
}
