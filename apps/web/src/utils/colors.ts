/**
 * Returns an RGBA color string for a hotspot severity category.
 * Moved from ChurnTreemap to share across all hero vizzes.
 */
export function categoryColor(category: string, opacity: number): string {
  switch (category) {
    case 'critical':
      return `rgba(248, 81, 73, ${opacity})`;
    case 'warning':
      return `rgba(210, 153, 34, ${opacity})`;
    case 'moderate':
      return `rgba(88, 166, 255, ${opacity})`;
    default:
      return `rgba(63, 185, 80, ${opacity})`;
  }
}

/**
 * Deterministic string-to-color mapping via simple hash.
 * Works on any string (emails, directory paths, etc.).
 * Returns an HSL color with fixed saturation/lightness for readability
 * on dark backgrounds. Visually distinct for ~12 values, degrades
 * gracefully beyond that (some hues will be close).
 */
export function authorColor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 60%)`;
}
