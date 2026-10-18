import { describe, expect, it } from 'vitest';

import {
  emptyScene,
  type Guide,
  type Link,
  type Mark,
  type Scene,
} from '../model';
import {
  EMPTY_LIVE,
  planTransition,
  TIMING,
  type LiveLink,
  type LiveState,
} from './plan';

function mark(
  id: string,
  x: number,
  y: number,
  extra: Partial<Mark> = {},
): Mark {
  return {
    id,
    shape: 'dot',
    paint: '--file',
    x,
    y,
    r: 4,
    w: 0,
    h: 0,
    a0: 0,
    a1: 0,
    alpha: 1,
    ...extra,
  };
}

function link(source: string, target: string): Link {
  return {
    id: `${source}->${target}`,
    source,
    target,
    curve: 'straight',
    width: 1,
    paint: '--link',
    alpha: 0.8,
  };
}

function scene(marks: Mark[], links: Link[] = [], guides: Guide[] = []): Scene {
  return { ...emptyScene({ width: 1000, height: 1000 }), marks, links, guides };
}

function live(
  marks: Mark[],
  links: LiveLink[] = [],
  guides: Guide[] = [],
): LiveState {
  return {
    marks: new Map(marks.map((m) => [m.id, m])),
    links: new Map(links.map((l) => [l.id, l])),
    guides: new Map(guides.map((g) => [g.id, g])),
  };
}

const track = (plan: ReturnType<typeof planTransition>, id: string) => {
  const t = plan.marks.find((m) => m.id === id);
  if (!t) throw new Error(`no track for ${id}`);
  return t;
};

describe('planTransition: marks', () => {
  it('grows every mark in place on the first render', () => {
    const plan = planTransition(
      scene([mark('repo', 500, 500), mark('file:a.ts', 100, 100)]),
      EMPTY_LIVE,
    );
    const t = track(plan, 'file:a.ts');
    expect(t.phase).toBe('enter');
    expect(t.from).toMatchObject({ x: 100, y: 100, r: 0, alpha: 0 });
    expect(t.to).toMatchObject({ x: 100, y: 100, r: 4, alpha: 1 });
    expect(t.delay).toBe(0);
  });

  it('moves a kept mark from where it is now, not where it was headed', () => {
    // Mid-flight: last scene put it at (0,0) → (100,0); it's at (40,0) now.
    const plan = planTransition(
      scene([mark('person:a', 300, 300)]),
      live([mark('person:a', 40, 0, { alpha: 0.6 })]),
    );
    const t = track(plan, 'person:a');
    expect(t.phase).toBe('update');
    expect(t.from).toMatchObject({ x: 40, y: 0, alpha: 0.6 });
    expect(t.to).toMatchObject({ x: 300, y: 300, alpha: 1 });
    expect(t.duration).toBe(TIMING.move);
  });

  it('enters a new mark from its nearest ancestor on screen', () => {
    // dir:src/a isn't drawn; dir:src is, so the file grows out of it.
    const plan = planTransition(
      scene([mark('dir:src', 50, 50), mark('file:src/a/b.ts', 400, 400)]),
      live([mark('dir:src', 10, 20)]),
    );
    expect(track(plan, 'file:src/a/b.ts').from).toMatchObject({
      x: 10,
      y: 20,
      r: 0,
      alpha: 0,
    });
  });

  it('honours an explicit parent over the id structure', () => {
    const plan = planTransition(
      scene([mark('file:x.ts', 400, 400, { parent: 'person:ann' })]),
      live([mark('person:ann', 7, 8), mark('repo', 1, 1)]),
    );
    expect(track(plan, 'file:x.ts').from).toMatchObject({ x: 7, y: 8 });
  });

  it('shrinks a leaving mark into its ancestor in the next scene', () => {
    const plan = planTransition(
      scene([mark('dir:src', 50, 60)]),
      live([mark('dir:src', 0, 0), mark('file:src/a.ts', 100, 100)]),
    );
    const t = track(plan, 'file:src/a.ts');
    expect(t.phase).toBe('exit');
    expect(t.from).toMatchObject({ x: 100, y: 100, alpha: 1 });
    expect(t.to).toMatchObject({ x: 50, y: 60, r: 0, alpha: 0 });
    expect(t.duration).toBe(TIMING.exit);
  });

  it('shrinks in place when no ancestor survives', () => {
    const plan = planTransition(scene([]), live([mark('person:a', 30, 40)]));
    expect(track(plan, 'person:a').to).toMatchObject({
      x: 30,
      y: 40,
      r: 0,
      alpha: 0,
    });
  });

  it('grows arcs outward in place instead of flying them in', () => {
    const arc = mark('cell:0:3', 500, 500, {
      shape: 'arc',
      r: 100,
      h: 12,
      a0: 1,
      a1: 1.2,
    });
    const plan = planTransition(scene([arc]), live([mark('repo', 0, 0)]));
    expect(track(plan, 'cell:0:3').from).toMatchObject({
      x: 500,
      y: 500,
      r: 100,
      h: 0,
      a0: 1,
      a1: 1.2,
      alpha: 0,
    });
  });

  it('re-plans an interrupted exit from its current, half-faded state', () => {
    const halfGone = mark('person:a', 20, 20, { r: 2, alpha: 0.5 });
    const exitAgain = planTransition(scene([]), live([halfGone]));
    expect(track(exitAgain, 'person:a').from).toMatchObject({
      r: 2,
      alpha: 0.5,
    });

    const comeBack = planTransition(
      scene([mark('person:a', 90, 90)]),
      live([halfGone]),
    );
    const t = track(comeBack, 'person:a');
    expect(t.phase).toBe('update');
    expect(t.from).toMatchObject({ x: 20, y: 20, alpha: 0.5 });
  });

  it('survives a cycle of explicit parents', () => {
    const plan = planTransition(
      scene([
        mark('person:a', 1, 1, { parent: 'person:b' }),
        mark('person:b', 2, 2, { parent: 'person:a' }),
      ]),
      EMPTY_LIVE,
    );
    expect(plan.marks).toHaveLength(2);
  });
});

