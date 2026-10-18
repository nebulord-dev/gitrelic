// The URL hash holds what a shared link should reopen: the view, its layout
// and the selected entity. Theme is a viewer preference and lives in
// localStorage instead (see theme.ts).

export interface AtlasLocation {
  /** Analyzer view id, e.g. `contributors`. */
  view?: string;
  /** Alternate layout within the view, e.g. `swimlanes`. */
  layout?: string;
  /**
   * Selected entity id, e.g. `person:ann@corp.com`. Untrusted input: resolve
   * it through the entity map, never render it.
   */
  selection?: string;
}

const KEYS = { view: 'v', layout: 'l', selection: 's' } as const;

export function parseHash(hash: string): AtlasLocation {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const location: AtlasLocation = {};
  for (const [field, key] of Object.entries(KEYS)) {
    const value = params.get(key);
    if (value) location[field as keyof AtlasLocation] = value;
  }
  return location;
}

export function serializeHash(location: AtlasLocation): string {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(KEYS)) {
    const value = location[field as keyof AtlasLocation];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `#${query}` : '';
}
