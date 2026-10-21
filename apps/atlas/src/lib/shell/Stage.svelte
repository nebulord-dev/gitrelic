<script lang="ts">
  import {
    emptyScene,
    type EntityId,
    type Scene,
    type ThemeName,
  } from '@gitrelic/scene';
  import { onMount, tick, type Snippet } from 'svelte';

  import { AtlasStage } from '../engine/atlasStage';
  import { prefersReducedMotion } from '../engine/reducedMotion';
  import { paletteFromDocument } from '../engine/themeBridge';
  import FormToggle from './FormToggle.svelte';

  let {
    scene = null,
    theme,
    selected = null,
    onselect,
    empty,
    caption,
    docs,
    forms = [],
    form,
    onform,
    frameKey,
    highlight = null,
    ontable,
    tableOpen = false,
  }: {
    scene?: Scene | null;
    theme: ThemeName;
    selected?: EntityId | null;
    /** A click: what it hit, and whether it is a double-click's second. */
    onselect?: (id: EntityId | null, repeat: boolean) => void;
    /** Shown while there's no scene (the lens has no Atlas view yet). */
    empty?: Snippet;
    /** One line on how to read the picture, under it. */
    caption?: string;
    /** The lens's docs page. */
    docs?: string;
    /** The lens's forms; with two or more, a toggle sits in the corner. */
    forms?: readonly { id: string; label: string }[];
    form?: string;
    onform?: (id: string) => void;
    /**
     * Names the picture (lens and form). When it changes the stage reframes,
     * even if the viewer had zoomed; a new scene under the same key (a
     * selection re-forming it) keeps their zoom.
     */
    frameKey?: string;
    /** Lit as if hovered: a detail-table row under the pointer. */
    highlight?: EntityId | null;
    /** The lens has a detail table: a corner button toggles it. */
    ontable?: () => void;
    tableOpen?: boolean;
  } = $props();

  // Screen pixels the overlays take: 12px offset + a 32px control on top,
  // the caption line along the bottom. Fitting keeps the picture clear.
  const STAGE_INSETS = { top: 44, bottom: 28 };

  let host = $state<HTMLDivElement>();
  let labels = $state<HTMLDivElement>();
  // A class instance, so Svelte doesn't proxy it; only the reference is reactive.
  let stage = $state<AtlasStage | null>(null);
  let noWebgl = $state(false);
  let failure = $state<string | null>(null);
  // The theme the stage's palette was read in; the effect below skips it.
  let paintedTheme: ThemeName | null = null;

  function fail(err: unknown) {
    failure = err instanceof Error ? err.message : String(err);
  }

  onMount(() => {
    if (!host || !labels) return;
    const el = host;
    let disposed = false;
    let created: AtlasStage | null = null;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      created?.resize({ width, height });
    });

    const labelHost = labels;
    // The theme the stage is built in. If it changes while WebGL starts, the
    // theme effect sees paintedTheme lag behind and re-applies the new one.
    const startTheme = theme;
    // Pixi loads on demand: the shell and the no-WebGL fallback stay light.
    import('../engine/pixiStage')
      .then(({ PixiStage }) =>
        AtlasStage.create(
          el,
          labelHost,
          { width: el.clientWidth, height: el.clientHeight },
          {
            renderer: new PixiStage(),
            readPalette: () => paletteFromDocument(),
            glow: startTheme === 'glow',
            reducedMotion: () => prefersReducedMotion(),
            // The corner controls (fit, form toggle) and the caption row.
            insets: STAGE_INSETS,
            onSelect: (id, repeat) => onselect?.(id, repeat),
          },
        ),
      )
      .then((made) => {
        if (disposed) {
          made?.destroy();
          return;
        }
        if (!made) {
          noWebgl = true;
          return;
        }
        created = made;
        paintedTheme = startTheme;
        stage = made;
        resize.observe(el);
      }, fail);

    return () => {
      disposed = true;
      resize.disconnect();
      created?.destroy();
    };
  });

  // The picture last shown; a different key is a new picture to frame.
  let shownKey: string | undefined;
  $effect(() => {
    // No scene (a lens without an Atlas view): clear what was drawn, so the
    // last lens's marks don't linger under the empty state.
    if (!stage) return;
    const reframe = frameKey !== shownKey;
    shownKey = frameKey;
    stage.show(scene ?? emptyScene({ width: 1, height: 1 }), { reframe });
  });

  $effect(() => {
    const next = theme;
    const glow = next === 'glow';
    const current = stage;
    if (!current || next === paintedTheme) return;
    paintedTheme = next;
    // App applies data-theme in its own effect; read the tokens after it.
    tick()
      .then(() => current.setTheme(paletteFromDocument(), glow))
      .catch(fail);
  });

  $effect(() => {
    stage?.select(selected);
  });

  $effect(() => {
    stage?.hover(highlight);
  });
