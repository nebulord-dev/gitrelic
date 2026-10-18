// The URL hash holds what a shared link should reopen: the view, its lens,
// the lens's form, the selected entity and the time window. Theme is a viewer
// preference and lives in localStorage instead (see theme.ts).

export interface AtlasLocation {
  /** View (rail group), e.g. `code-health`. */
  view?: string;
  /** Lens (analyzer) within the view, e.g. `hotspots`. */
  lens?: string;
  /** Alternate form of the lens, e.g. `by-package`. */
  form?: string;
  /**
   * Selected entity id, e.g. `person:ann@corp.com`. Untrusted input: resolve
   * it through the entity map, never render it.
   */
  selection?: string;
  /** Time-strip window: `2026-03` or `2026-01..2026-03`. */
  time?: string;
}

const KEYS = {
  view: 'v',
  lens: 'l',
  form: 'f',
  selection: 's',
  time: 't',
} as const;

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

const MONTH = String.raw`\d{4}-(0[1-9]|1[0-2])`;
const TIME = new RegExp(`^${MONTH}(\\.\\.${MONTH})?$`);

/** A well-formed time window, with the range in order. */
export function isTimeWindow(value: string): boolean {
  if (!TIME.test(value)) return false;
  const [from, to] = value.split('..');
  return to === undefined || from <= to;
}
