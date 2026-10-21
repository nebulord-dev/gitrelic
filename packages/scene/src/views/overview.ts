// The Overview view: one lens (Repo map) drawn as the dashboard (primary) or
// the fan. Both are driven by `input.focus`, which the shell keeps: an
// `analyzer:` id puts that lens in the dashboard's lead (on the fan, it
// previews the lens inside its view), a `view:` id opens that view's fan, and
// the shell keeps the focus while one of the lens's own entities is selected.

import { buildEntityIndex } from '../entities';
import { entityKey, entityKind, type EntityKind } from '../ids';
import { CALM_PANEL, dashboardScene } from '../layouts/dashboard';
import { fanScene } from '../layouts/fan';
import {
  lensReadings,
  repoReading,
  type LensReading,
} from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { isFanView, loudestView } from '../overview/viewHeadlines';
import { repoVitals } from '../overview/vitals';
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

export const dashboardLayout: Layout = {
  id: 'dashboard',
  label: 'Dashboard',
  // A view focus picks no lead, so a view selection doesn't rebuild it.
  focusKinds: ['analyzer', 'file', 'dir', 'person'],
  caption:
    'The loudest lens leads, with what it points at. Click any card to put it in the lead, click it again to fold back; the calm lenses are under Within normal.',
  needsCommits: false,
  build: (input) => {
    const readings = lensReadings(input.report);
    const preview = previewOf(input, readings);
    const index = input.index ?? buildEntityIndex(input.report);
    return dashboardScene(
      repoVitals(input.report),
      readings,
      (preset) => lensTopEntities(preset, input.report, index),
      preview?.reading.preset ?? null,
      input.open?.has(CALM_PANEL) ?? false,
    );
  },
};

export const overviewView: AnalyzerView = {
  id: 'overview',
  layouts: [dashboardLayout, fanLayout],
  findings: () => [],
};
