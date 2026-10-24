// The sections a selected file's inspector actually renders, in order, so
// the card's jump links and the collapsed strip only offer real targets.

import {
  coupledWith,
  fileContributors,
  fileFacts,
  rippleOf,
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
  if (rippleOf(report, file)?.blast)
    out.push({ anchor: 'insp-blast', label: 'Blast radius' });
  if (coupledWith(file, report).length > 0)
    out.push({ anchor: 'insp-coupled', label: 'Changes with' });
  return out;
}

/**
 * Scrolls the inspector to a section. Never a `#anchor` link: Atlas keeps
 * its state in the URL hash, so changing it would drop the selection. Nor
 * `scrollIntoView`, which scrolls every scrollable ancestor, the page too:
 * only the inspector's own scroll box moves. The section lands below the
 * box's sticky bar (`data-sticky`, the section tabs), not under it.
 */
export function scrollToSection(anchor: string): void {
  const el = document.getElementById(anchor);
  const box = el && scrollParent(el);
  if (!el || !box) return;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const offset =
    el.getBoundingClientRect().top - box.getBoundingClientRect().top;
  const bar = box.querySelector('[data-sticky]')?.getBoundingClientRect();
  box.scrollTo({ top: box.scrollTop + offset - margin - (bar?.height ?? 0) });
}

/** The nearest ancestor that scrolls: the inspector, for its cards. */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}
