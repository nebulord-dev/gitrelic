<script lang="ts">
  import {
    catalogEntry,
    classicUrl,
    type FactTier,
    type FileFact,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';

  let {
    rows,
    id,
    onopen,
  }: {
    rows: readonly FileFact[];
    id?: string;
    /** Opens a lens that has an Atlas view. */
    onopen?: (lens: string) => void;
  } = $props();

  const RANK: Record<FactTier, number> = {
    critical: 0,
    warning: 1,
    moderate: 2,
    healthy: 3,
  };
  const TIER_CLASS: Record<FactTier, string> = {
    critical: 'text-risk-3',
    warning: 'text-risk-2',
    moderate: 'text-risk-1',
    healthy: 'text-soft',
  };

  // Loudest first; rows without a tier keep their place after the tiered ones.
  let sorted = $derived(
    rows
      .map((row, i) => ({
        row,
        i,
        entry: row.lens ? catalogEntry(row.lens) : undefined,
      }))
      .sort(
        (a, b) =>
          (a.row.tier ? RANK[a.row.tier] : 4) -
            (b.row.tier ? RANK[b.row.tier] : 4) || a.i - b.i,
      ),
  );
</script>

{#if sorted.length > 0}
  <Card eyebrow="Flagged by" {id}>
    <ul class="m-0 flex list-none flex-col p-0 text-[14px]">
      {#each sorted as { row, entry } (row.label)}
        {@const value = row.tier ? TIER_CLASS[row.tier] : 'text-text'}
        <li class="border-t border-panel-border first:border-t-0">
          {#if entry?.atlas}
            <button
              type="button"
              onclick={() => onopen?.(entry.id)}
              class="grid w-full cursor-pointer grid-cols-[1fr_auto_12px] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px]"
            >
              <span class="text-muted">{row.label}</span>
              <span class={['text-right [overflow-wrap:anywhere]', value]}
                >{row.value}</span
              >
              <span class="text-[12px] text-muted" aria-hidden="true">›</span>
            </button>
          {:else if entry}
            <a
              href={classicUrl(entry.id)}
              class="grid grid-cols-[1fr_auto_12px] items-baseline gap-3 py-1.5 no-underline"
            >
              <span class="text-muted">{row.label}</span>
              <span class={['text-right [overflow-wrap:anywhere]', value]}
                >{row.value}</span
              >
              <span class="text-[11px] text-muted" aria-hidden="true">↗</span>
              <span class="sr-only"
                >(opens {entry.label} in the classic dashboard)</span
              >
            </a>
          {:else}
            <div
              class="grid grid-cols-[1fr_auto_12px] items-baseline gap-3 py-1.5"
            >
              <span class="text-muted">{row.label}</span>
              <span class={['text-right [overflow-wrap:anywhere]', value]}
                >{row.value}</span
              >
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </Card>
{/if}
