<script lang="ts">
  import { rippleOf } from '@gitrelic/scene';

  import Bars from './Bars.svelte';
  import Card from './Card.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let { file, report }: { file: string; report: GitrelicReport } = $props();

  // Only files with the commits a blast radius needs (core's floor) have one.
  let blast = $derived(rippleOf(report, file)?.blast);
  const n = (v: number) => v.toLocaleString('en-US');
  const TICKS = [
    [0, '0'],
    [5, '5'],
    [10, '10'],
    [15, '15'],
    [19, '19+'],
  ] as const;
</script>

{#if blast}
  <Card eyebrow="Blast radius" id="insp-blast">
    <div class="flex items-baseline gap-2.5">
      <span class="font-mono text-4xl leading-none font-medium text-accent"
        >{n(blast.median)}</span
      >
      <span class="text-[14px] text-soft"
        >other files its commits usually change (the median of {n(
          blast.commits,
        )})</span
      >
    </div>
    <Bars
      values={blast.footprint}
      label="Its commits by how many other files each changed"
      marker={blast.median}
      ticks={TICKS}
    />
    <p class="m-0 text-[12px] text-muted">
      Its commits by how many other files each changed; the line is the median.
    </p>
  </Card>
{/if}
