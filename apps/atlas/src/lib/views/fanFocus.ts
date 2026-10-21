// What the Overview fans. Selecting a view opens its fan; selecting a lens
// previews it (on the fan, inside its own view); selecting one of the
// previewed lens's entities keeps that preview (so the inspector can describe
// the file without the fan collapsing under it); anything else closes it,
// back to the loudest view.

import {
  catalogEntry,
  entityKind,
  ids,
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

/**
 * What a second click on the Overview's selection folds back to (stageClick's
 * `foldTo`). A file picked from a lens's fan folds to that lens. In the Fan, a
 * lens folds to its view: the open view is the selection, so clearing it would
 * jump to the loudest view instead of closing the lens. Anything else (a view,
 * or a lens on the dashboard, which has no open view) folds to nothing.
 */
export function fanFold(
  selection: EntityId | null,
  fanFocus: EntityId | null,
  form: string | undefined,
): EntityId | null {
  if (!selection) return null;
  if (fanFocus && fanFocus !== selection) return fanFocus;
  if (form !== 'fan' || entityKind(selection) !== 'analyzer') return null;
  const group = catalogEntry(entityKey(selection))?.group;
  return group && group !== 'overview' ? ids.view(group) : null;
}
