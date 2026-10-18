// Plays a TransitionPlan into the MarkStore, one animation frame at a time,
// and goes to sleep (no rAF) once nothing is moving. `play` may be called
// mid-flight: the plan was made from `live()`, so every track starts where
// the screen currently is.

import {
  easeOutCubic,
  lerpArc,
  linear,
  mixColor,
  resolvePaint,
  trackProgress,
  type EaseName,
  type EntityId,
  type LiveGuide,
  type LiveLink,
  type LiveState,
  type MarkGeom,
  type Palette,
  type Rgba,
  type TransitionPlan,
} from '@gitrelic/scene';

import { GEOM_FIELDS, type MarkStore } from './markStore';

export interface FrameClock {
  now(): number;
  request(callback: (time: number) => void): number;
  cancel(handle: number): void;
}

export const rafClock: FrameClock = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (h) => cancelAnimationFrame(h),
};

const EASE: Record<EaseName, (t: number) => number> = {
  'out-cubic': easeOutCubic,
  linear,
};

/** How long a theme switch takes to re-tint everything. */
export const REPAINT_MS = 300;

interface MarkRun {
  id: EntityId;
  from: MarkGeom;
  to: MarkGeom;
  fromColor: Rgba;
  toColor: Rgba;
  recolor: boolean;
  delay: number;
  duration: number;
  ease: (t: number) => number;
  exit: boolean;
}

interface ValueRun<T> {
  item: T;
  from: [number, number];
  to: [number, number];
  delay: number;
  duration: number;
  ease: (t: number) => number;
  exit: boolean;
}

interface ColorRun {
  id: EntityId;
  from: Rgba;
  to: Rgba;
}

export class TweenEngine {
  /** Links as currently drawn. */
  readonly links = new Map<string, LiveLink>();
  /** Guides as currently drawn. */
  readonly guides = new Map<string, LiveGuide>();

  private marks: MarkRun[] = [];
  private linkRuns: ValueRun<LiveLink>[] = [];
  private guideRuns: ValueRun<LiveGuide>[] = [];
  private planStart = 0;
  private planDuration = 0;
  private planActive = false;

  private colors: ColorRun[] = [];
  private repaintStart = 0;

  private handle: number | null = null;

  constructor(
    readonly store: MarkStore,
    private readonly clock: FrameClock,
    /** Called after every frame's values are written: render now. */
    private readonly onFrame: () => void,
  ) {}

  get running(): boolean {
    return this.handle !== null;
  }

  /** The screen right now, for planning the next transition. */
  live(): LiveState {
    return { marks: this.store.live(), links: this.links, guides: this.guides };
  }

  play(plan: TransitionPlan, palette: Palette): void {
    const { store } = this;
    this.colors = []; // a new plan sets every colour target itself
    this.marks = plan.marks.map((t) => {
      const toColor = resolvePaint(t.mark.paint, palette);
      let i = store.indexOf(t.id);
      if (i === -1) i = store.upsert(t.mark, t.from, toColor);
      else if (t.phase !== 'exit') store.upsert(t.mark, t.from, toColor);
      const fromColor = store.color(i);
      // Pre-shift the arc's target by whole turns once, so the per-frame
      // interpolation is plain arithmetic and still goes the short way.
      const [a0, a1] = lerpArc(t.from.a0, t.from.a1, t.to.a0, t.to.a1, 1);
      return {
        id: t.id,
        from: t.from,
        to: { ...t.to, a0, a1 },
        fromColor,
        // Leaving marks settle on the palette too: a theme switch this plan
        // cut short mustn't leave them shrinking out half-blended.
        toColor,
        recolor: !sameColor(fromColor, toColor),
        delay: t.delay,
        duration: t.duration,
        ease: EASE[t.ease],
        exit: t.phase === 'exit',
      };
    });

    this.linkRuns = plan.links.map((t) => {
      const item: LiveLink = {
        ...t.link,
        progress: t.from.progress,
        alpha: t.from.alpha,
      };
      this.links.set(t.id, item);
      return {
        item,
        from: [t.from.progress, t.from.alpha],
        to: [t.to.progress, t.to.alpha],
        delay: t.delay,
        duration: t.duration,
        ease: EASE[t.ease],
        exit: t.phase === 'exit',
      };
    });

    this.guideRuns = plan.guides.map((t) => {
      const item: LiveGuide = { ...t.guide, alpha: t.fromAlpha };
      this.guides.set(t.id, item);
      return {
        item,
        from: [t.fromAlpha, 0],
        to: [t.toAlpha, 0],
        delay: t.delay,
        duration: t.duration,
        ease: EASE[t.ease],
        exit: t.phase === 'exit',
      };
    });

    this.planStart = this.clock.now();
    this.planDuration = plan.duration;
    this.planActive = true;
    this.tick(this.planStart);
  }

