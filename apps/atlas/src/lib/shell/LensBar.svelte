<script lang="ts">
  import {
    classicUrl,
    lensesOf,
    PRESET_GROUPS,
    type Badge,
    type PresetGroup,
  } from '@gitrelic/scene';

  let {
    view,
    lens = null,
    badges,
    onopen,
  }: {
    view: PresetGroup;
    lens?: string | null;
    badges: ReadonlyMap<string, Badge>;
    onopen?: (lens: string) => void;
  } = $props();

  let label = $derived(PRESET_GROUPS.find((g) => g.id === view)?.label ?? '');
  let lenses = $derived(lensesOf(view));
</script>

<!--
  The only tab row Atlas has (docs/atlas-views.md). Lenses without an Atlas
  view stay listed, marked ↗, and open classic, so nothing is unreachable.
  One row that scrolls sideways when it can't fit; it never wraps.
-->
<nav
  aria-label={`${label} lenses`}
  class="lens-bar flex shrink-0 items-center overflow-x-auto border-b border-panel-border"
>
  <span
    class="mr-3 shrink-0 text-[11px] tracking-[0.16em] whitespace-nowrap text-muted uppercase"
    >{label}</span
  >
  {#each lenses as entry (entry.id)}
    {@const badge = badges.get(entry.id)}
    {#if entry.atlas}
      <button
        type="button"
        aria-current={lens === entry.id ? 'page' : undefined}
        onclick={() => onopen?.(entry.id)}
        class={[
          'flex h-10 shrink-0 cursor-pointer items-center gap-1 border-0 border-b-2 bg-transparent px-2 font-[inherit] text-[13.5px] whitespace-nowrap',
          lens === entry.id
            ? 'border-accent text-text'
            : 'border-transparent text-muted hover:text-text',
        ]}
      >
        {entry.label}
        {#if badge}
          <span class="size-1.5 rounded-full bg-accent" title={badge.reason}
          ></span>
          <span class="sr-only">({badge.reason})</span>
        {/if}
      </button>
    {:else}
      <a
        href={classicUrl(entry.id)}
        class="flex h-10 shrink-0 items-center gap-1 px-2 text-[13.5px] whitespace-nowrap text-muted no-underline hover:text-soft"
      >
        {entry.label}
        {#if badge}
          <span class="size-1.5 rounded-full bg-accent" title={badge.reason}
          ></span>
          <span class="sr-only">({badge.reason})</span>
        {/if}
        <span class="text-[10px]" aria-hidden="true">↗</span>
        <span class="sr-only">(opens the classic dashboard)</span>
      </a>
    {/if}
  {/each}
</nav>

<style>
  /* When the row scrolls, its right edge fades so the cut reads as "more". */
  .lens-bar {
    scrollbar-width: none;
    mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
  }
</style>
