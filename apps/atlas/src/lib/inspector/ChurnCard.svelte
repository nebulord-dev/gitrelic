<script lang="ts">
  import {
    churnFindings,
    churnSwarmOf,
    hardestRow,
    ids,
    perFile,
    REPO_ID,
    rowName,
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

  let rows = $derived(churnSwarmOf(report));
  // With nothing selected the lens leads with the package churning hardest
  // per file (docs/atlas-views.md › Churn), the busiest when none is big enough.
  let lead = $derived(hardestRow(rows) ?? rows[0]);
  let findings = $derived(churnFindings({ report, commits: null }));
  let top = $derived(rows.slice(0, 5));
  let files = $derived(rows.reduce((sum, r) => sum + r.files.length, 0));
  let maxTotal = $derived(top[0]?.total ?? 0);

  const rowId = (dir: string): EntityId =>
    dir === '' ? REPO_ID : ids.dir(dir);
  const n = (v: number) => v.toLocaleString('en-US');
  const oneDecimal = (v: number) => v.toFixed(1).replace(/\.0$/, '');
</script>

<Card eyebrow="Churn">
  {#if lead}
    <div class="flex items-baseline gap-2.5">
      <span class="font-mono text-5xl leading-none font-medium text-accent"
        >{oneDecimal(perFile(lead))}</span
      >
      <span class="text-[14px] text-soft"
        >changes per file in
        <button
          type="button"
          onclick={() => onselect?.(rowId(lead.dir))}
          class="cursor-pointer bg-transparent p-0 font-[inherit] text-text hover:text-accent"
          >{rowName(lead.dir)}</button
        >, across {n(lead.files.length)} files</span
      >
    </div>
  {/if}
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {:else}
    <p class="m-0 text-[13px] text-soft">
      No source file changed in this window.
    </p>
  {/each}
</Card>

{#if top.length > 0}
  <Card eyebrow="Busiest packages">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each top as row (row.dir)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            onclick={() => onselect?.(rowId(row.dir))}
            class="grid w-full cursor-pointer grid-cols-[1fr_64px_auto] items-center gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]"
              >{rowName(row.dir)}</span
            >
            <span class="h-2 bg-control-border">
              <span
                class="block h-2 bg-accent"
                style:width={`${maxTotal > 0 ? Math.round((100 * row.total) / maxTotal) : 0}%`}
              ></span>
            </span>
            <span class="font-mono text-[12px] text-muted"
              >{n(row.total)} · {oneDecimal(perFile(row))}/file</span
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