  /** Re-tints every mark to `palette` (a theme switch); nothing moves. */
  repaint(palette: Palette): void {
    const { store } = this;
    this.colors = [];
    const running = new Map(this.marks.map((m) => [m.id, m]));
    for (let i = 0; i < store.count; i++) {
      const run = running.get(store.marks[i].id);
      const to = resolvePaint(store.marks[i].paint, palette);
      if (run) {
        // Mid-transition: the plan stops tweening this mark's colour and a
        // repaint run takes over from the colour shown right now, so there's
        // no jump. Its geometry carries on with the plan.
        run.recolor = false;
        run.toColor = to;
      }
      this.colors.push({ id: store.marks[i].id, from: store.color(i), to });
    }
    this.repaintStart = this.clock.now();
    this.tick(this.repaintStart);
  }

  /** Writes the values for time `now` and schedules the next frame if needed. */
  tick(now: number): void {
    // play()/repaint() call this directly, possibly with a frame already
    // queued; drop it so there's only ever one frame loop. From the frame
    // callback itself, this cancels the frame that is running: a no-op.
    if (this.handle !== null) this.clock.cancel(this.handle);
    this.handle = null;
    let more = false;
    if (this.planActive) {
      const t = now - this.planStart;
      this.applyPlan(t);
      if (t >= this.planDuration) this.finishPlan();
      else more = true;
    }
    if (this.colors.length > 0) {
      const p = trackProgress(now - this.repaintStart, 0, REPAINT_MS, linear);
      for (const run of this.colors) {
        const i = this.store.indexOf(run.id);
        if (i !== -1) this.store.setColor(i, mixColor(run.from, run.to, p));
      }
      if (p >= 1) this.colors = [];
      else more = true;
    }
    // Schedule before drawing, so `running` inside onFrame says whether the
    // engine draws the next frame too (the stage relies on that).
    if (more) this.handle = this.clock.request((time) => this.tick(time));
    this.onFrame();
  }

  stop(): void {
    if (this.handle !== null) this.clock.cancel(this.handle);
    this.handle = null;
  }

  private applyPlan(t: number): void {
    const { store } = this;
    for (const run of this.marks) {
      const i = store.indexOf(run.id);
      if (i === -1) continue;
      const p = trackProgress(t, run.delay, run.duration, run.ease);
      for (const k of GEOM_FIELDS) {
        store[k][i] = run.from[k] + (run.to[k] - run.from[k]) * p;
      }
      if (run.recolor)
        store.setColor(i, mixColor(run.fromColor, run.toColor, p));
    }
    for (const run of this.linkRuns) {
      const p = trackProgress(t, run.delay, run.duration, run.ease);
      run.item.progress = run.from[0] + (run.to[0] - run.from[0]) * p;
      run.item.alpha = run.from[1] + (run.to[1] - run.from[1]) * p;
    }
    for (const run of this.guideRuns) {
      const p = trackProgress(t, run.delay, run.duration, run.ease);
      run.item.alpha = run.from[0] + (run.to[0] - run.from[0]) * p;
    }
  }

  private finishPlan(): void {
    this.store.removeAll(this.marks.filter((r) => r.exit).map((r) => r.id));
    for (const run of this.linkRuns)
      if (run.exit) this.links.delete(run.item.id);
    for (const run of this.guideRuns)
      if (run.exit) this.guides.delete(run.item.id);
    this.marks = [];
    this.linkRuns = [];
    this.guideRuns = [];
    this.planActive = false;
  }
}

// The store keeps colours as float32, so compare loosely.
function sameColor(a: Rgba, b: Rgba): boolean {
  const eps = 1e-6;
  return (
    Math.abs(a.r - b.r) < eps &&
    Math.abs(a.g - b.g) < eps &&
    Math.abs(a.b - b.b) < eps &&
    Math.abs(a.a - b.a) < eps
  );
}
