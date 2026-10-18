<script lang="ts">
  import { onMount, tick } from 'svelte';

  import { AtlasStage } from '../engine/atlasStage';
  import { PixiStage } from '../engine/pixiStage';
  import { prefersReducedMotion } from '../engine/reducedMotion';
  import { paletteFromDocument } from '../engine/themeBridge';
  import type { EntityId, Scene, ThemeName } from '@gitrelic/scene';

  let {
    scene = null,
    theme,
    selected = null,
    onselect,
  }: {
    scene?: Scene | null;
    theme: ThemeName;
    selected?: EntityId | null;
    onselect?: (id: EntityId | null) => void;
  } = $props();

  let host = $state<HTMLDivElement>();
  let labels = $state<HTMLDivElement>();
  // A class instance, so Svelte doesn't proxy it; only the reference is reactive.
  let stage = $state<AtlasStage | null>(null);
  let noWebgl = $state(false);
  let failure = $state<string | null>(null);

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

    AtlasStage.create(
      el,
      labels,
      { width: el.clientWidth, height: el.clientHeight },
      {
        renderer: new PixiStage(),
        readPalette: () => paletteFromDocument(),
        glow: theme === 'glow',
        reducedMotion: () => prefersReducedMotion(),
        onSelect: (id) => onselect?.(id),
      },
    ).then((made) => {
      if (disposed) {
        made?.destroy();
        return;
      }
      if (!made) {
        noWebgl = true;
        return;
      }
      created = made;
      stage = made;
      resize.observe(el);
    }, fail);

    return () => {
      disposed = true;
      resize.disconnect();
      created?.destroy();
    };
  });

  $effect(() => {
    if (stage && scene) stage.show(scene);
  });

  $effect(() => {
    const glow = theme === 'glow';
    const current = stage;
    if (!current) return;
    // App applies data-theme in its own effect; read the tokens after it.
    tick()
      .then(() => current.setTheme(paletteFromDocument(), glow))
      .catch(fail);
  });

  $effect(() => {
    stage?.select(selected);
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
      class="pointer-events-none absolute inset-0 grid place-content-center text-sm text-muted"
    >
      No views yet.
    </div>
  {/if}
</main>
