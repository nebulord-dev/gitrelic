// The canvas stage minus the framework: owns the store, tween engine,
// renderer, viewport, hit-testing and labels, and decides when to draw.
// Stage.svelte and the bench page are thin shells around it.

import {
  planTransition,
  type EntityId,
  type Palette,
  type Scene,
} from '@gitrelic/scene';

import { HitTester } from './hitTest';
import { LabelLayer } from './labelLayer';
import { MarkStore } from './markStore';
import { rafClock, TweenEngine, type FrameClock } from './tweenEngine';
import {
  fit,
  IDENTITY,
  screenToWorld,
  type ScreenSize,
  type ViewTransform,
} from './viewport';
import { attachViewportInput } from './viewportInput';
import type { StageRenderer } from './stageRenderer';

/** Hit tolerance around marks, in screen pixels. */
const HIT_SLOP = 4;

export interface AtlasStageOptions {
  renderer: StageRenderer;
  /** Read once WebGL is up (it needs the theme's CSS to be applied). */
  readPalette: () => Palette;
  glow: boolean;
  reducedMotion: () => boolean;
  clock?: FrameClock;
  onHover?: (id: EntityId | null) => void;
  onSelect?: (id: EntityId | null) => void;
  /** Each drawn frame's CPU cost, ms (the bench reads this). */
  onFrame?: (ms: number) => void;
}

export class AtlasStage {
  readonly store = new MarkStore();
  readonly engine: TweenEngine;
  private view: ViewTransform = IDENTITY;
  private bounds: Scene['bounds'] | null = null;
  private palette: Palette;
  private glow: boolean;
  private hovered: EntityId | null = null;
  private selected: EntityId | null = null;
  private hits = new HitTester();
  private hitsStale = true;
  private dirty = true;
  private pending: number | null = null;
  private readonly clock: FrameClock;
  private detachInput: () => void;

  private constructor(
    private readonly host: HTMLElement,
    private readonly labels: LabelLayer,
    private size: ScreenSize,
    private readonly opts: AtlasStageOptions,
  ) {
    this.clock = opts.clock ?? rafClock;
    this.palette = opts.readPalette();
    this.glow = opts.glow;
    // Engine frames always rebuild: something moved or changed colour.
    this.engine = new TweenEngine(this.store, this.clock, () =>
      this.draw(true),
    );
    this.detachInput = attachViewportInput(host, {
      get: () => this.view,
      set: (v) => {
        this.view = v;
        this.hitsStale = true;
        this.requestDraw(false);
      },
      fit: () => this.fitView(),
      hover: (sx, sy) => this.setHovered(this.pick(sx, sy)),
      leave: () => this.setHovered(null),
      click: (sx, sy) => {
        const id = this.pick(sx, sy);
        this.select(id);
        opts.onSelect?.(id);
      },
    });
  }

  /** Null when WebGL isn't available; the caller shows a fallback. */
  static async create(
    host: HTMLElement,
    labelHost: HTMLElement,
    size: ScreenSize,
    opts: AtlasStageOptions,
  ): Promise<AtlasStage | null> {
    if (!(await opts.renderer.init(host, size))) return null;
    return new AtlasStage(host, new LabelLayer(labelHost), size, opts);
  }

  /** Transitions to `scene`; the first scene also frames the view. */
  show(scene: Scene): void {
    const first = this.bounds === null;
    this.bounds = scene.bounds;
    if (first) this.view = fit(scene.bounds, this.size);
    const plan = planTransition(scene, this.engine.live(), {
      reducedMotion: this.opts.reducedMotion(),
    });
    this.hitsStale = true;
    this.dirty = true;
    this.engine.play(plan, this.palette);
  }

  setTheme(palette: Palette, glow: boolean): void {
    this.palette = palette;
    this.glow = glow;
    this.dirty = true;
    this.engine.repaint(palette);
  }

  select(id: EntityId | null): void {
    this.selected = id;
    this.requestDraw(false);
  }

  resize(size: ScreenSize): void {
    this.size = size;
    this.opts.renderer.resize(size);
    this.requestDraw(true);
  }

  fitView(): void {
    if (!this.bounds) return;
    this.view = fit(this.bounds, this.size);
    this.hitsStale = true;
    this.requestDraw(false);
  }

  get transform(): ViewTransform {
    return this.view;
  }

  destroy(): void {
    this.engine.stop();
    if (this.pending !== null) this.clock.cancel(this.pending);
    this.detachInput();
    this.labels.destroy();
    this.opts.renderer.destroy();
  }

  /** The topmost mark under a screen point. */
  pick(sx: number, sy: number): EntityId | null {
    if (this.hitsStale || this.engine.running) {
      this.hits.build(this.store);
      this.hitsStale = false;
    }
    const [wx, wy] = screenToWorld(this.view, sx, sy);
    return this.hits.hitMark(this.store, wx, wy, HIT_SLOP / this.view.scale);
  }

  private setHovered(id: EntityId | null): void {
    if (id === this.hovered) return;
    this.hovered = id;
    this.host.style.cursor = id ? 'pointer' : '';
    this.opts.onHover?.(id);
    this.requestDraw(false);
  }

  /**
   * Draws once on the next frame, unless the tween engine is already
   * drawing every frame. `dirty` forces arcs, links and guides to rebuild.
   */
  private requestDraw(dirty: boolean): void {
    if (dirty) this.dirty = true;
    if (this.engine.running || this.pending !== null) return;
    this.pending = this.clock.request(() => {
      this.pending = null;
      this.draw(false);
    });
  }

  private draw(animated: boolean): void {
    const start = this.clock.now();
    this.opts.renderer.render({
      store: this.store,
      links: this.engine.links.values(),
      guides: this.engine.guides.values(),
      palette: this.palette,
      view: this.view,
      glow: this.glow,
      dirty: this.dirty || animated,
    });
    this.dirty = false;
    const pinned = new Set<EntityId>();
    if (this.hovered) pinned.add(this.hovered);
    if (this.selected) pinned.add(this.selected);
    this.labels.update(this.store, this.view, this.size, pinned);
    this.opts.onFrame?.(this.clock.now() - start);
  }
}
