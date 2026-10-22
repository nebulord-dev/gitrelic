// What Stage.svelte draws through. One implementation today (Pixi, WebGL);
// the interface keeps the engine and its tests free of the renderer.

import type { MarkStore } from './markStore';
import type { ScreenSize, ViewTransform } from './viewport';
import type { EntityId, LiveGuide, LiveLink, Palette } from '@gitrelic/scene';

export interface StageFrame {
  store: MarkStore;
  links: Iterable<LiveLink>;
  guides: Iterable<LiveGuide>;
  palette: Palette;
  view: ViewTransform;
  /** Glow theme: soft halos behind dots and rings. */
  glow: boolean;
  /**
   * A mark whose links are lit while the rest fade (`Scene.hoverLinks`), or
   * null for every link as its scene drew it.
   */
  linkFocus: EntityId | null;
  /**
   * Whether anything changed since the last frame beyond the view — while
   * false, arcs, links and guides keep their last tessellation.
   */
  dirty: boolean;
  /**
   * Guides are drawn as screen hairlines (width 1 / scale), so they also
   * rebuild whenever the zoom changes, even when nothing else did.
   */
  guidesDirty: boolean;
}

export interface StageRenderer {
  /** Resolves false when WebGL isn't available. */
  init(host: HTMLElement, size: ScreenSize): Promise<boolean>;
  resize(size: ScreenSize): void;
  render(frame: StageFrame): void;
  destroy(): void;
}
