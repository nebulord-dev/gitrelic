// The WebGL renderer. Never rebuilds per-mark display objects per frame:
// marks are particles in one ParticleContainer (one texture atlas, so one
// draw call), links are one mesh with per-vertex colour, and arcs and
// guides are a Graphics each, re-tessellated only on frames marked dirty
// (guides also on zoom, to stay hairlines). Particles and arcs are painted in
// the store's drawOrder, the same order the hit test picks by.
// Cards and text are DOM overlays, not drawn here.

import { resolvePaint, type Rgba } from '@gitrelic/scene';
import {
  Application,
  Container,
  Geometry,
  Graphics,
  isWebGLSupported,
  Mesh,
  Particle,
  ParticleContainer,
  Rectangle,
  Shader,
  Texture,
} from 'pixi.js';

import { arcBand, circleDashes } from './arcBand';
import { LinkBuffers, tessellateLinks } from './linkGeometry';
import { SHAPE_CODES, type MarkStore } from './markStore';
import { HALO, SPRITE, SPRITE_FRAMES, type SpriteFrame } from './spriteAtlas';
import { canvasResolution, type ScreenSize } from './viewport';
import type { StageFrame, StageRenderer } from './stageRenderer';

/** Halo diameter as a multiple of the mark's. */
const HALO_SPREAD = 3;
const HALO_ALPHA = 0.35;
/** An outline mark's stroke, screen px. */
const OUTLINE_PX = 2;

const LINK_VERTEX = /* glsl */ `
in vec2 aPosition;
in vec4 aColor;
out vec4 vColor;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vColor = aColor;
}`;

const LINK_FRAGMENT = /* glsl */ `
in vec4 vColor;
out vec4 finalColor;
void main() {
  finalColor = vec4(vColor.rgb * vColor.a, vColor.a);
}`;

interface Sprites {
  dot: Texture;
  ring: Texture;
  square: Texture;
  halo: Texture;
}

export class PixiStage implements StageRenderer {
  private app: Application | null = null;
  private world = new Container();
  private halos = new ParticleContainer<Particle>({
    dynamicProperties: { position: true, vertex: true, color: true },
  });
  private marks = new ParticleContainer<Particle>({
    dynamicProperties: { position: true, vertex: true, color: true, uvs: true },
  });
  private arcs = new Graphics();
  private outlines = new Graphics();
  private guides = new Graphics();
  private linkBuffers = new LinkBuffers();
  private linkGeometry: Geometry | null = null;
  private linkMesh: Mesh<Geometry, Shader> | null = null;
  private lastIndexCount = 0;
  private sprites: Sprites | null = null;
  private storeVersion = -1;

  async init(host: HTMLElement, size: ScreenSize): Promise<boolean> {
    if (!isWebGLSupported()) return false;
    const app = new Application();
    try {
      await app.init({
        preference: 'webgl',
        width: size.width,
        height: size.height,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: canvasResolution(globalThis.devicePixelRatio),
        // The tween engine decides when to draw; no free-running ticker.
        autoStart: false,
      });
    } catch {
      return false;
    }
    // From here a throw rejects init; AtlasStage.create then calls destroy(),
    // which needs this.app set to release the GL context.
    this.app = app;
    this.sprites = makeSprites();

    this.linkGeometry = new Geometry({
      attributes: {
        aPosition: { buffer: this.linkBuffers.positions, format: 'float32x2' },
        aColor: { buffer: this.linkBuffers.colors, format: 'float32x4' },
      },
      indexBuffer: this.linkBuffers.indices,
    });
    this.linkMesh = new Mesh({
      geometry: this.linkGeometry,
      shader: Shader.from({
        gl: { vertex: LINK_VERTEX, fragment: LINK_FRAGMENT },
      }),
    });

    // Back to front: guides, links, halos, arcs, outlines, marks.
    this.world.addChild(
      this.guides,
      this.linkMesh,
      this.halos,
      this.arcs,
      this.outlines,
      this.marks,
    );
    app.stage.addChild(this.world);
    app.canvas.style.display = 'block';
    host.appendChild(app.canvas);
    return true;
  }

  resize(size: ScreenSize): void {
    this.app?.renderer.resize(size.width, size.height);
  }

