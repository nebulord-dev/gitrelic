<script lang="ts">
  import { fitBars } from './activity';
  import type { WeeklyActivity } from '@gitrelic/scene';

  let {
    activity,
    height = 40,
    highlight = false,
    maxBars = 180,
    split = null,
  }: {
    activity: WeeklyActivity;
    /** Bar area height, px. */
    height?: number;
    /** Beyond this many weeks, neighbouring weeks share a bar. */
    maxBars?: number;
    /** Light the weeks that touched the entity; the rest stay grey. */
    highlight?: boolean;
    /**
     * A lens's part of each week (AI & Co-authors: the commits with AI in
     * them, of the selection's when highlighted), shaded in the accent from
     * the baseline up.
     */
    split?: readonly number[] | null;
  } = $props();

  let bars = $derived(fitBars(activity, maxBars, split));
  let peak = $derived(Math.max(1, ...bars.totals));

  // sqrt so one huge week doesn't flatten the rest.
  const barHeight = (n: number) =>
    n === 0 ? 2 : Math.max(3, Math.round(height * Math.sqrt(n / peak)));
  // With a split the accent means the split, so a selection's weeks light
  // grey and the rest dim.
  const barClass = (i: number, total: number) =>
    total === 0
      ? 'bg-panel-border'
      : bars.split
        ? highlight && bars.hits[i] === 0
          ? 'bg-control-border'
          : 'bg-ghost'
        : highlight && bars.hits[i] > 0
          ? 'bg-accent'
          : highlight
            ? 'bg-control-border'
            : 'bg-ghost';
</script>

<div
  class="flex items-end gap-px overflow-hidden border-b border-panel-border"
  style:height="{height}px"
  aria-hidden="true"
>
  {#each bars.totals as total, i (i)}
    <span
      class={[
        'flex min-w-px flex-1 flex-col justify-end overflow-hidden rounded-t-[1px]',
        barClass(i, total),
      ]}
      style:height="{barHeight(total)}px"
    >
      {#if bars.split && total > 0 && bars.split[i] > 0}
        <span
          data-split
          class="w-full bg-accent"
          style:height="{(bars.split[i] / total) * 100}%"
        ></span>
      {/if}
    </span>
  {/each}
</div>
