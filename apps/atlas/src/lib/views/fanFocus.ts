// Which lens the Overview ring fans out. Selecting a lens dot fans it;
// selecting one of the fanned entities keeps that fan (so the inspector can
// describe the file without the ring collapsing under it); anything else
// closes it.

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
  if (entityKind(selection) === 'analyzer') return selection;
  if (!previous) return null;
  const fanned = lensTopEntities(entityKey(previous), report, index);
  return fanned.some((e) => e.id === selection) ? previous : null;
}
