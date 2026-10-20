<script lang="ts">
  import {
    ids,
    REASON_NAMES,
    riskFindings,
    riskStacksOf,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import FindingCard from './FindingCard.svelte';
  import type { CurseReasonKind, GitrelicReport } from '@gitrelic/core';

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

  let stacks = $derived(riskStacksOf(report));
  let cursed = $derived(stacks.rows.filter((r) => r.cursed).length);
  let near = $derived(stacks.rows.length - cursed);
  let findings = $derived(riskFindings({ report, commits: null }));
  let top = $derived(stacks.rows.slice(0, 5));
  let axis = $derived(Math.max(100, ...top.map((r) => r.sum)));

  // The stage's reason colours (layouts/stacks.ts REASON_PAINT), as classes.
  const SEGMENT: Record<CurseReasonKind, string> = {
    churn: 'bg-accent',
    ownership: 'bg-person',
    authors: 'bg-person opacity-50',
    abandoned: 'bg-ghost',
    fixes: 'bg-risk-1',
    parallel: 'bg-dir',
  };

  const n = (v: number) => v.toLocaleString('en-US');
  const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);
</script>

<Card eyebrow="Risk">
  <div class="flex items-baseline gap-2.5">
    <span class="font-mono text-5xl leading-none font-medium text-accent"
      >{n(cursed)}</span
    >
    <span class="text-[14px] text-soft"
      >cursed file{cursed === 1 ? '' : 's'} at {stacks.threshold}+{#if near > 0},
        {n(near)} near miss{near === 1 ? '' : 'es'}{/if}</span
    >
  </div>
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {:else}
    <p class="m-0 text-[13px] text-soft">
      No file scores 40 or more in this window.
    </p>
  {/each}
</Card>

{#if top.length > 0}
  <Card eyebrow="Highest scores">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each top as row (row.file)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            title={row.breakdown
              .map((b) => `${REASON_NAMES[b.kind]} ${b.points}`)
              .join(' · ')}
            onclick={() => onselect?.(ids.file(row.file))}
            class="grid w-full cursor-pointer grid-cols-[1fr_72px_auto] items-center gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]"
              >{baseName(row.file)}</span
            >
            <span class="flex h-2 gap-px bg-control-border">
              {#each row.breakdown as b (b.kind)}
                <span
                  class={['block h-2', SEGMENT[b.kind]]}
                  style:width={`${(100 * b.points) / axis}%`}
                ></span>
              {:else}
                <span
                  class="block h-2 bg-ghost"
                  style:width={`${(100 * row.score) / axis}%`}
                ></span>
              {/each}
            </span>
            <span
              class={[
                'font-mono text-[12px]',
                row.cursed ? 'text-text' : 'text-muted',
              ]}>{row.score}</span
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
        >All {n(stacks.rows.length)} files in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}
