// Where the viewer is: the open view, its layout and the selected entity,
// mirrored in the URL hash so a link reopens the same place. Everything read
// from the hash is checked: a view must be one Atlas has, and a selection
// must resolve in the entity index — otherwise it's dropped, never shown.

import { catalogEntry, type EntityId, type EntityIndex } from '@gitrelic/scene';

import { parseHash, serializeHash } from './hash';

export class Nav {
  view = $state<string | null>(null);
  layout = $state<string | null>(null);
  selection = $state<EntityId | null>(null);

  private readonly onHashChange = () => this.read();

  constructor(
    /** A getter, so the caller can hand over reactive data. */
    private readonly index: () => EntityIndex,
    private readonly win: Window = window,
    /** A view's alternate layouts (forms); a layout in the hash must be one. */
    private readonly layoutsOf: (view: string) => readonly string[] = () => [],
  ) {
    // The selection is validated here and on every hashchange, not when the
    // index changes: Shell builds the index once from a report that's fixed
    // for its lifetime. Revalidate on index change if that ever stops holding.
    this.read();
    win.addEventListener('hashchange', this.onHashChange);
  }

  /** Opens an Atlas view (a new history entry, so Back returns). */
  open(view: string): void {
    if (!catalogEntry(view)?.atlas) return;
    this.view = view;
    this.layout = null;
    this.write('push');
  }

  /** Selects an entity, or clears the selection (replaces the history entry). */
  /**
   * Selects `id`, or clears with null. An id the index doesn't know is
   * ignored and the current selection kept: a click on something not
   * selectable (a bot's row, a cell:/week:/commit: mark until those kinds
   * are indexed) must not throw away what the viewer had selected.
   */
  select(id: EntityId | null): void {
    if (id !== null && !this.index().get(id)) return;
    this.selection = id;
    this.write('replace');
  }

  destroy(): void {
    this.win.removeEventListener('hashchange', this.onHashChange);
  }

  private read(): void {
    const loc = parseHash(this.win.location.hash);
    this.view = loc.view && catalogEntry(loc.view)?.atlas ? loc.view : null;
    this.layout =
      this.view && loc.layout && this.layoutsOf(this.view).includes(loc.layout)
        ? loc.layout
        : null;
    this.selection =
      loc.selection && this.index().get(loc.selection) ? loc.selection : null;
  }

  private write(mode: 'push' | 'replace'): void {
    const hash = serializeHash({
      view: this.view ?? undefined,
      layout: this.layout ?? undefined,
      selection: this.selection ?? undefined,
    });
    const { pathname, search } = this.win.location;
    const url = `${pathname}${search}${hash}`;
    if (mode === 'push') this.win.history.pushState(null, '', url);
    else this.win.history.replaceState(null, '', url);
  }
}
