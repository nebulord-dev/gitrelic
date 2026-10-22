<script lang="ts">
  import {
    contributorsFindings,
    ids,
    personStatus,
    STATUS_TEXT,
    type CommitLike,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import FindingCard from './FindingCard.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    report,
    index,
    commits = null,
    onselect,
    ontable,
  }: {
    report: GitrelicReport;
    index: EntityIndex;
    /** The history, once loaded: it adds the packages-left-behind finding. */
    commits?: CommitLike[] | null;
    onselect?: (id: EntityId) => void;
    /** Opens the full table of contributors. */
    ontable?: () => void;
  } = $props();

  let all = $derived(report.contributors.contributors);
  let active = $derived(report.contributors.activeContributors.length);
  let findings = $derived(contributorsFindings({ report, commits }));
  let top = $derived(all.slice(0, 5));

  const n = (v: number) => v.toLocaleString('en-US');
  const STATUS_CLASS = {
    active: 'text-muted',
    quiet: 'text-risk-1',
    ghost: 'text-risk-2',
  } as const;
</script>

<Card eyebrow="Contributors">
  <div class="flex items-baseline gap-2.5">
    <span class="font-mono text-5xl leading-none font-medium text-accent"
      >{n(active)}</span
    >
    <span class="text-[14px] text-soft">active, of {n(all.length)}</span>
  </div>
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {:else}
    <p class="m-0 text-[13px] text-soft">No commits in the window.</p>
  {/each}
</Card>

{#if top.length > 0}
  <Card eyebrow="Most commits">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each top as c (c.email)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            onclick={() => onselect?.(ids.person(c.email))}
            class="grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]">{c.name}</span>
            <span class="text-[12px] text-muted">{n(c.commitCount)}</span>
            <span class={['text-[12px]', STATUS_CLASS[personStatus(c)]]}
              >{STATUS_TEXT[personStatus(c)]}</span
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
        >All {n(all.length)} contributors in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}
