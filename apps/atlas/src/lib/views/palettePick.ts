// What a ⌘K pick does. An analyzer with an Atlas view opens its lens: the
// palette is navigation, and on Overview a merely selected analyzer would
// fan its spoke instead of going there. Anything else (a file, a person, an
// analyzer only classic draws) is selected, and the inspector takes it from
// there.

import {
  catalogEntry,
  entityKey,
  entityKind,
  type EntityId,
} from '@gitrelic/scene';

/** The lens a pick of `id` opens, or null to select it instead. */
export function palettePick(id: EntityId): string | null {
  if (entityKind(id) !== 'analyzer') return null;
  const preset = entityKey(id);
  return catalogEntry(preset)?.atlas ? preset : null;
}
