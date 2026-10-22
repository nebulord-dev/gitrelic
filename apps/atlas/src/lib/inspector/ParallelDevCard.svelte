<script lang="ts">
  import {
    ids,
    parallelDevFindings,
    parallelPairsOf,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import EntityChip from './EntityChip.svelte';
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
    /** Opens the table of files people collided on. */
    ontable?: () => void;
  } = $props();

  let data = $derived(parallelPairsOf(report));
  let findings = $derived(parallelDevFindings({ report, commits: null }));
  let top = $derived(data.allPairs.slice(0, 6));
  let files = $derived(report.parallelDev.files.length);
  let nameOf = $derived(
    new Map(report.contributors.contributors.map((c) => [c.email, c.name])),
  );

  const n = (v: number) => v.toLocaleString('en-US');
</script>

<Card eyebrow="Parallel Dev">
  <div class="flex items-baseline gap-2.5">
    <span class="font-mono text-5xl leading-none font-medium text-accent"
      >{n(data.allPairs.length)}</span
    >
    <span class="text-[14px] text-soft"
      >pair{data.allPairs.length === 1 ? '' : 's'} of people on the same files in
      the same week</span
    >
  </div>
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {:else}
    <p class="m-0 text-[13px] text-soft">
      No two people committed to the same file in the same week.
    </p>
  {/each}
</Card>

{#if top.length > 0}
  <Card eyebrow="Pairs who meet most">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each top as p (`${p.a}|${p.b}`)}
        <li
          class="flex flex-wrap items-center gap-1.5 border-t border-panel-border py-1.5 first:border-t-0"
        >
          <EntityChip
            id={ids.person(p.a)}
            text={nameOf.get(p.a) ?? p.a}
            {index}
            {onselect}
          />
          <span class="text-[12px] text-muted">+</span>
          <EntityChip
            id={ids.person(p.b)}
            text={nameOf.get(p.b) ?? p.b}
            {index}
            {onselect}
          />
          <span class="ml-auto text-[12px] text-muted"
            >{n(p.weeks)} week{p.weeks === 1 ? '' : 's'}</span
          >
        </li>
      {/each}
    </ul>
    {#if ontable && files > 0}
      <button
        type="button"
        onclick={() => ontable?.()}
        class="cursor-pointer self-start bg-transparent p-0 font-[inherit] text-[13px] text-accent"
        >All {n(files)} files people collided on in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}
