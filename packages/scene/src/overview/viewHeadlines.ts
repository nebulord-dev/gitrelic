// What the Overview fan says about each view (docs/atlas-views.md ›
// Overview): its headline is its loudest lens, and the loudest view is the
// one the fan opens on.

import type { PresetGroup } from '../catalog';
import type { LensReading } from './readings';

/** A view the fan draws: every group but the Overview itself. */
export type FanView = Exclude<PresetGroup, 'overview'>;

/** In rail order (a test keeps it in step with `PRESET_GROUPS`). */
export const FAN_VIEWS: readonly FanView[] = [
  'code-health',
  'ownership-risk',
  'team-activity',
  'structure',
];

/** What each view covers, in a line (the inspector's view card). */
export const VIEW_BLURBS: Record<FanView, string> = {
  'code-health':
    'Where the code itself is under strain: churn, risk, age and fixes.',
  'ownership-risk': 'Who knows the code, and what happens when they leave.',
  'team-activity': "How the team works: who's active, when, and with whom.",
  structure: 'What the repo is made of: languages, tests and renames.',
};

/**
 * A view's loudest lens: the highest grade, ties going to lens-bar order
 * (`readings` is in catalog order). When every lens is calm, its first.
 */
export function viewHeadline(
  view: FanView,
  readings: readonly LensReading[],
): LensReading | undefined {
  let best: LensReading | undefined;
  for (const r of readings)
    if (r.group === view && (!best || r.grade > best.grade)) best = r;
  return best;
}

/** The view the fan opens on: the highest top grade, ties going to rail order. */
export function loudestView(readings: readonly LensReading[]): FanView {
  let best = FAN_VIEWS[0];
  let top = -1;
  for (const view of FAN_VIEWS) {
    const grade = viewHeadline(view, readings)?.grade ?? -1;
    if (grade > top) {
      best = view;
      top = grade;
    }
  }
  return best;
}

const LEADING_NUMBER = /^([\d,.]+%?)\s+(.*)$/;

/**
 * A reading's leading number and the rest ("8 files" → "8", "files"), for a
 * fan card that sets the number large; a reading without one stays whole.
 */
export function splitReading(value: string): { lead: string; rest: string } {
  const m = LEADING_NUMBER.exec(value);
  return m ? { lead: m[1], rest: m[2] } : { lead: '', rest: value };
}
