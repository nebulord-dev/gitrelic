// The sections a selected file's inspector actually renders, in order, so
// the card's jump links and the collapsed strip only offer real targets.

import {
  coupledWith,
  fileContributors,
  fileFacts,
  whatToDo,
  type AdviceSection,
} from '@gitrelic/scene';

import type { GitrelicReport } from '@gitrelic/core';

export interface FileSection {
  anchor: string;
  label: string;
}

/** Where each piece of advice's evidence lives in the inspector. */
export const ADVICE_ANCHOR: Record<AdviceSection, string> = {
  people: 'insp-people',
  activity: 'insp-activity',
  'changes-with': 'insp-coupled',
  'flagged-by': 'insp-flagged',
};

export function fileSections(
  file: string,
  report: GitrelicReport,
): FileSection[] {
  const out: FileSection[] = [];
  if (whatToDo(file, report).length > 0)
    out.push({ anchor: 'insp-todo', label: 'What to do' });
  if (fileFacts(file, report).length > 0)
    out.push({ anchor: 'insp-flagged', label: 'Flagged by' });
  if (fileContributors(file, report).length > 0)
    out.push({ anchor: 'insp-people', label: 'People' });
  out.push({ anchor: 'insp-activity', label: 'Activity' });
  if (coupledWith(file, report).length > 0)
    out.push({ anchor: 'insp-coupled', label: 'Changes with' });
  return out;
}

/**
 * Scrolls the inspector to a section. Never a `#anchor` link: Atlas keeps
 * its state in the URL hash, so changing it would drop the selection.
 */
export function scrollToSection(anchor: string): void {
  document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
}
