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

  it('folds a fan into its root where it is now, before the root moves', () => {
    const plan = planTransition(
      scene([mark('file:root.ts', 10, 10)]),
      live([
        mark('file:root.ts', 500, 400),
        mark('facet:churn', 700, 300, {
          parent: 'file:root.ts',
          foldOnExit: true,
        }),
      ]),
    );
    const fold = track(plan, 'facet:churn');
    expect(fold).toMatchObject({ delay: 0, duration: TIMING.fold });
    expect(fold.to).toMatchObject({ x: 500, y: 400, r: 0, alpha: 0 });
    // The root waits for its fan to close.
    expect(track(plan, 'file:root.ts').delay).toBe(TIMING.foldLead);
  });

  it('starts moving at once when nothing folds or retracts', () => {
    const plan = planTransition(
      scene([mark('file:root.ts', 10, 10)]),
      live([mark('file:root.ts', 500, 400), mark('file:gone.ts', 1, 1)]),
    );
    expect(track(plan, 'file:root.ts').delay).toBe(0);
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
    expect(track(plan, 'person:a').delay).toBe(TIMING.retractLead);
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

  it('draws new links as the move settles, 40 ms apart, in scene order', () => {
    const plan = planTransition(
      scene(
        [a, b, c],
        [link('person:a', 'person:b'), link('person:b', 'person:c')],
      ),
      live([a, b, c]),
    );
    expect(plan.links.map((l) => l.delay)).toEqual([
      TIMING.drawAfter,
      TIMING.drawAfter + TIMING.stagger,
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
      from: null,
    });
    expect(into.guides[0].from).toBeNull();
  });

  it('moves a guide that stays from where it is drawn now', () => {
    const now = { ...ring, x: 50, r: 30 };
    const plan = planTransition(scene([], [], [ring]), live([], [], [now]));
    expect(plan.guides[0]).toMatchObject({ phase: 'update', from: now });
    // Under reduced motion it only fades.
    const still = planTransition(scene([], [], [ring]), live([], [], [now]), {
      reducedMotion: true,
    });
    expect(still.guides[0].from).toBeNull();
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
    expect(plan.duration).toBe(
      TIMING.retractLead +
        Math.max(TIMING.move, TIMING.drawAfter + TIMING.draw),
    );
  });

  it('is 0 for an empty scene over an empty screen', () => {
    expect(planTransition(scene([]), EMPTY_LIVE).duration).toBe(0);
  });
});

