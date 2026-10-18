import { PRESETS } from './registry';
import type { PresetId } from './types';

/**
 * Reads `#preset=<id>`, how Atlas links to an analyzer it has no view for yet.
 * The hash is user-controlled, so anything that isn't a known preset id is
 * ignored rather than trusted.
 */
export function presetFromHash(hash: string): PresetId | null {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get('preset');
  return id !== null && Object.hasOwn(PRESETS, id) ? (id as PresetId) : null;
}
