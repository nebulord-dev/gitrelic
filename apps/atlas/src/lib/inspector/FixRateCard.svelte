<script lang="ts">
  import {
    fixRateFindings,
    fixRateOf,
    ids,
    ratePct,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import FindingCard from './FindingCard.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    report,
    index,
    onselect,
    ontable,
  }: {
    report: GitrelicReport;
    index: EntityIndex;
    onselect?: (id: EntityId) => void;
    /** Opens the full table of files. */
    ontable?: () => void;
  } = $props();

  let data = $derived(fixRateOf(report));
  let above = $derived(data.points.filter((p) => p.aboveChance).length);
  let findings = $derived(fixRateFindings({ report, commits: null }));
  // The lens's order: above chance first, then by rate.
  let top = $derived(data.points.filter((p) => p.fixedAfter > 0).slice(0, 5));

  const n = (v: number) => v.toLocaleString('en-US');
  const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);
</script>

<Card eyebrow="Fix rate">
  {#if data.available}
    <div class="flex items-baseline gap-2.5">
      <span class="font-mono text-5xl leading-none font-medium text-accent"
        >{n(above)}</span
      >
      <span class="text-[14px] text-soft"
        >file{above === 1 ? '' : 's'} above chance, of {n(data.points.length)} rated</span
      >
    </div>
  {/if}
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {:else}
    <p class="m-0 text-[13px] text-soft">
      No change is old enough to rate yet.
    </p>
  {/each}
</Card>

{#if top.length > 0}
  <Card eyebrow="Fixed most often">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each top as p (p.file)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            onclick={() => onselect?.(ids.file(p.file))}
            class="grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]"
              >{baseName(p.file)}</span
            >
            <span class="text-[12px] text-muted"
              >{n(p.fixedAfter)} of {n(p.changes)}</span
            >
            <span
              class={[
                'font-mono text-[12px]',
                p.aboveChance ? 'text-accent' : 'text-muted',
              ]}>{ratePct(p.rate)}</span
            >
          </button>
        </li>
      {/each}
    </ul>
    {#if ontable}
      <button
        type="button"
        onclick={() => ontable?.()}
        class="cursor-pointer self-start bg-transparent p-0 font-[inherit] text-[13px] text-accent"
        >All {n(data.points.length)} rated files in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}
