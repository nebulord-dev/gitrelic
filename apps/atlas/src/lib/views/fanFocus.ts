// What the Overview fans. Selecting a view opens its fan; selecting a lens
// previews it (on the fan, inside its own view); selecting one of the
// previewed lens's entities keeps that preview (so the inspector can describe
// the file without the fan collapsing under it); anything else closes it,
// back to the loudest view.

import {
  entityKind,
  lensTopEntities,
  entityKey,
  type EntityId,
  type EntityIndex,
} from '@gitrelic/scene';

import type { GitrelicReport } from '@gitrelic/core';

export function nextFanFocus(
  previous: EntityId | null,
  selection: EntityId | null,
  report: GitrelicReport,
  index: EntityIndex,
): EntityId | null {
  if (!selection) return null;
  const kind = entityKind(selection);
  if (kind === 'analyzer' || kind === 'view') return selection;
  if (!previous || entityKind(previous) !== 'analyzer') return null;
  const fanned = lensTopEntities(entityKey(previous), report, index);
  return fanned.some((e) => e.id === selection) ? previous : null;
}
