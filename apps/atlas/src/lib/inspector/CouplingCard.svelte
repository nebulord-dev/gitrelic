<script lang="ts">
  import {
    BLAST_WIDE,
    blastSummaryOf,
    couplingFindings,
    ids,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Bars from './Bars.svelte';
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

  // With nothing selected the lens leads with blast radius: how many files a
  // change usually drags along (docs/atlas-views.md › Coupling).
  let blast = $derived(blastSummaryOf(report));
  let findings = $derived(couplingFindings({ report, commits: null }));
  const n = (v: number) => v.toLocaleString('en-US');
  const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
  const TICKS = [
    [0, '0'],
    [5, '5'],
    [10, '10'],
    [15, '15'],
    [19, '19+'],
  ] as const;
</script>

<Card eyebrow="Coupling">
  {#if blast.rated > 0}
    <div class="flex items-baseline gap-2.5">
      <span class="font-mono text-5xl leading-none font-medium text-accent"
        >{n(blast.wide)}</span
      >
      <span class="text-[14px] text-soft"
        >of {n(blast.rated)} files usually change with {BLAST_WIDE} or more others{blast.unrated >
        0
          ? ` (${n(blast.unrated)} more have under ${blast.minCommits} commits to say)`
          : ''}</span
      >
    </div>
    <Bars
      values={blast.bins}
      label="Files by how many other files their commits usually change"
      accentFrom={BLAST_WIDE}
      ticks={TICKS}
    />
    <p class="m-0 text-[12px] text-muted">
      Files by the median number of other files their commits changed.
    </p>
  {/if}
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {/each}
</Card>

{#if blast.widest.length > 0}
  <Card eyebrow="Widest changes">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each blast.widest as f (f.file)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            title={f.file}
            onclick={() => onselect?.(ids.file(f.file))}
            class="grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]"
              >{baseName(f.file)}</span
            >
            <span class="font-mono text-[12px] text-muted"
              >{n(f.median)} per change · {n(f.commits)} commits</span
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
        >All {n(blast.rated)} files in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}
