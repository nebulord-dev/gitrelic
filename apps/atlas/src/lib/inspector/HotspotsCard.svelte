<script lang="ts">
  import {
    distinctNames,
    hotspotFindings,
    hotspotPointsOf,
    hotspotSummary,
    ids,
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
    /** Opens the full table of scored files. */
    ontable?: () => void;
  } = $props();

  let points = $derived(hotspotPointsOf(report));
  let summary = $derived(hotspotSummary(points));
  let findings = $derived(hotspotFindings({ report, commits: null }));
  let top = $derived(points.slice(0, 5));
  // Two index.ts in the top five read as their folders, not twice the same.
  let names = $derived(distinctNames(top.map((p) => p.file)));

  const TIERS = [
    { name: 'Critical', floor: '75+', tier: 3, bar: 'bg-risk-3' },
    { name: 'Warning', floor: '50–74', tier: 2, bar: 'bg-risk-2' },
    { name: 'Moderate', floor: '25–49', tier: 1, bar: 'bg-risk-1' },
    { name: 'Low', floor: 'under 25', tier: 0, bar: 'bg-risk-0' },
  ] as const;
  const SCORE_TEXT = [
    'text-muted',
    'text-risk-1',
    'text-risk-2',
    'text-risk-3',
  ];
  // Log-scale bars: the low tier is usually a hundred times the rest.
  let widthOf = $derived((count: number) =>
    summary.total > 0
      ? Math.round(
          (100 * Math.log10(count + 1)) / Math.log10(summary.total + 1),
        )
      : 0,
  );
  const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
  const n = (v: number) => v.toLocaleString('en-US');
</script>

<Card eyebrow="Hotspots">
  <div class="flex items-baseline gap-2.5">
    <span class="font-mono text-5xl leading-none font-medium text-accent"
      >{n(summary.tiers[3])}</span
    >
    <span class="text-[14px] text-soft"
      >critical, {n(summary.tiers[2])} warning, of {n(summary.total)} scored files</span
    >
  </div>
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {:else}
    <p class="m-0 text-[13px] text-soft">
      No file scores 25 or more: nothing here is both busy and big.
    </p>
  {/each}
</Card>

{#if summary.total > 0}
  <Card eyebrow="By tier">
    <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
      {#each TIERS as t (t.tier)}
        <li class="grid grid-cols-[96px_1fr_48px] items-center gap-3">
          <span class="text-soft"
            >{t.name} <span class="text-muted">{t.floor}</span></span
          >
          <span class="h-2 bg-control-border">
            <span
              class={['block h-2', t.bar]}
              style:width={`${widthOf(summary.tiers[t.tier])}%`}
            ></span>
          </span>
          <span class="text-right font-mono">{n(summary.tiers[t.tier])}</span>
        </li>
      {/each}
    </ul>
    <p class="m-0 text-[12px] text-muted">Bars on a log scale.</p>
  </Card>

  <Card eyebrow="Top five">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each top as p (p.file)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            title={p.file}
            onclick={() => onselect?.(ids.file(p.file))}
            class="grid w-full cursor-pointer grid-cols-[36px_1fr_auto] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class={['font-mono text-[13px]', SCORE_TEXT[p.tier]]}
              >{p.score}</span
            >
            <span class="min-w-0 [overflow-wrap:anywhere]"
              >{names.get(p.file) ?? baseName(p.file)}</span
            >
            <span class="font-mono text-[12px] text-muted"
              >{n(p.commits)} × {n(p.lines)}</span
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
        >All {n(summary.total)} files in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}
