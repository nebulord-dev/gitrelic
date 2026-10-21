import { ids } from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

import { stageClick } from './stageClick';

const hotspots = ids.analyzer('hotspots');
const file = ids.file('a.ts');
const person = ids.person('a@example.com');

describe('stageClick', () => {
  it('selects what the click lands on, and clears on empty stage', () => {
    expect(stageClick(null, hotspots, false)).toBe(hotspots);
    expect(stageClick(hotspots, file, false)).toBe(file);
    expect(stageClick(file, null, false)).toBeNull();
  });

  it('folds what is already selected on a second click, whatever its kind', () => {
    expect(stageClick(hotspots, hotspots, false)).toBeNull();
    expect(stageClick(file, file, false)).toBeNull();
    expect(stageClick(person, person, false)).toBeNull();
  });

  it('never opens a lens: a second click on a lens dot only folds it', () => {
    // Opening is the inspector's button; a repeat click must not leave the view.
    expect(stageClick(hotspots, hotspots, false)).not.toBe(hotspots);
  });

  it('folds back to what the selection was fanned from, when there is one', () => {
    // The Overview: a file picked from Hotspots' fan folds back to Hotspots.
    expect(stageClick(file, file, false, hotspots)).toBe(hotspots);
  });

  it("keeps the selection on a double-click's second click", () => {
    // A double-click selects and fits; it must not select, fold, then fit.
    expect(stageClick(hotspots, hotspots, true)).toBe(hotspots);
    expect(stageClick(file, file, true, hotspots)).toBe(file);
  });
});
