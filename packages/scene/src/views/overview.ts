// The Overview view: one lens (Repo map) drawn as the fan (primary) or the
// ring. Both are driven by `input.focus`, which the shell keeps: a `view:` id
// opens that view's fan, an `analyzer:` id previews that lens (and, on the
// fan, opens its view), and the shell keeps it while one of the previewed
// lens's own entities is selected.

import { buildEntityIndex } from '../entities';
import { entityKey, entityKind, type EntityKind } from '../ids';
import { fanScene } from '../layouts/fan';
import { ringScene } from '../layouts/ring';
import {
  lensReadings,
  repoReading,
  type LensReading,
} from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { isFanView, loudestView } from '../overview/viewHeadlines';
import type { AnalyzerView, Layout, ViewInput } from '../model';

const FOCUS_KINDS: readonly EntityKind[] = [
  'view',
  'analyzer',
  'file',
  'dir',
  'person',
];

/** The lens `focus` previews, with what it fans out, if it names one. */
function previewOf(input: ViewInput, readings: readonly LensReading[]) {
  const focus = input.focus;
  if (!focus || entityKind(focus) !== 'analyzer') return null;
  const reading = readings.find((r) => r.preset === entityKey(focus));
  if (!reading) return null;
  return {
    reading,
    entities: lensTopEntities(
      reading.preset,
      input.report,
      input.index ?? buildEntityIndex(input.report),
    ),
  };
}

export const fanLayout: Layout = {
  id: 'fan',
  label: 'Fan',
  // The shell's fan focus: a view, a lens, and the entities it fans out.
  focusKinds: FOCUS_KINDS,
  caption:
    'Each view headed by its loudest lens. Click a lens to see what it points at; click it again to fold it.',
  needsCommits: false,
  build: (input, viewport) => {
    const readings = lensReadings(input.report);
    const preview = previewOf(input, readings);
    const named =
      input.focus && entityKind(input.focus) === 'view'
        ? entityKey(input.focus)
        : (preview?.reading.group ?? '');
    const view = isFanView(named) ? named : loudestView(readings);
    return fanScene(
      repoReading(input.report),
      readings,
      {
        view,
        lens: preview
          ? { preset: preview.reading.preset, entities: preview.entities }
          : null,
      },
      viewport,
    );
  },
};

export const ringLayout: Layout = {
  id: 'ring',
  label: 'Ring',
  // The ring draws nothing for a view focus, so a view selection doesn't rebuild it.
  focusKinds: ['analyzer', 'file', 'dir', 'person'],
  caption:
    'Every lens around the repo, sized by how far outside normal it reads. Click a lens to see what it points at; click it again to fold it.',
  needsCommits: false,
  build: (input, viewport) => {
    const readings = lensReadings(input.report);
    const preview = previewOf(input, readings);
    return ringScene(
      repoReading(input.report),
      readings,
      preview
        ? { preset: preview.reading.preset, entities: preview.entities }
        : null,
      viewport,
    );
  },
};

export const overviewView: AnalyzerView = {
  id: 'overview',
  layouts: [fanLayout, ringLayout],
  findings: () => [],
};
