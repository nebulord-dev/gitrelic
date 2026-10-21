<script lang="ts">
  import {
    catalogEntry,
    entityKey,
    entityKind,
    FAN_VIEWS,
    PRESET_GROUPS,
    type EntityId,
    type EntityIndex,
    type PresetGroup,
    type WeeklyActivity,
  } from '@gitrelic/scene';
  import { tick } from 'svelte';

  import ChurnCard from '../inspector/ChurnCard.svelte';
  import DirCard from '../inspector/DirCard.svelte';
  import ExplainCard from '../inspector/ExplainCard.svelte';
  import FileCard from '../inspector/FileCard.svelte';
  import { fileSections, scrollToSection } from '../inspector/fileSections';
  import FixRateCard from '../inspector/FixRateCard.svelte';
  import HotspotsCard from '../inspector/HotspotsCard.svelte';
  import LensPreviewCard from '../inspector/LensPreviewCard.svelte';
  import PersonCard from '../inspector/PersonCard.svelte';
  import RepoMapCard from '../inspector/RepoMapCard.svelte';
  import RepositoryCard from '../inspector/RepositoryCard.svelte';
  import RiskCard from '../inspector/RiskCard.svelte';
  import ViewCard from '../inspector/ViewCard.svelte';
  import { modalOpen, paletteShortcut, pressed } from './shortcut';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    report,
    index,
    view,
    lens = null,
    selection = null,
    activity = null,
    historyFailed = false,
    collapsed = $bindable(false),
    onselect,
    onopen,
    onguide,
    ontable,
  }: {
    report: GitrelicReport;
    index: EntityIndex;
    view: PresetGroup;
    lens?: string | null;
    /** Already resolved through `index` (Nav drops anything unknown). */
    selection?: EntityId | null;
    /** Weekly commits with the selection's marked; null while loading. */
    activity?: WeeklyActivity | null;
    historyFailed?: boolean;
    /** Docked from 1200px: the 52px strip instead of the full column. */
    collapsed?: boolean;
    onselect?: (id: EntityId | null) => void;
    /** Opens a lens that has an Atlas view. */
    onopen?: (lens: string) => void;
    onguide?: () => void;
    /** Opens the open lens's detail table. */
    ontable?: () => void;
  } = $props();

  let kind = $derived(selection ? entityKind(selection) : null);
  let key = $derived(selection ? entityKey(selection) : '');
  let lensEntry = $derived(lens ? catalogEntry(lens) : undefined);
  let analyzer = $derived(kind === 'analyzer' ? catalogEntry(key) : undefined);
  let selectedView = $derived(
    kind === 'view' && (FAN_VIEWS as readonly string[]).includes(key)
      ? (key as (typeof FAN_VIEWS)[number])
      : undefined,
  );
  let viewLabel = $derived(PRESET_GROUPS.find((g) => g.id === view)?.label);

  // The strip's shortcuts into a selected file's sections.
  const ICON: Record<string, string> = {
    'insp-flagged': 'M4 4v16M4 5h11l-2 4 2 4H4',
    'insp-people':
      'M8 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6M3 20c0-3 2.5-5 5-5s5 2 5 5M16 11a3 3 0 1 0 0-6M21 20c0-3-1.5-5-4-5',
    'insp-activity': 'M3 12h4l2-6 4 12 2-6h6',
    'insp-coupled':
      'M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1',
  };

  // Icons for the sections this file actually has.
  let stripSections = $derived(
    kind === 'file'
      ? fileSections(key, report).map((s) => ({
          ...s,
          d: ICON[s.anchor] ?? '',
        }))
      : [],
  );

  async function openAt(anchor: string) {
    collapsed = false;
    await tick();
    scrollToSection(anchor);
  }

  // The strip only exists docked (from 1200px); below that, I does nothing.
  const docked = () =>
    globalThis.matchMedia?.('(min-width: 1200px)').matches ?? true;

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && selection && !e.defaultPrevented) {
      onselect?.(null);
    } else if (pressed(e, 'i') && docked() && !modalOpen()) {
      collapsed = !collapsed;
    }
  }
</script>

<!-- Escape clears the selection, unless something else (the palette) used it. -->
<svelte:window onkeydown={onKey} />