  render(frame: StageFrame): void {
    const { app, sprites } = this;
    if (!app || !sprites) return;
    const { store, view } = frame;

    this.world.position.set(view.tx, view.ty);
    this.world.scale.set(view.scale);

    if (store.version !== this.storeVersion) {
      this.syncParticles(store, sprites);
      this.storeVersion = store.version;
    }
    this.updateParticles(store, sprites, frame.glow);

    if (frame.dirty) {
      this.drawArcs(store);
      this.drawLinks(frame);
    }
    if (frame.dirty || frame.guidesDirty) {
      this.drawGuides(frame);
      this.drawOutlines(store, view.scale);
    }
    app.render();
  }

  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
      return;
    }
    // init never got as far as an Application (no WebGL): the field-made
    // containers were never parented, so release them one by one.
    for (const c of [
      this.world,
      this.halos,
      this.marks,
      this.arcs,
      this.guides,
    ])
      c.destroy();
  }

  /** One particle (and one halo) per mark; which mark is set per frame. */
  private syncParticles(store: MarkStore, sprites: Sprites): void {
    const grow = (container: ParticleContainer<Particle>, texture: Texture) => {
      const list = container.particleChildren;
      while (list.length < store.count) {
        list.push(new Particle({ texture, anchorX: 0.5, anchorY: 0.5 }));
      }
      list.length = store.count;
      container.update();
    };
    grow(this.marks, sprites.dot);
    grow(this.halos, sprites.halo);
  }

  private updateParticles(
    store: MarkStore,
    sprites: Sprites,
    glow: boolean,
  ): void {
    const marks = this.marks.particleChildren;
    const halos = this.halos.particleChildren;
    const order = store.drawOrder();
    for (let k = 0; k < store.count; k++) {
      const i = order[k];
      const p = marks[k];
      const h = halos[k];
      const shape = store.shape[i];
      const alpha = store.alpha[i] * store.opacity[i];
      const tint = rgbNumber(store.red[i], store.green[i], store.blue[i]);
      p.x = h.x = store.x[i];
      p.y = h.y = store.y[i];
      p.tint = h.tint = tint;

      if (shape === SHAPE_CODES.dot || shape === SHAPE_CODES.ring) {
        p.texture = shape === SHAPE_CODES.dot ? sprites.dot : sprites.ring;
        p.scaleX = p.scaleY = (store.r[i] * 2) / SPRITE;
        p.alpha = alpha;
        h.scaleX = h.scaleY = (store.r[i] * 2 * HALO_SPREAD) / HALO;
        h.alpha = glow ? alpha * HALO_ALPHA : 0;
      } else if (shape === SHAPE_CODES.bar) {
        p.texture = sprites.square;
        p.scaleX = store.w[i] / sprites.square.width;
        p.scaleY = store.h[i] / sprites.square.height;
        p.alpha = alpha;
        h.alpha = 0;
      } else {
        // Arcs and outlines are drawn as vectors (drawArcs, drawOutlines);
        // cards by the DOM card overlay.
        p.alpha = 0;
        h.alpha = 0;
      }
    }
  }

  /**
   * Outline marks as vector circles, so a large one stays sharp (a sprite
   * that size blurs), with a stroke the same width on screen at any zoom.
   */
  private drawOutlines(store: MarkStore, scale: number): void {
    const g = this.outlines.clear();
    for (const i of store.drawOrder()) {
      if (store.shape[i] !== SHAPE_CODES.outline || store.r[i] <= 0) continue;
      const alpha = store.alpha[i] * store.opacity[i];
      if (alpha <= 0) continue;
      g.circle(store.x[i], store.y[i], store.r[i]).stroke({
        width: OUTLINE_PX / scale,
        alignment: 1,
        color: rgbNumber(store.red[i], store.green[i], store.blue[i]),
        alpha,
      });
    }
  }

  private drawArcs(store: MarkStore): void {
    const g = this.arcs.clear();
    for (const i of store.drawOrder()) {
      if (store.shape[i] !== SHAPE_CODES.arc || store.h[i] <= 0) continue;
      const alpha = store.alpha[i] * store.opacity[i];
      if (alpha <= 0) continue;
      g.poly(
        arcBand(
          store.x[i],
          store.y[i],
          store.r[i],
          store.r[i] + store.h[i],
          store.a0[i],
          store.a1[i],
        ),
      ).fill({
        color: rgbNumber(store.red[i], store.green[i], store.blue[i]),
        alpha,
      });
    }
  }

  private drawGuides(frame: StageFrame): void {
    const g = this.guides.clear();
    const width = 1 / frame.view.scale; // a hairline at any zoom
    for (const guide of frame.guides) {
      if (guide.alpha <= 0 || guide.kind === 'text') continue;
      const c = resolvePaint(guide.paint, frame.palette);
      const stroke = { width, color: rgbOf(c), alpha: c.a * guide.alpha };
      if (guide.kind === 'line') {
        g.moveTo(guide.x1, guide.y1).lineTo(guide.x2, guide.y2).stroke(stroke);
      } else if (guide.dash && guide.r > 0) {
        // Dashes a constant length on screen: redrawn on zoom, like the
        // hairline itself.
        const n = circleDashes(guide.r, frame.view.scale, guide.dash);
        const step = (Math.PI * 2) / n;
        for (let k = 0; k < n; k++) {
          const a = k * step;
          g.moveTo(
            guide.x + guide.r * Math.cos(a),
            guide.y + guide.r * Math.sin(a),
          ).arc(guide.x, guide.y, guide.r, a, a + step / 2);
        }
        g.stroke(stroke);
      } else {
        g.circle(guide.x, guide.y, guide.r).stroke(stroke);
      }
    }
  }

  private drawLinks(frame: StageFrame): void {
    const geometry = this.linkGeometry;
    if (!geometry) return;
    const out = tessellateLinks(
      frame.links,
      frame.store,
      frame.palette,
      this.linkBuffers,
      frame.linkFocus,
    );
    // Unused tail indices become degenerate triangles, so the index buffer
    // keeps one size and the GPU buffer isn't reallocated every frame.
    out.indices.fill(
      0,
      out.indexCount,
      Math.max(out.indexCount, this.lastIndexCount),
    );
    this.lastIndexCount = out.indexCount;
    setBuffer(geometry.getBuffer('aPosition'), out.positions);
    setBuffer(geometry.getBuffer('aColor'), out.colors);
    setBuffer(geometry.indexBuffer, out.indices);
  }
}

