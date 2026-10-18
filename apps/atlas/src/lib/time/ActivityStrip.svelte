<script lang="ts">
  import { fitBars } from './activity';
  import type { WeeklyActivity } from '@gitrelic/scene';

  let {
    activity,
    height = 40,
    highlight = false,
    maxBars = 180,
  }: {
    activity: WeeklyActivity;
    /** Bar area height, px. */
    height?: number;
    /** Beyond this many weeks, neighbouring weeks share a bar. */
    maxBars?: number;
    /** Light the weeks that touched the entity; the rest stay grey. */
    highlight?: boolean;
  } = $props();

  let bars = $derived(fitBars(activity, maxBars));
  let peak = $derived(Math.max(1, ...bars.totals));

  // sqrt so one huge week doesn't flatten the rest.
  const barHeight = (n: number) =>
    n === 0 ? 2 : Math.max(3, Math.round(height * Math.sqrt(n / peak)));
</script>

<div
  class="flex items-end gap-px overflow-hidden border-b border-panel-border"
  style:height="{height}px"
  aria-hidden="true"
>
  {#each bars.totals as total, i (i)}
    <span
      class={[
        'min-w-px flex-1 rounded-t-[1px]',
        total === 0
          ? 'bg-panel-border'
          : highlight && bars.hits[i] > 0
            ? 'bg-accent'
            : highlight
              ? 'bg-control-border'
              : 'bg-ghost',
      ]}
      style:height="{barHeight(total)}px"
    ></span>
  {/each}
</div>