describe('planTransition: links', () => {
  const a = mark('person:a', 0, 0);
  const b = mark('person:b', 100, 0);
  const c = mark('person:c', 200, 0);

  it('retracts leaving links first, then moves marks', () => {
    const plan = planTransition(
      scene([a, b]),
      live([a, b], [{ ...link('person:a', 'person:b'), progress: 1 }]),
    );
    const out = plan.links.find((l) => l.phase === 'exit');
    expect(out).toMatchObject({ delay: 0, duration: TIMING.retract });
    expect(out?.to.progress).toBe(0);
    expect(track(plan, 'person:a').delay).toBe(TIMING.retract);
  });

  it('starts moving at once when nothing retracts', () => {
    const plan = planTransition(scene([a, b]), live([a, b]));
    expect(track(plan, 'person:a').delay).toBe(0);
  });

  it('retracts a half-drawn link in proportion', () => {
    const plan = planTransition(
      scene([a, b]),
      live([a, b], [{ ...link('person:a', 'person:b'), progress: 0.5 }]),
    );
    expect(plan.links[0].duration).toBe(TIMING.retract / 2);
  });

  it('draws new links after the move, 40 ms apart, in scene order', () => {
    const plan = planTransition(
      scene(
        [a, b, c],
        [link('person:a', 'person:b'), link('person:b', 'person:c')],
      ),
      live([a, b, c]),
    );
    expect(plan.links.map((l) => l.delay)).toEqual([
      TIMING.move,
      TIMING.move + TIMING.stagger,
    ]);
    expect(plan.links[0].from.progress).toBe(0);
  });

  it('compresses a long cascade to the stagger cap', () => {
    const many = Array.from({ length: 101 }, (_, i) => mark(`file:${i}`, i, 0));
    const links = many.slice(1).map((m) => link('file:0', m.id));
    const plan = planTransition(scene(many, links), live(many));
    const delays = plan.links.map((l) => l.delay);
    expect(Math.max(...delays) - Math.min(...delays)).toBe(TIMING.maxStagger);
  });

  it('lets a kept, half-drawn link finish from where it is', () => {
    const plan = planTransition(
      scene([a, b], [link('person:a', 'person:b')]),
      live([a, b], [{ ...link('person:a', 'person:b'), progress: 0.3 }]),
    );
    expect(plan.links[0]).toMatchObject({
      phase: 'update',
      from: { progress: 0.3 },
      to: { progress: 1 },
    });
  });
});

describe('planTransition: guides', () => {
  const ring: Guide = {
    id: 'ring-1',
    kind: 'circle',
    x: 0,
    y: 0,
    r: 10,
    paint: '--muted',
    alpha: 0.4,
  };

  it('fades guides in, out and between alphas', () => {
    const into = planTransition(scene([], [], [ring]), EMPTY_LIVE);
    expect(into.guides[0]).toMatchObject({
      phase: 'enter',
      fromAlpha: 0,
      toAlpha: 0.4,
    });

    const out = planTransition(
      scene([]),
      live([], [], [{ ...ring, alpha: 0.2 }]),
    );
    expect(out.guides[0]).toMatchObject({
      phase: 'exit',
      fromAlpha: 0.2,
      toAlpha: 0,
    });
  });
});

describe('planTransition: reduced motion', () => {
  it('never moves anything; marks and links only fade', () => {
    const plan = planTransition(
      scene(
        [mark('dir:src', 500, 500), mark('file:src/new.ts', 600, 600)],
        [link('dir:src', 'file:src/new.ts')],
      ),
      live(
        [mark('dir:src', 0, 0), mark('file:src/old.ts', 10, 10)],
        [{ ...link('dir:src', 'file:src/old.ts'), progress: 1 }],
      ),
      { reducedMotion: true },
    );
    for (const t of plan.marks) {
      if (t.phase === 'update') {
        expect(t.duration).toBe(0);
      } else {
        expect([t.from.x, t.from.y]).toEqual([t.to.x, t.to.y]);
        expect(t.ease).toBe('linear');
      }
    }
    expect(track(plan, 'file:src/new.ts').from).toMatchObject({
      x: 600,
      alpha: 0,
    });
    expect(track(plan, 'file:src/old.ts').to).toMatchObject({
      x: 10,
      r: 4,
      alpha: 0,
    });
    for (const l of plan.links) {
      expect(l.from.progress).toBe(l.to.progress);
      expect(l.delay).toBe(0);
    }
    expect(plan.duration).toBe(TIMING.fade);
  });
});

describe('planTransition: duration', () => {
  it('is when the last track ends', () => {
    const a = mark('person:a', 0, 0);
    const b = mark('person:b', 9, 9);
    const plan = planTransition(
      scene([a, b], [link('person:a', 'person:b')]),
      live([a, b], [{ ...link('person:b', 'person:a'), progress: 1 }]),
    );
    expect(plan.duration).toBe(TIMING.retract + TIMING.move + TIMING.draw);
  });

  it('is 0 for an empty scene over an empty screen', () => {
    expect(planTransition(scene([]), EMPTY_LIVE).duration).toBe(0);
  });
});
