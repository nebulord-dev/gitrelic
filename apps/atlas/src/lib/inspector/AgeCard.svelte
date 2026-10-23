<script lang="ts">
  import {
    ageFindings,
    ageRowName,
    ageStrataOf,
    ageSummaryOf,
    ids,
    REPO_ID,
    sinceText,
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

  // With nothing selected the lens leads with how much of the source has
  // gone cold (docs/atlas-views.md › Age); the findings say where and which.
  let summary = $derived(ageSummaryOf(report));
  let share = $derived(
    summary.lines > 0
      ? Math.round((100 * summary.coldLines) / summary.lines)
      : 0,
  );
  let findings = $derived(ageFindings({ report, commits: null }));
  let coldest = $derived(
    ageStrataOf(report, false)
      .filter((r) => r.cold > 0)
      .slice(0, 5),
  );
  let maxCold = $derived(coldest[0]?.cold ?? 0);
  // The table lists tests too, as the stage can.
  let files = $derived(
    ageStrataOf(report, true).reduce((sum, r) => sum + r.files.length, 0),
  );

  const rowId = (dir: string): EntityId =>
    dir === '' ? REPO_ID : ids.dir(dir);
  const n = (v: number) => v.toLocaleString('en-US');
</script>

<Card eyebrow="Age">
  <div class="flex items-baseline gap-2.5">
    <span class="font-mono text-5xl leading-none font-medium text-accent"
      >{share}%</span
    >
    <span class="text-[14px] text-soft"
      >of source lines unchanged for a year or more ({n(summary.coldLines)} of
      {n(summary.lines)})</span
    >
  </div>
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {:else}
    <p class="m-0 text-[13px] text-soft">No tracked file has a history.</p>
  {/each}
</Card>

{#if coldest.length > 0}
  <Card eyebrow="Coldest packages">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each coldest as row (row.dir)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            onclick={() => onselect?.(rowId(row.dir))}
            class="grid w-full cursor-pointer grid-cols-[1fr_64px_auto] items-center gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]"
              >{ageRowName(row.dir)}</span
            >
            <span class="h-2 bg-control-border">
              <span
                class="block h-2 bg-accent"
                style:width={`${maxCold > 0 ? Math.round((100 * row.cold) / maxCold) : 0}%`}
              ></span>
            </span>
            <span
              class={[
                'font-mono text-[12px]',
                row.dormant ? 'text-accent' : 'text-muted',
              ]}
              >{row.dormant
                ? `dormant · ${sinceText(row.newestSource)}`
                : `${n(row.cold)} cold`}</span
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
        >All {n(files)} files in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}
