import { describe, expect, it } from 'vitest';

import { checkScene } from '../model';
import { emptyGrid, type SelectionHours } from '../timing/punchCard';
import { punchCardScene } from './punchCard';

const VIEWPORT = { width: 1200, height: 800 };
const grid = emptyGrid();
grid[1][12] = 10; // Mon noon
grid[6][12] = 2; // Sat noon: off-hours
grid[2][2] = 1; // Tue 2am: off-hours
const cell = (
  s: ReturnType<typeof punchCardScene>,
  day: number,
  hour: number,
) => s.marks.find((m) => m.id === `punch:${day}:${hour}`)!;

describe('punchCardScene', () => {
  const scene = punchCardScene({ grid }, VIEWPORT);

  it('is a sound scene of 168 cells, Monday first', () => {
    expect(checkScene(scene)).toEqual([]);
    const cells = scene.marks.filter((m) => m.id.startsWith('punch:'));
    expect(cells).toHaveLength(168);
    expect(cell(scene, 1, 0).y).toBeLessThan(cell(scene, 0, 0).y);
    expect(cell(scene, 6, 0).y).toBeLessThan(cell(scene, 0, 0).y);
  });

  it('tints off-hours cells with the risk colour, working hours grey', () => {
    expect(cell(scene, 1, 12).paint).toMatchObject({
      mix: ['--cell-base', '--soft'],
    });
    expect(cell(scene, 6, 12).paint).toMatchObject({
      mix: ['--cell-base', '--risk-2'],
    });
    expect(cell(scene, 2, 2).paint).toMatchObject({
      mix: ['--cell-base', '--risk-2'],
    });
    expect(cell(scene, 3, 3).paint).toBe('--cell-base');
    expect(cell(scene, 6, 12).tip).toEqual([
      'Sat 12pm · off-hours',
      '2 commits (15% of the repo’s)',
    ]);
  });

  it('redraws from a selection’s hours, its off-hours in the accent', () => {
    const sel = emptyGrid();
    sel[6][12] = 1;
    sel[1][12] = 3;
    const hours: SelectionHours = { grid: sel, commits: 4, offHours: 1 };
    const s = punchCardScene(
      { grid, selection: { name: 'server', hours, note: 'its hours' } },
      VIEWPORT,
    );
    expect(checkScene(s)).toEqual([]);
    expect(s.marks.map((m) => m.id)).toEqual(scene.marks.map((m) => m.id));
    expect(cell(s, 6, 12).paint).toMatchObject({
      mix: ['--cell-base', '--accent'],
    });
    expect(cell(s, 1, 12).paint).toMatchObject({
      mix: ['--cell-base', '--soft'],
    });
    expect(cell(s, 2, 2).paint).toBe('--cell-base');
    expect(cell(s, 6, 12).tip?.[2]).toBe('1 commit touching server');
    expect(s.marks.find((m) => m.id === 'punch-head')!.label).toBe(
      'server: 4 commits, 25% off-hours',
    );
    expect(s.marks.find((m) => m.id === 'punch-head')!.labelSub).toBe(
      'its hours',
    );
  });

  it('adds who committed to a cell’s tooltip when given', () => {
    const s = punchCardScene(
      {
        grid,
        who: (day, hour) => (day === 6 && hour === 12 ? 'by Ann 2' : null),
      },
      VIEWPORT,
    );
    expect(cell(s, 6, 12).tip).toEqual([
      'Sat 12pm · off-hours',
      '2 commits (15% of the repo’s)',
      'by Ann 2',
    ]);
    expect(cell(s, 1, 12).tip).toHaveLength(2);
  });

  it('says so when there are no commits', () => {
    const empty = punchCardScene({ grid: emptyGrid() }, VIEWPORT);
    expect(checkScene(empty)).toEqual([]);
    expect(empty.marks[0].label).toBe('No commits in the window');
  });
});