{#if collapsed}
  <aside
    aria-label="Inspector, collapsed"
    class="card hidden w-13 shrink-0 flex-col items-center gap-1.5 py-2 min-[1200px]:flex"
  >
    <button
      type="button"
      aria-label="Expand the inspector (I)"
      title="Expand (I)"
      onclick={() => (collapsed = false)}
      class="grid size-10 cursor-pointer place-content-center rounded-chip border border-control-border bg-transparent text-soft hover:text-text"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"><path d="M15 6l-6 6 6 6" /></svg
      >
    </button>
    {#if selection}
      <!-- Something is selected, whatever its kind: say so, and open on it. -->
      <button
        type="button"
        aria-label={`Show the selected ${kind ?? 'item'}`}
        title={`Selected ${kind ?? 'item'}`}
        onclick={() => (collapsed = false)}
        class="grid size-10 cursor-pointer place-content-center rounded-chip bg-control-border"
      >
        <span class="size-2 rounded-full bg-accent" aria-hidden="true"></span>
      </button>
    {/if}
    {#if kind === 'file'}
      {#each stripSections as s (s.anchor)}
        <button
          type="button"
          aria-label={`Open the inspector at ${s.label}`}
          title={s.label}
          onclick={() => openAt(s.anchor)}
          class="grid size-10 cursor-pointer place-content-center rounded-chip bg-transparent text-muted hover:text-text"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"><path d={s.d} /></svg
          >
        </button>
      {/each}
    {/if}
    <button
      type="button"
      aria-label="Open the guide (?)"
      title="Guide (?)"
      onclick={() => onguide?.()}
      class="mt-auto grid size-10 cursor-pointer place-content-center rounded-chip bg-transparent text-muted hover:text-text"
    >
      ?
    </button>
  </aside>
{/if}

<!--
  Docked from 1200px at 400px (the width is for long names). Narrower, it's a
  drawer that opens over the stage while something is selected; a click
  beside it closes it.
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
    // Positioned, so absolute children (sr-only text) scroll inside it
    // rather than stretching the page past the window.
    'relative w-100 max-w-[calc(100vw-32px)] shrink-0 flex-col gap-3 overflow-y-auto',
    selection
      ? 'flex max-[1199px]:fixed max-[1199px]:top-16 max-[1199px]:right-4 max-[1199px]:bottom-4 max-[1199px]:z-30'
      : 'hidden min-[1200px]:flex',
    collapsed && 'min-[1200px]:hidden',
  ]}
>
  <div class="flex items-center justify-end gap-2">
    {#if selection}
      <button
        type="button"
        class="cursor-pointer rounded-chip border border-control-border bg-transparent px-2.5 py-1 font-[inherit] text-[12px] text-muted hover:text-text"
        onclick={() => onselect?.(null)}>Clear selection ✕</button
      >
    {/if}
    <button
      type="button"
      aria-label="Collapse the inspector (I)"
      title="Collapse (I)"
      onclick={() => (collapsed = true)}
      class="hidden size-7 cursor-pointer place-content-center rounded-chip border border-control-border bg-transparent text-muted hover:text-text min-[1200px]:grid"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg
      >
    </button>
  </div>

  {#if kind === 'file'}
    <FileCard
      file={key}
      {report}
      {index}
      {activity}
      {historyFailed}
      {onselect}
      {onopen}
    />
  {:else if kind === 'person'}
    <PersonCard
      email={key}
      {report}
      {index}
      {activity}
      {historyFailed}
      {onselect}
    />
  {:else if kind === 'dir'}
    <DirCard dir={key} {report} {activity} {historyFailed} />
  {:else if selectedView}
    <ViewCard view={selectedView} {report} {onselect} {onopen} />
  {:else if analyzer}
    <ExplainCard entry={analyzer} />
    <LensPreviewCard
      preset={analyzer.id}
      {report}
      {index}
      {onselect}
      {onopen}
      onRing={lens === 'overview'}
    />
  {:else if lens === 'hotspots' && lensEntry}
    <ExplainCard entry={lensEntry} />
    <HotspotsCard {report} {index} {onselect} {ontable} />
  {:else if lens === 'churn' && lensEntry}
    <ExplainCard entry={lensEntry} />
    <ChurnCard {report} {index} {onselect} {ontable} />
  {:else if lens === 'cursed-files' && lensEntry}
    <ExplainCard entry={lensEntry} />
    <RiskCard {report} {index} {onselect} {ontable} />
  {:else if lens === 'fix-rate' && lensEntry}
    <ExplainCard entry={lensEntry} />
    <FixRateCard {report} {index} {onselect} {ontable} />
  {:else if lens === 'overview'}
    <RepoMapCard {report} {onselect} />
    {#if lensEntry}<ExplainCard entry={lensEntry} />{/if}
  {:else if lensEntry}
    <ExplainCard entry={lensEntry} />
    <RepositoryCard {report} />
  {:else}
    <RepositoryCard {report} />
    <section class="card flex flex-col gap-2 px-5 py-4.5 text-[13px] text-soft">
      <p class="m-0">
        {viewLabel}'s lenses open in the classic dashboard until their Atlas
        views land.
      </p>
      <p class="m-0 text-muted">
        Press <kbd class="rounded-chip border border-control-border px-1"
          >{paletteShortcut()}</kbd
        >
        to find a file, person or analyzer, or
        <kbd class="rounded-chip border border-control-border px-1">?</kbd> for the
        guide.
      </p>
    </section>
  {/if}
</aside>
