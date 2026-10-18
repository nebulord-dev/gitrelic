<script lang="ts">
  import {
    ids,
    lensReadings,
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
    /** Selecting a lens fans it out on the ring. */
    onselect?: (id: EntityId) => void;
  } = $props();

  let readings = $derived(lensReadings(report));
  let loud = $derived(
    readings.filter((r) => r.grade >= 2).sort((a, b) => b.grade - a.grade),
  );
  // The view with the most grade, for the one-line finding.
  let loudestView = $derived.by(() => {
    const score = new Map<string, number>();
    for (const r of loud)
      score.set(r.group, (score.get(r.group) ?? 0) + r.grade);
    const [top] = [...score].sort((a, b) => b[1] - a[1]);
    return top ? PRESET_GROUPS.find((g) => g.id === top[0])?.label : undefined;
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
  {#if loudestView}
    <p class="m-0 text-[15px] leading-relaxed">
      The loudest view is <span class="text-accent">{loudestView}</span>. Click
      a lens on the ring to see what it points at.
    </p>
  {:else}
    <p class="m-0 text-[15px] leading-relaxed">
      No lens reads outside normal for a repo this size. Click any lens on the
      ring to see what it points at.
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
