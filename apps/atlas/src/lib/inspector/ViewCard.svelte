<script lang="ts">
  import {
    defaultLens,
    ids,
    lensReadings,
    PRESET_GROUPS,
    VIEW_BLURBS,
    viewHeadline,
    type EntityId,
    type FanView,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    view,
    report,
    onselect,
    onopen,
  }: {
    view: FanView;
    report: GitrelicReport;
    /** Selecting a lens previews it (on the Overview, on the stage too). */
    onselect?: (id: EntityId) => void;
    /** Opens a lens that has an Atlas view. */
    onopen?: (lens: string) => void;
  } = $props();

  let label = $derived(PRESET_GROUPS.find((g) => g.id === view)?.label ?? view);
  let readings = $derived(lensReadings(report).filter((r) => r.group === view));
  let headline = $derived(viewHeadline(view, readings));
  // Loudest first; the sort is stable, so equals keep lens-bar order.
  let ranked = $derived([...readings].sort((a, b) => b.grade - a.grade));
  let lens = $derived(defaultLens(view));
</script>

<Card eyebrow={label}>
  {#if headline}
    <div class="flex items-baseline gap-2.5">
      <span
        class={[
          'text-[22px] font-semibold',
          headline.grade >= 2 && 'text-accent',
        ]}>{headline.value}</span
      >
      <span class="text-[14px] text-soft">{headline.label}</span>
    </div>
  {/if}
  <p class="m-0 text-[15px] leading-relaxed">{VIEW_BLURBS[view]}</p>
  {#if lens}
    <button
      type="button"
      onclick={() => onopen?.(lens)}
      class="h-10 cursor-pointer rounded-chip border border-accent bg-transparent font-[inherit] text-[14px] text-accent"
      >Open {label}</button
    >
  {/if}
</Card>

<Card eyebrow="Lenses, loudest first">
  <ul class="m-0 flex list-none flex-col p-0">
    {#each ranked as r (r.preset)}
      <li class="border-t border-panel-border first:border-t-0">
        <button
          type="button"
          title={r.reason}
          onclick={() => onselect?.(ids.analyzer(r.preset))}
          class="grid w-full cursor-pointer grid-cols-[1fr_auto] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
        >
          <span>{r.label}</span>
          <span
            class={[
              'font-mono text-[13px]',
              r.grade >= 2 ? 'text-risk-3' : 'text-soft',
            ]}>{r.value}</span
          >
        </button>
      </li>
    {/each}
  </ul>
</Card>
