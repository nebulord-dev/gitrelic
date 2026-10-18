<script lang="ts">
  import type { WeeklyActivity } from '@gitrelic/scene';

  let {
    activity,
    height = 40,
    highlight = false,
  }: {
    activity: WeeklyActivity;
    /** Bar area height, px. */
    height?: number;
    /** Light the weeks that touched the entity; the rest stay grey. */
    highlight?: boolean;
  } = $props();

  let peak = $derived(Math.max(1, ...activity.totals));

  // sqrt so one huge week doesn't flatten the rest.
  const barHeight = (n: number) =>
    n === 0 ? 2 : Math.max(3, Math.round(height * Math.sqrt(n / peak)));
</script>

<div
  class="flex items-end gap-px border-b border-panel-border"
  style:height="{height}px"
  aria-hidden="true"
>
  {#each activity.totals as total, i (i)}
    <span
      class={[
        'min-w-px flex-1 rounded-t-[1px]',
        total === 0
          ? 'bg-panel-border'
          : highlight && activity.hits[i] > 0
            ? 'bg-accent'
            : highlight
              ? 'bg-control-border'
              : 'bg-ghost',
      ]}
      style:height="{barHeight(total)}px"
    ></span>
  {/each}
</div>
