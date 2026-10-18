<script lang="ts">
  import {
    catalogEntry,
    entityKey,
    entityKind,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import DirCard from '../inspector/DirCard.svelte';
  import ExplainCard from '../inspector/ExplainCard.svelte';
  import FileCard from '../inspector/FileCard.svelte';
  import PersonCard from '../inspector/PersonCard.svelte';
  import RepositoryCard from '../inspector/RepositoryCard.svelte';
  import { paletteShortcut } from './shortcut';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    report,
    index,
    selection = null,
    view = null,
    onselect,
    onopen,
  }: {
    report: GitrelicReport;
    index: EntityIndex;
    /** Already resolved through `index` (Nav drops anything unknown). */
    selection?: EntityId | null;
    view?: string | null;
    onselect?: (id: EntityId | null) => void;
    onopen?: (id: string) => void;
  } = $props();

  let kind = $derived(selection ? entityKind(selection) : null);
  let key = $derived(selection ? entityKey(selection) : '');
  let viewEntry = $derived(view ? catalogEntry(view) : undefined);
  let analyzer = $derived(kind === 'analyzer' ? catalogEntry(key) : undefined);
</script>

<!-- Escape clears the selection, unless something else (the palette) used it. -->
<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && selection && !e.defaultPrevented)
      onselect?.(null);
  }}
/>

<!--
  Docked from 1200px (320px, 380px from 1600px). Narrower, it's a drawer that
  opens over the stage while something is selected; a click beside it closes it.
-->
{#if selection}
  <div
    class="fixed inset-0 z-20 bg-[rgb(0_0_0/0.3)] min-[1200px]:hidden"
    role="presentation"
    onclick={() => onselect?.(null)}
  ></div>
{/if}
<aside
  aria-label="Inspector"
  class={[
    'card w-80 shrink-0 flex-col gap-4 overflow-y-auto px-5 py-4.5 min-[1600px]:w-95',
    selection
      ? 'flex max-[1199px]:fixed max-[1199px]:top-16 max-[1199px]:right-4 max-[1199px]:bottom-4 max-[1199px]:z-30'
      : 'hidden min-[1200px]:flex',
  ]}
>
  {#if selection}
    <button
      type="button"
      class="cursor-pointer self-end bg-transparent p-0 text-[12px] text-muted hover:text-text"
      onclick={() => onselect?.(null)}>Clear selection ✕</button
    >
  {/if}

  {#if kind === 'file'}
    <FileCard file={key} {report} {onselect} {onopen} />
  {:else if kind === 'person'}
    <PersonCard email={key} {report} {index} {onselect} />
  {:else if kind === 'dir'}
    <DirCard dir={key} {report} />
  {:else if analyzer}
    <ExplainCard entry={analyzer} />
  {:else}
    <RepositoryCard {report} />
    {#if viewEntry}
      <ExplainCard entry={viewEntry} />
    {/if}
    <p class="m-0 text-[13px] text-muted">
      Press <kbd class="rounded-chip border border-control-border px-1"
        >{paletteShortcut()}</kbd
      > to find a file, person or analyzer.
    </p>
  {/if}
</aside>
