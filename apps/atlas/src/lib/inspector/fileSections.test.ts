import { afterEach, describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import { fileSections, scrollToSection } from './fileSections';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('fileSections', () => {
  it('offers only sections that render, Activity always', () => {
    expect(fileSections('src/api.ts', report).map((s) => s.anchor)).toContain(
      'insp-people',
    );
    // A file with advice leads with it.
    expect(fileSections('src/helpers.ts', report)[0]).toEqual({
      anchor: 'insp-todo',
      label: 'What to do',
    });
    expect(fileSections('nope.ts', report)).toEqual([
      { anchor: 'insp-activity', label: 'Activity' },
    ]);
  });
});

describe('scrollToSection', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('scrolls only the inspector, never the page', () => {
    const box = document.createElement('aside');
    box.style.overflowY = 'auto';
    const section = document.createElement('section');
    section.id = 'insp-people';
    section.style.scrollMarginTop = '12px';
    box.append(section);
    document.body.append(box);
    box.scrollTop = 100;
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({
      top: 80,
    } as DOMRect);
    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
      top: 500,
    } as DOMRect);
    const boxScroll = vi.fn();
    box.scrollTo = boxScroll as typeof box.scrollTo;
    const pageScroll = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => {});
    section.scrollIntoView = vi.fn();

    scrollToSection('insp-people');

    // 420px below the box's top, already 100 down, less the 12px margin.
    expect(boxScroll).toHaveBeenCalledWith({ top: 508 });
    expect(section.scrollIntoView).not.toHaveBeenCalled();
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it('lands the section below the sticky tabs, not under them', () => {
    const box = document.createElement('aside');
    box.style.overflowY = 'auto';
    const bar = document.createElement('nav');
    bar.dataset.sticky = '';
    const section = document.createElement('section');
    section.id = 'insp-activity';
    box.append(bar, section);
    document.body.append(box);
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({
      top: 0,
    } as DOMRect);
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({
      height: 40,
    } as DOMRect);
    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
      top: 300,
    } as DOMRect);
    const boxScroll = vi.fn();
    box.scrollTo = boxScroll as typeof box.scrollTo;

    scrollToSection('insp-activity');

    expect(boxScroll).toHaveBeenCalledWith({ top: 260 });
  });

  it('does nothing for a section that is not there', () => {
    expect(() => scrollToSection('insp-nope')).not.toThrow();
  });
});
