// What a click on the stage selects. A click selects what it lands on (on
// empty stage, nothing); a click on what is already selected folds it: the
// first click didn't take you anywhere, so the second reads as undoing it,
// never as going further. Opening a lens is the inspector's button. A
// selection fanned out of something else (the Overview's file picked from a
// lens's fan) folds back to that, not to nothing. The second click of a
// double-click keeps the selection: a double-click selects and fits.

import type { EntityId } from '@gitrelic/scene';

export function stageClick(
  selection: EntityId | null,
  id: EntityId | null,
  repeat: boolean,
  foldTo: EntityId | null = null,
): EntityId | null {
  if (id === null || id !== selection || repeat) return id;
  return foldTo;
}
