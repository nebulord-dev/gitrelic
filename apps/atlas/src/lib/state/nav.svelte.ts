// Where the viewer is: the open view and lens, the lens's form, the selected
// entity and the time window, mirrored in the URL hash so a link reopens the
// same place (docs/atlas-views.md, URL state). Everything read from the hash
// is checked — a view must be a rail group, a lens an Atlas view in it, a
// form one its lens declares, a selection one the entity index resolves —
// and anything else is dropped, never shown.

import {
  catalogEntry,
  defaultLens,
  isPresetGroup,
  type EntityId,
  type EntityIndex,
  type PresetGroup,
} from '@gitrelic/scene';

import { parseHash, serializeHash } from './hash';

const HOME: PresetGroup = 'overview';

export class Nav {
  view = $state<PresetGroup>(HOME);
  lens = $state<string | null>(null);
  form = $state<string | null>(null);
  selection = $state<EntityId | null>(null);
  time = $state<string | null>(null);

  private readonly onHashChange = () => this.read();

  constructor(
    /** A getter, so the caller can hand over reactive data. */
    private readonly index: () => EntityIndex,
    private readonly win: Window = window,
    /** A lens's alternate forms; a form in the hash must be one of them. */
    private readonly formsOf: (lens: string) => readonly string[] = () => [],
  ) {
    // The selection is validated here and on every hashchange, not when the
    // index changes: Shell builds the index once from a report that's fixed
    // for its lifetime. Revalidate on index change if that ever stops holding.
    this.read();
    win.addEventListener('hashchange', this.onHashChange);
  }

  /** Opens a view on its default lens (a new history entry, so Back returns). */
  openView(view: string): void {
    if (!isPresetGroup(view)) return;
    this.view = view;
    this.lens = defaultLens(view);
    this.form = null;
    this.write('push');
  }

  /**
   * Opens a lens, and its view with it. Returns false for a lens without an
   * Atlas view; the caller links to classic instead.
   */
  openLens(id: string): boolean {
    const entry = catalogEntry(id);
    if (!entry?.atlas) return false;
    this.view = entry.group;
    this.lens = id;
    this.form = null;
    this.write('push');
    return true;
  }

  /** Switches the lens's form; null is its primary. */
  setForm(form: string | null): void {
    if (form !== null && !(this.lens && this.formsOf(this.lens).includes(form)))
      return;
    this.form = form;
    this.write('push');
  }

  /**
   * Selects `id`, or clears with null, replacing the history entry rather
   * than pushing one. An id the index doesn't know is ignored and the
   * current selection kept: a click on something not selectable (a bot's
   * row, a cell:/week:/commit: mark until those kinds are indexed) must not
   * throw away what the viewer had selected.
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
    this.view = loc.view && isPresetGroup(loc.view) ? loc.view : HOME;
    const entry = loc.lens ? catalogEntry(loc.lens) : undefined;
    this.lens =
      entry?.atlas && entry.group === this.view
        ? entry.id
        : defaultLens(this.view);
    this.form =
      this.lens && loc.form && this.formsOf(this.lens).includes(loc.form)
        ? loc.form
        : null;
    this.selection =
      loc.selection && this.index().get(loc.selection) ? loc.selection : null;
    // `t` is dropped until the first lens narrows to a window, so a shared
    // link never promises a filter nothing applies. isTimeWindow (hash.ts)
    // is ready for it: read `loc.time` through it here when that lands.
    this.time = null;
    // Rewrite the URL if anything was dropped, so a shared link doesn't
    // carry the junk forward.
    if (this.hash() !== this.win.location.hash) this.write('replace');
  }

  /** Defaults (the home view, a view's default lens) stay out of the URL. */
  private hash(): string {
    return serializeHash({
      view: this.view === HOME ? undefined : this.view,
      lens:
        this.lens === defaultLens(this.view)
          ? undefined
          : (this.lens ?? undefined),
      form: this.form ?? undefined,
      selection: this.selection ?? undefined,
      time: this.time ?? undefined,
    });
  }

  private write(mode: 'push' | 'replace'): void {
    const { pathname, search } = this.win.location;
    const url = `${pathname}${search}${this.hash()}`;
    if (mode === 'push') this.win.history.pushState(null, '', url);
    else this.win.history.replaceState(null, '', url);
  }
}
