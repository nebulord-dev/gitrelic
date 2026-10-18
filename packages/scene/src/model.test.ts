import { describe, expect, it } from 'vitest';

import { checkScene, emptyScene, type Mark, type Scene } from './model';

function dot(
  id: string,
  x: number,
  y: number,
  extra: Partial<Mark> = {},
): Mark {
  return {
    id,
    shape: 'dot',
    paint: '--person',
    x,
    y,
    r: 5,
    w: 0,
    h: 0,
    a0: 0,
    a1: 0,
    alpha: 1,
    ...extra,
  };
}

function scene(parts: Partial<Scene>): Scene {
  return { ...emptyScene({ width: 100, height: 100 }), ...parts };
}

describe('checkScene', () => {
  it('passes a sound scene', () => {
    expect(
      checkScene(
        scene({
          marks: [dot('person:a', 10, 10), dot('person:b', 90, 90)],
          links: [
            {
              id: 'a-b',
              source: 'person:a',
              target: 'person:b',
              curve: 'straight',
              width: 1,
              paint: '--link',
              alpha: 1,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('passes an empty scene', () => {
    expect(checkScene(emptyScene({ width: 10, height: 10 }))).toEqual([]);
  });

  it('flags non-finite geometry', () => {
    const problems = checkScene(
      scene({ marks: [dot('person:a', Number.NaN, 10)] }),
    );
    expect(problems).toContain('mark person:a: x is NaN');
  });

  it('flags duplicate ids', () => {
    const problems = checkScene(
      scene({ marks: [dot('person:a', 10, 10), dot('person:a', 20, 20)] }),
    );
    expect(problems).toContain('duplicate mark id person:a');
  });

  it('flags marks outside the bounds, by their full extent', () => {
    expect(checkScene(scene({ marks: [dot('person:a', 3, 50)] }))).toContain(
      'mark person:a falls outside the scene bounds',
    );
    const card: Mark = dot('analyzer:x', 50, 50, {
      shape: 'card',
      w: 120,
      h: 10,
    });
    expect(checkScene(scene({ marks: [card] }))).toContain(
      'mark analyzer:x falls outside the scene bounds',
    );
    const arc: Mark = dot('cell:0:0', 50, 50, { shape: 'arc', r: 40, h: 5 });
    expect(checkScene(scene({ marks: [arc] }))).toEqual([]);
    expect(checkScene(scene({ marks: [{ ...arc, h: 20 }] }))).toHaveLength(1);
  });

  it('flags alpha outside 0..1', () => {
    expect(
      checkScene(scene({ marks: [dot('person:a', 50, 50, { alpha: 2 })] })),
    ).toEqual(['mark person:a: alpha 2 outside 0..1']);
  });

  it('flags links to marks that are not in the scene', () => {
    const problems = checkScene(
      scene({
        marks: [dot('person:a', 10, 10)],
        links: [
          {
            id: 'a-x',
            source: 'person:a',
            target: 'person:x',
            curve: 'arc',
            width: 1,
            paint: '--link',
            alpha: 1,
          },
        ],
      }),
    );
    expect(problems).toEqual(['link a-x: no mark person:x']);
  });

  it('flags stand-ins that are drawn, or held by no mark', () => {
    const problems = checkScene(
      scene({
        marks: [dot('file:a', 10, 10), dot('bin:0:0', 50, 50)],
        standIns: new Map([
          ['file:a', 'bin:0:0'],
          ['file:b', 'bin:9:9'],
          ['file:c', 'bin:0:0'],
        ]),
      }),
    );
    expect(problems).toEqual([
      'stand-in for file:a, which is drawn',
      'stand-in for file:b: no mark bin:9:9',
    ]);
  });
});
