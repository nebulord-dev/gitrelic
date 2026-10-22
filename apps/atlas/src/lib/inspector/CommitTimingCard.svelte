<script lang="ts">
  import {
    commitTimingFindings,
    offHoursRegulars,
    regularLine,
    timingPackageId,
    timingPackageName,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import EntityChip from './EntityChip.svelte';
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
    /** Opens the table of tested packages. */
    ontable?: () => void;
  } = $props();

  let offHours = $derived(report.commitTiming.offHours);
  let findings = $derived(commitTimingFindings({ report, commits: null }));
  // Core's order: above chance first, then by off-hours share.
  let top = $derived(offHours.packages.slice(0, 5));
  let regulars = $derived(offHoursRegulars(report));
  // Only reports with regularity counted can say nobody qualifies.
  let counted = $derived(
    report.commitTiming.authorStress.some((a) => a.activeWeeks > 0),
  );

  const n = (v: number) => v.toLocaleString('en-US');
</script>

<Card eyebrow="Commit Timing">
  {#if offHours.commits > 0}
    <div class="flex items-baseline gap-2.5">
      <span class="font-mono text-5xl leading-none font-medium text-accent"
        >{Math.round(offHours.rate * 100)}%</span
      >
      <span class="text-[14px] text-soft"
        >of {n(offHours.commits)} commits off-hours (late night or weekend)</span
      >
    </div>
  {/if}
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {:else}
    <p class="m-0 text-[13px] text-soft">No commits in the window.</p>
  {/each}
</Card>

{#if top.length > 0}
  <Card eyebrow="Most off-hours, by package">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each top as p (p.package)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            onclick={() => onselect?.(timingPackageId(p.package))}
            class="grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]"
              >{timingPackageName(p.package)}</span
            >
            <span class="text-[12px] text-muted"
              >{n(p.offHours)} of {n(p.commits)}</span
            >
            <span
              class={[
                'font-mono text-[12px]',
                p.aboveChance ? 'text-accent' : 'text-muted',
              ]}>{p.percent}%</span
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
        >All {n(offHours.packages.length)} tested packages in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}

{#if counted}
  <Card eyebrow="Working off-hours regularly">
    {#each regulars as r (r.id)}
      <div
        class="flex flex-col gap-1 border-t border-panel-border py-1.5 first:border-t-0"
      >
        <EntityChip id={r.id} text={r.name} {index} {onselect} />
        <span class="text-[13px] text-soft">{regularLine(r)}</span>
      </div>
    {:else}
      <p class="m-0 text-[13px] text-soft">
        Nobody works weekends or late nights regularly (in a third or more of
        their active weeks).
      </p>
    {/each}
    <p class="m-0 text-[12px] text-muted">
      Times are from each author's own machine, so travel or a clock set to UTC
      can look like night work, and weekends can be a choice. A reason to check
      in, not a verdict. Select someone to see their hours.
    </p>
  </Card>
{/if}
