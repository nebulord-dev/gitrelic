// What a ⌘K pick does. An analyzer with an Atlas view opens its lens: the
// palette is navigation, and on Overview a merely selected analyzer would
// fan its spoke instead of going there. A view opens the Overview with that
// view selected, so its fan opens: the Overview is the only place a view is
// drawn. Anything else (a file, a person, an analyzer only classic draws) is
// selected, and the inspector takes it from there.

import {
  catalogEntry,
  entityKey,
  entityKind,
  type EntityId,
} from '@gitrelic/scene';

/** A pick that navigates: the lens to open, then what to select there. */
export interface PalettePick {
  lens: string;
  select: EntityId | null;
}

/** Where a pick of `id` goes, or null to select it in place instead. */
export function palettePick(id: EntityId): PalettePick | null {
  const kind = entityKind(id);
  if (kind === 'view') return { lens: 'overview', select: id };
  if (kind !== 'analyzer') return null;
  const preset = entityKey(id);
  return catalogEntry(preset)?.atlas ? { lens: preset, select: null } : null;
}
