<script lang="ts">
  import {
    ids,
    lensReadings,
    loudestView,
    PRESET_GROUPS,
    type EntityId,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    report,
    onselect,
  }: {
    report: GitrelicReport;
    /** Selecting a lens previews it on the Overview. */
    onselect?: (id: EntityId) => void;
  } = $props();

  let readings = $derived(lensReadings(report));
  let loud = $derived(
    readings.filter((r) => r.grade >= 2).sort((a, b) => b.grade - a.grade),
  );
  // The view the fan opens on, named only when something is loud.
  let loudestLabel = $derived.by(() => {
    if (loud.length === 0) return undefined;
    const view = loudestView(readings);
    return PRESET_GROUPS.find((g) => g.id === view)?.label;
  });
</script>

<Card eyebrow="Repo map">
  <div class="flex items-baseline gap-2.5">
    <span class="font-mono text-5xl leading-none font-medium text-accent"
      >{loud.length}</span
    >
    <span class="text-[14px] text-soft"
      >of {readings.length} lenses read well outside normal</span
    >
  </div>
  {#if loudestLabel}
    <p class="m-0 text-[15px] leading-relaxed">
      The loudest view is <span class="text-accent">{loudestLabel}</span>. Click
      a view or a lens to see what it points at.
    </p>
  {:else}
    <p class="m-0 text-[15px] leading-relaxed">
      No lens reads outside normal for a repo this size. Click any view or lens
      to see what it points at.
    </p>
  {/if}
</Card>

{#if loud.length > 0}
  <Card eyebrow="Loudest signals">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each loud as r (r.preset)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            title={r.reason}
            onclick={() => onselect?.(ids.analyzer(r.preset))}
            class="grid w-full cursor-pointer grid-cols-[1fr_auto] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span>{r.label}</span>
            <span class="font-mono text-[13px] text-risk-3">{r.value}</span>
          </button>
        </li>
      {/each}
    </ul>
  </Card>
{/if}