/** Swaps in a grown array, or flags the same one as changed. */
function setBuffer(
  buffer: { data: ArrayLike<number>; update(): void },
  data: Float32Array | Uint32Array,
) {
  if (buffer.data !== data) buffer.data = data;
  else buffer.update();
}

function rgbNumber(r: number, g: number, b: number): number {
  return (
    (Math.round(r * 255) << 16) |
    (Math.round(g * 255) << 8) |
    Math.round(b * 255)
  );
}

function rgbOf(c: Rgba): number {
  return rgbNumber(c.r, c.g, c.b);
}

/**
 * Draws the mark sprites into one canvas — filled dot, ring, a white square
 * for bars, and a soft halo — so every particle shares one texture source,
 * which ParticleContainer requires. White, so tint sets the colour.
 */
function makeSprites(): Sprites {
  const { dot, ring, square, halo, width, height } = SPRITE_FRAMES;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for the sprite atlas');
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';

  const c = SPRITE / 2;
  ctx.beginPath();
  ctx.arc(dot.x + c, c, c - 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = SPRITE * 0.12;
  ctx.beginPath();
  ctx.arc(ring.x + c, c, c - ctx.lineWidth / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillRect(square.x, square.y, square.w, square.h);

  const hx = halo.x + HALO / 2;
  const glow = ctx.createRadialGradient(
    hx,
    HALO / 2,
    0,
    hx,
    HALO / 2,
    HALO / 2,
  );
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(halo.x, halo.y, halo.w, halo.h);

  const base = Texture.from(canvas);
  const cut = (x: number, y: number, w: number, h: number) =>
    new Texture({ source: base.source, frame: new Rectangle(x, y, w, h) });
  const frame = (f: SpriteFrame) => cut(f.x, f.y, f.w, f.h);
  return {
    dot: frame(dot),
    ring: frame(ring),
    // Inset by one pixel so a stretched bar's edges stay solid.
    square: cut(square.x + 1, square.y + 1, square.w - 2, square.h - 2),
    halo: frame(halo),
  };
}