</script>

<main class="panel relative min-w-0 flex-1 overflow-hidden">
  <!-- Focusable so the zoom keys (+, -, 0) reach it; no ARIA role Svelte counts
       as interactive describes a pan/zoom surface. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={host}
    class="absolute inset-0 touch-none outline-none"
    role="application"
    aria-label="Visualization. Drag to pan, scroll or pinch to zoom, 0 to fit."
    tabindex="0"
  ></div>
  <div
    bind:this={labels}
    class="pointer-events-none absolute inset-0 overflow-hidden"
    aria-hidden="true"
  ></div>
  {#if scene && !failure && !noWebgl}
    {#if forms.length > 1}
      <FormToggle {forms} {form} {onform} />
    {/if}
    <button
      type="button"
      aria-label="Fit to view (0)"
      title="Fit to view (0)"
      onclick={() => stage?.fitView()}
      class="absolute top-3 left-3 grid size-8 cursor-pointer place-content-center rounded-chip border border-control-border bg-bg text-muted hover:text-text"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg
      >
    </button>
    {#if ontable}
      <button
        type="button"
        aria-pressed={tableOpen}
        title="Table (T)"
        onclick={() => ontable?.()}
        class={[
          'absolute top-3 left-13 h-8 cursor-pointer rounded-chip border border-control-border px-2.5 font-[inherit] text-[12px]',
          tableOpen
            ? 'bg-control-border text-text'
            : 'bg-bg text-muted hover:text-text',
        ]}>Table</button
      >
    {/if}
    {#if caption || docs}
      <div
        class="pointer-events-none absolute right-4 bottom-3 left-4 flex items-baseline gap-4 text-[12px] text-muted"
      >
        {#if caption}<p class="m-0 flex-1">{caption}</p>{/if}
        {#if docs}
          <a
            class="pointer-events-auto ml-auto text-accent"
            href={docs}
            target="_blank"
            rel="noopener noreferrer">Docs ↗</a
          >
        {/if}
      </div>
    {/if}
  {/if}
  {#if failure}
    <div
      class="absolute inset-0 grid place-content-center gap-2 p-6 text-center text-sm text-muted"
      role="alert"
    >
      <p>The renderer stopped: {failure}</p>
      <p>
        <a class="text-accent underline" href="/classic/"
          >Open the classic dashboard</a
        >
      </p>
    </div>
  {:else if noWebgl}
    <div
      class="absolute inset-0 grid place-content-center gap-2 p-6 text-center text-sm text-muted"
      role="alert"
    >
      <p>Atlas draws with WebGL, which this browser has turned off.</p>
      <p>
        <a class="text-accent underline" href="/classic/"
          >Open the classic dashboard</a
        >
      </p>
    </div>
  {:else if !scene}
    <div
      class="absolute inset-0 grid place-content-center p-6 text-center text-sm text-muted"
    >
      {#if empty}{@render empty()}{:else}No views yet.{/if}
    </div>
  {/if}
</main>
