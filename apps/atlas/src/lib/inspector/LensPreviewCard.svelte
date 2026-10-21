<script lang="ts">
  import {
    catalogEntry,
    classicUrl,
    lensReadings,
    lensTopEntities,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    preset,
    report,
    index,
    onselect,
    onopen,
    onMap = false,
  }: {
    preset: string;
    report: GitrelicReport;
    index: EntityIndex;
    onselect?: (id: EntityId) => void;
    /** Opens a lens that has an Atlas view. */
    onopen?: (lens: string) => void;
    /** The Overview is showing, so a second click on the lens opens it. */
    onMap?: boolean;
  } = $props();

  let entry = $derived(catalogEntry(preset));
  let reading = $derived(lensReadings(report).find((r) => r.preset === preset));
  let fanned = $derived(lensTopEntities(preset, report, index));
</script>

{#if entry && reading}
  <Card eyebrow="On the map">
    <div class="flex items-baseline gap-2.5">
      <span class="text-[22px] font-semibold">{reading.value}</span>
    </div>
    {#if reading.reason}
      <p class="m-0 text-[14px] leading-relaxed text-soft">{reading.reason}.</p>
    {/if}
    {#if entry.atlas}
      <button
        type="button"
        onclick={() => onopen?.(preset)}
        class="h-10 cursor-pointer rounded-chip border border-accent bg-transparent font-[inherit] text-[14px] text-accent"
        >Open {entry.label}</button
      >
    {:else}
      <a
        href={classicUrl(preset)}
        class="grid h-10 place-content-center rounded-chip border border-control-border text-[14px] text-text no-underline hover:text-accent"
        >Open {entry.label} in classic ↗</a
      >
    {/if}
    {#if onMap && entry.atlas}
      <p class="m-0 text-[12px] text-muted">Or click the lens again.</p>
    {/if}
  </Card>

  {#if fanned.length > 0}
    <Card eyebrow="What it points at">
      <ul class="m-0 flex list-none flex-col p-0">
        {#each fanned as e (e.id)}
          <li class="border-t border-panel-border first:border-t-0">
            <button
              type="button"
              onclick={() => onselect?.(e.id)}
              class="flex w-full cursor-pointer flex-col gap-0.5 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
            >
              <span class="[overflow-wrap:anywhere]">{e.label}</span>
              <span class="text-[12px] text-muted">{e.value}</span>
            </button>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
{/if}
