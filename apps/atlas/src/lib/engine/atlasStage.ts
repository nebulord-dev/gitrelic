// The canvas stage minus the framework: owns the store, tween engine,
// renderer, viewport, hit-testing and labels, and decides when to draw.
// Stage.svelte and the bench page are thin shells around it.

import {
  easeOutCubic,
  mixPalette,
  planTransition,
  TIMING,
  type EntityId,
  type Palette,
  type Scene,
} from '@gitrelic/scene';

import { HitTester } from './hitTest';
import { LabelLayer } from './labelLayer';
import { MarkStore } from './markStore';
import { TooltipLayer } from './tooltipLayer';
import {
  rafClock,
  REPAINT_MS,
  TweenEngine,
  type FrameClock,
} from './tweenEngine';
import {
  fit,
  FIT_PADDING,
  IDENTITY,
  screenToWorld,
  type Insets,
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
  /** Room the stage's own controls take along its top and bottom edges. */
  insets?: Insets;
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
  /** The palette a theme switch is fading from; links and guides blend. */
  private paletteFrom: Palette | null = null;
  private repaintStart = 0;
  private glow: boolean;
  /** The mark under the pointer; wins while it's on one. */
  private pointerHover: EntityId | null = null;
  /** An entity hovered from outside (a table row). */
  private rowHover: EntityId | null = null;
  /** The marks holding entities the scene didn't draw (`Scene.standIns`). */
  private standIns: Scene['standIns'];
  /**
   * The pointer's mark first: a row that keeps keyboard focus mustn't
   * contradict what's under the cursor. A row whose entity has no mark of
   * its own lights the mark holding it (a density cell).
   */
  private get hovered(): EntityId | null {
    if (this.pointerHover) return this.pointerHover;
    const id = this.rowHover;
    if (!id || this.store.indexOf(id) >= 0) return id;
    return this.standIns?.get(id) ?? id;
  }
  private selected: EntityId | null = null;
  private hits = new HitTester();
  /** Marks moved or the view changed since the grid was built. */
  private hitsStale = true;
  private dirty = true;
  /** Zoom the guides were last drawn at; they're hairlines in screen space. */
  private guideScale = Number.NaN;
  /** The viewer panned or zoomed, so a resize keeps their view. */
  private userMoved = false;
  /** The scene showing has no marks; the next one with marks reframes. */
  private lastEmpty = false;
  /** A glide to a new framing, eased over the marks' move time. */
  private camera: {
    from: ViewTransform;
    to: ViewTransform;
    start: number;
  } | null = null;
  private destroyed = false;
  private pending: number | null = null;
  private readonly clock: FrameClock;
  private detachInput: () => void;

  private constructor(
    private readonly host: HTMLElement,
    private readonly labels: LabelLayer,
    private readonly tooltip: TooltipLayer,
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
        this.camera = null;
        this.userMoved = true;
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
    try {
      if (!(await opts.renderer.init(host, size))) {
        opts.renderer.destroy();
        return null;
      }
      return new AtlasStage(
        host,
        new LabelLayer(labelHost),
        new TooltipLayer(labelHost),
        size,
        opts,
      );
    } catch (err) {
      // Setup failing after WebGL came up (no 2D canvas for the sprites, a
      // theme token the canvas can't parse): don't leak the GL context.
      opts.renderer.destroy();
      throw err;
    }
  }

  /**
   * Transitions to `scene`. The first scene with marks frames the view, and
   * so does the next one after an empty spell (a view without an Atlas lens):
   * an empty scene's bounds frame nothing worth keeping.
   *
   * `reframe` is for a new picture (another lens or form): it glides to fit
   * even if the viewer had zoomed, since their zoom belonged to the old one.
   * Without it (a selection re-forming the same picture) a zoom is kept.
   */
  show(scene: Scene, opts: { reframe?: boolean } = {}): void {
    if (this.destroyed) return;
    const empty = scene.marks.length === 0;
    if (!empty) {
      const frame = this.bounds === null || this.lastEmpty;
      if (opts.reframe) this.userMoved = false;
      const moved = !sameBounds(this.bounds, scene.bounds) || !!opts.reframe;
      this.bounds = scene.bounds;
      if (frame) {
        this.view = this.framing(scene.bounds);
        this.camera = null;
        this.userMoved = false;
      } else if (moved && !this.userMoved) {
        // The scene grew or shrank (a fan opened) and the viewer hasn't
        // taken the camera: glide to frame it, alongside the marks — or,
        // with reduced motion, cut straight to it (zooming is exactly the
        // motion that preference asks to stop).
        const to = this.framing(scene.bounds);
        if (this.opts.reducedMotion()) {
          this.view = to;
          this.camera = null;
          this.hitsStale = true;
        } else {
          this.camera = { from: this.view, to, start: this.clock.now() };
        }
      }
    }
    this.lastEmpty = empty;
    this.standIns = scene.standIns;
    const plan = planTransition(scene, this.engine.live(), {
      reducedMotion: this.opts.reducedMotion(),
    });
    this.hitsStale = true;
    this.dirty = true;
    this.engine.play(plan, this.palette);
  }

  setTheme(palette: Palette, glow: boolean): void {
    if (this.destroyed) return;
    // Links and guides fade over the same time the engine re-tints marks.
    this.paletteFrom = this.shownPalette();
    this.repaintStart = this.clock.now();
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
    if (this.destroyed) return;
    this.size = size;
    this.opts.renderer.resize(size);
    if (!this.userMoved && this.bounds) {
      // A glide in flight was aiming at a framing for the old size.
      this.camera = null;
      this.view = this.framing(this.bounds);
      this.hitsStale = true;
    }
    this.requestDraw(true);
  }

  /** `bounds` fitted to the stage, clear of its controls. */
  private framing(bounds: Scene['bounds']): ViewTransform {
    return fit(bounds, this.size, FIT_PADDING, this.opts.insets);
  }

  fitView(): void {
    if (!this.bounds) return;
    this.userMoved = false;
    this.camera = null;
    this.view = this.framing(this.bounds);
    this.hitsStale = true;
    this.requestDraw(false);
  }

  get transform(): ViewTransform {
    return this.view;
  }

  destroy(): void {
    this.destroyed = true;
    this.engine.stop();
    if (this.pending !== null) this.clock.cancel(this.pending);
    this.detachInput();
    this.labels.destroy();
    this.tooltip.destroy();
    this.opts.renderer.destroy();
  }

  /** The topmost mark under a screen point. */
  pick(sx: number, sy: number): EntityId | null {
    // Every frame that moves marks marks the grid stale, so while they move
    // it's rebuilt at most once per frame, and once more after they settle.
    if (this.hitsStale) {
      this.hits.build(this.store);
      this.hitsStale = false;
    }
    const [wx, wy] = screenToWorld(this.view, sx, sy);
    return this.hits.hitMark(this.store, wx, wy, HIT_SLOP / this.view.scale);
  }

  /**
   * Hovers `id` from outside the canvas (a detail-table row): its label is
   * pinned and its tooltip shown, as if the pointer were on it. It has its
   * own slot, so clearing it (a row losing focus) never erases what the
   * pointer is on, and the pointer on a mark outranks it. It leaves the cursor alone and doesn't report back
   * through `onHover`: the caller already knows.
   */
  hover(id: EntityId | null): void {
    if (this.destroyed || id === this.rowHover) return;
    this.rowHover = id;
    this.requestDraw(false);
  }

  private setHovered(id: EntityId | null): void {
    if (id === this.pointerHover) return;
    this.pointerHover = id;
    this.host.style.cursor = id ? 'pointer' : '';
    this.opts.onHover?.(id);
    this.requestDraw(false);
  }

  /**
   * Draws once on the next frame, unless the tween engine is already
   * drawing every frame. `dirty` forces arcs, links and guides to rebuild.
   */
  private requestDraw(dirty: boolean): void {
    if (this.destroyed) return;
    if (dirty) this.dirty = true;
    if (this.engine.running || this.pending !== null) return;
    this.pending = this.clock.request(() => {
      this.pending = null;
      this.draw(false);
    });
  }

  /** The palette links and guides are drawn with right now. */
  private shownPalette(): Palette {
    if (!this.paletteFrom) return this.palette;
    const p = (this.clock.now() - this.repaintStart) / REPAINT_MS;
    if (p >= 1) this.paletteFrom = null;
    return mixPalette(this.paletteFrom ?? this.palette, this.palette, p);
  }

  private draw(animated: boolean): void {
    if (this.destroyed) return;
    const start = this.clock.now();
    const gliding = this.camera !== null;
    if (this.camera) {
      const { from, to } = this.camera;
      const p = easeOutCubic(
        Math.min(1, (start - this.camera.start) / TIMING.move),
      );
      this.view = {
        scale: from.scale + (to.scale - from.scale) * p,
        tx: from.tx + (to.tx - from.tx) * p,
        ty: from.ty + (to.ty - from.ty) * p,
      };
      this.hitsStale = true;
      if (p >= 1) this.camera = null;
    }
    // Read before shownPalette(), which clears it on the fade's last frame.
    const fading = this.paletteFrom !== null;
    const palette = this.shownPalette();
    const dirty = this.dirty || animated || fading;
    this.opts.renderer.render({
      store: this.store,
      links: this.engine.links.values(),
      guides: this.engine.guides.values(),
      palette,
      view: this.view,
      glow: this.glow,
      dirty,
      guidesDirty: dirty || this.view.scale !== this.guideScale,
    });
    this.dirty = false;
    this.guideScale = this.view.scale;
    if (animated) this.hitsStale = true;
    const pinned = new Set<EntityId>();
    if (this.hovered) pinned.add(this.hovered);
    if (this.selected) pinned.add(this.selected);
    this.labels.update(this.store, this.view, this.size, pinned);
    this.tooltip.update(this.store, this.view, this.size, this.hovered);
    this.opts.onFrame?.(this.clock.now() - start);
    // A plan can cut the engine's repaint short, or end before the camera
    // lands; finish either anyway. requestDraw does nothing while the engine
    // is drawing the next frame.
    if (this.paletteFrom || (gliding && this.camera)) this.requestDraw(true);
  }
}

function sameBounds(a: Scene['bounds'] | null, b: Scene['bounds']): boolean {
  return a !== null && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