describe('planTransition: slots', () => {
  const root = mark('analyzer:a', 0, 0);
  // A leaving fan entity, caught mid-flight (half faded, off its target).
  const old = mark('file:old.ts', 100, 120, {
    parent: 'analyzer:a',
    foldOnExit: true,
    slot: 'fan:0',
    alpha: 0.6,
    r: 3,
  });
  const taker = mark('file:new.ts', 300, 320, {
    parent: 'analyzer:b',
    slot: 'fan:0',
  });

  it('lets an entering mark take over a leaving one in its slot: it moves from there, the other just goes', () => {
    const plan = planTransition(
      scene([root, taker]),
      live(
        [root, old],
        [{ ...link('analyzer:a', 'file:old.ts'), progress: 1 }],
      ),
    );
    const t = track(plan, 'file:new.ts');
    expect(t).toMatchObject({
      phase: 'update',
      takesOver: 'file:old.ts',
      ease: 'out-cubic',
      duration: TIMING.move,
    });
    expect(t.from).toEqual({
      x: 100,
      y: 120,
      r: 3,
      w: 0,
      h: 0,
      a0: 0,
      a1: 0,
      alpha: 0.6,
    });
    expect(t.to).toMatchObject({ x: 300, y: 320, r: 4, alpha: 1 });
    // No fold, no shrink: gone at once, its place on screen taken.
    const gone = track(plan, 'file:old.ts');
    expect(gone).toMatchObject({
      phase: 'exit',
      takenBy: 'file:new.ts',
      delay: 0,
      duration: 0,
    });
    expect(gone.to).toMatchObject({ x: 100, y: 120, alpha: 0 });
    // It didn't fold, so nothing waits for it (only the link retracts).
    expect(t.delay).toBe(TIMING.retractLead);
  });

  it('lets a third mark take over a taker caught mid-flight, from where it is now', () => {
    // A→B put file:new.ts in slot s; it's half-way there when C arrives.
    const midFlight = mark('file:new.ts', 180, 190, {
      slot: 'fan:0',
      alpha: 0.7,
      r: 2,
    });
    const third = mark('file:third.ts', 600, 620, { slot: 'fan:0' });
    const plan = planTransition(scene([root, third]), live([root, midFlight]));
    const t = track(plan, 'file:third.ts');
    expect(t.phase).toBe('update');
    expect(t.takesOver).toBe('file:new.ts');
    expect(t.from).toMatchObject({ x: 180, y: 190, r: 2, alpha: 0.7 });
    expect(t.to).toMatchObject({ x: 600, y: 620 });
    expect(track(plan, 'file:new.ts')).toMatchObject({
      phase: 'exit',
      takenBy: 'file:third.ts',
    });
  });

  it('leaves marks without a match as they were: grow in, fold out', () => {
    const plan = planTransition(
      scene([root, { ...taker, slot: 'lens:0' }]),
      live([root, old]),
    );
    expect(track(plan, 'file:new.ts').phase).toBe('enter');
    expect(track(plan, 'file:new.ts').takesOver).toBeUndefined();
    const fold = track(plan, 'file:old.ts');
    expect(fold).toMatchObject({ duration: TIMING.fold, delay: 0 });
    expect(fold.takenBy).toBeUndefined();
  });

  it('never takes over a mark that stays', () => {
    const plan = planTransition(
      scene([root, { ...old, x: 50 }, taker]),
      live([root, old]),
    );
    expect(track(plan, 'file:new.ts').phase).toBe('enter');
    expect(track(plan, 'file:old.ts').phase).toBe('update');
  });

  it('pairs a shared slot in order: next scene’s marks against what is on screen', () => {
    const leaving = ['x', 'y'].map((n, i) =>
      mark(`file:${n}`, i * 10, 0, { slot: 's' }),
    );
    const entering = ['p', 'q', 'r'].map((n, i) =>
      mark(`file:${n}`, 500 + i * 10, 0, { slot: 's' }),
    );
    const plan = planTransition(scene(entering), live(leaving));
    expect(track(plan, 'file:p').takesOver).toBe('file:x');
    expect(track(plan, 'file:q').takesOver).toBe('file:y');
    expect(track(plan, 'file:r').phase).toBe('enter');
  });

  it('prefers the same slot, then any free one in its group', () => {
    // The fans share an entity, so slot 1 is left over on both sides.
    const leaving = [
      mark('file:x', 0, 0, { slot: 'fan:0' }),
      mark('file:shared', 10, 0, { slot: 'fan:1' }),
      mark('file:z', 20, 0, { slot: 'fan:2' }),
      mark('analyzer:q', 30, 0, { slot: 'lens:0' }),
    ];
    const entering = [
      mark('file:shared', 500, 0, { slot: 'fan:0' }),
      mark('file:w', 510, 0, { slot: 'fan:1' }),
      mark('file:v', 520, 0, { slot: 'fan:2' }),
      mark('file:u', 530, 0, { slot: 'other:0' }),
    ];
    const plan = planTransition(scene(entering), live(leaving));
    expect(track(plan, 'file:shared').phase).toBe('update');
    expect(track(plan, 'file:v').takesOver).toBe('file:z');
    expect(track(plan, 'file:w').takesOver).toBe('file:x');
    // Another group's leftovers are never taken.
    expect(track(plan, 'file:u').phase).toBe('enter');
    expect(track(plan, 'analyzer:q').takenBy).toBeUndefined();
  });

  it('lets a link take over a leaving link in its slot instead of retracting and redrawing', () => {
    const fanLink = (target: string, slot: string): Link => ({
      ...link('analyzer:a', target),
      id: `fan:${target}`,
      slot,
    });
    const plan = planTransition(
      scene([root, taker], [fanLink('file:new.ts', 'fan:0')]),
      live(
        [root, old],
        [{ ...fanLink('file:old.ts', 'fan:0'), progress: 0.7, alpha: 0.5 }],
      ),
    );
    const t = plan.links.find((l) => l.id === 'fan:file:new.ts');
    expect(t).toMatchObject({
      phase: 'update',
      takesOver: 'fan:file:old.ts',
      from: { progress: 0.7, alpha: 0.5 },
      to: { progress: 1, alpha: 0.8 },
      delay: 0,
    });
    const gone = plan.links.find((l) => l.id === 'fan:file:old.ts');
    expect(gone).toMatchObject({
      phase: 'exit',
      takenBy: 'fan:file:new.ts',
      delay: 0,
      duration: 0,
    });
    // Nothing retracted or folded, so the move starts at once.
    expect(track(plan, 'file:new.ts').delay).toBe(0);
  });

  it('ignores slots under reduced motion: the old fades out, the new fades in', () => {
    const plan = planTransition(scene([root, taker]), live([root, old]), {
      reducedMotion: true,
    });
    const t = track(plan, 'file:new.ts');
    expect(t.phase).toBe('enter');
    expect(t.from).toMatchObject({ x: 300, alpha: 0 });
    expect(track(plan, 'file:old.ts')).toMatchObject({
      phase: 'exit',
      duration: TIMING.fade,
    });
  });
});
