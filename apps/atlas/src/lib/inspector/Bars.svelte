<script lang="ts">
  // A small bar chart for the inspector: one bar per value, the ones from
  // `accentFrom` up in the accent, an optional marker line (a median) and a
  // few axis labels. DOM, not canvas: it sits in the inspector's flow.
  let {
    values,
    label,
    accentFrom = Infinity,
    marker,
    ticks = [],
    height = 72,
  }: {
    values: readonly number[];
    /** What the chart shows, for screen readers. */
    label: string;
    accentFrom?: number;
    /** The index to mark (the median), if any. */
    marker?: number;
    /** [index, text] pairs under the bars. */
    ticks?: readonly (readonly [number, string])[];
    height?: number;
  } = $props();

  let max = $derived(Math.max(1, ...values));
  const pct = (i: number) => `${((i + 0.5) / values.length) * 100}%`;
</script>

<figure class="m-0 flex flex-col gap-1" aria-label={label}>
  <div class="relative flex items-end gap-px" style:height={`${height}px`}>
    {#each values as v, i (i)}
      <span
        class={['block flex-1', i >= accentFrom ? 'bg-accent' : 'bg-soft']}
        style:height={`${(v / max) * 100}%`}
        title={`${v}`}
      ></span>
    {/each}
    {#if marker !== undefined}
      <span
        class="absolute top-0 bottom-0 w-0.5 bg-accent"
        style:left={pct(marker)}
        aria-hidden="true"
      ></span>
    {/if}
  </div>
  {#if ticks.length > 0}
    <div class="relative h-4 font-mono text-[11px] text-muted">
      {#each ticks as [i, text] (i)}
        <span class="absolute -translate-x-1/2" style:left={pct(i)}>{text}</span
        >
      {/each}
    </div>
  {/if}
</figure>
