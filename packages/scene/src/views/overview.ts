// The Overview view: one lens (Repo map) drawn as the ring. The ring fans
// out the lens named by `input.focus` (an `analyzer:` id); the shell decides
// which lens that is, so a fan survives selecting one of its own entities.

import { buildEntityIndex } from '../entities';
import { entityKey, entityKind } from '../ids';
import { ringScene } from '../layouts/ring';
import { lensReadings, repoReading } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import type { AnalyzerView, Layout } from '../model';

export const ringLayout: Layout = {
  id: 'ring',
  label: 'Ring',
  // The shell's fan focus: a lens, and the entities it fans out.
  focusKinds: ['analyzer', 'file', 'dir', 'person'],
  needsCommits: false,
  build: (input, viewport) => {
    const readings = lensReadings(input.report);
    const focus = input.focus;
    const preset =
      focus && entityKind(focus) === 'analyzer' ? entityKey(focus) : null;
    const fanned =
      preset && readings.some((r) => r.preset === preset)
        ? {
            preset,
            entities: lensTopEntities(
              preset,
              input.report,
              input.index ?? buildEntityIndex(input.report),
            ),
          }
        : null;
    return ringScene(repoReading(input.report), readings, fanned, viewport);
  },
};

export const overviewView: AnalyzerView = {
  id: 'overview',
  layouts: [ringLayout],
  findings: () => [],
};
