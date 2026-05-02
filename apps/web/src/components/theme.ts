export type BadgeVariant =
  | 'critical'
  | 'warning'
  | 'moderate'
  | 'healthy'
  | 'ownership'
  | 'coupling'
  | 'temporal'
  | 'shame'
  | 'parallel'
  | 'stale';

export function severityColor(category: string): 'critical' | 'warning' | 'moderate' | 'healthy' {
  switch (category) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'moderate':
      return 'moderate';
    default:
      return 'healthy';
  }
}

export function ageColor(status: string): 'healthy' | 'warning' | 'critical' | 'stale' {
  switch (status) {
    case 'fresh':
      return 'healthy';
    case 'aging':
      return 'warning';
    case 'stale':
      return 'critical';
    case 'ancient':
      return 'stale';
    default:
      return 'stale';
  }
}

export function clusterVariant(dimension: string): BadgeVariant {
  switch (dimension) {
    case 'ownership':
      return 'ownership';
    case 'temporal':
      return 'warning';
    case 'coupling-hub':
      return 'coupling';
    case 'structural':
      return 'temporal';
    default:
      return 'stale';
  }
}

/** @deprecated Use severityColor() — kept for backward compat with HotspotTable */
export function hotspotColor(category: string): string {
  switch (category) {
    case 'critical':
      return 'var(--severity-critical)';
    case 'warning':
      return 'var(--severity-warning)';
    default:
      return 'var(--severity-healthy)';
  }
}

export function fmt(n: number): string {
  return n.toLocaleString();
}

export function fileName(path: string): string {
  return path.split('/').pop() ?? path;
}

export function filePath(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.length > 0 ? `${parts.join('/')}/` : '';
}
