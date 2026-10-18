// What a click on the stage does. A first click selects (and arms a lens
// dot); a second click on the same, still-selected lens opens it — but only
// a lens with an Atlas view. Leaving for classic is the inspector's button,
// never a click that looks like re-selecting. The arm is the stage's own: any
// selection the stage didn't just make (inspector, ⌘K, Back) clears it.

import {
  catalogEntry,
  entityKey,
  entityKind,
  type EntityId,
} from '@gitrelic/scene';

export interface StageClick {
  /** A lens to open, or null to select `id` instead. */
  open: string | null;
  /** The lens dot armed for a second click after this one. */
  armed: EntityId | null;
}

export function stageClick(
  armed: EntityId | null,
  selection: EntityId | null,
  id: EntityId | null,
): StageClick {
  const isLens = id !== null && entityKind(id) === 'analyzer';
  if (isLens && id === armed && id === selection) {
    const preset = entityKey(id);
    if (catalogEntry(preset)?.atlas) return { open: preset, armed: null };
    // No Atlas view: stay put (the inspector offers classic).
    return { open: null, armed };
  }
  return { open: null, armed: isLens ? id : null };
}
