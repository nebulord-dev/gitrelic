<script lang="ts">
  import {
    aiCoauthorsFindings,
    aiPackagesOf,
    personIdOf,
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
    /** Opens the table of packages. */
    ontable?: () => void;
  } = $props();

  let co = $derived(report.coAuthors);
  let counted = $derived(co.humanAuthoredCommits + co.aiAuthoredCommits);
  let withAi = $derived(co.aiAssistedCommits + co.aiAuthoredCommits);
  let findings = $derived(aiCoauthorsFindings({ report, commits: null }));
  let packages = $derived(aiPackagesOf(report).rows);
  // The packages with the most commits with AI in them.
  let top = $derived(
    packages
      .filter((p) => p.assisted + p.authored > 0)
      .sort(
        (a, b) =>
          b.assisted + b.authored - (a.assisted + a.authored) ||
          b.commits - a.commits,
      )
      .slice(0, 5),
  );
  let people = $derived(co.aiAuthors.slice(0, 5));

  const n = (v: number) => v.toLocaleString('en-US');
  const pct = (v: number, of: number) =>
    of === 0 ? '0%' : `${Math.round((v / of) * 100)}%`;
</script>

<Card eyebrow="AI & Co-authors">
  {#if counted > 0}
    <div class="flex items-baseline gap-2.5">
      <span class="font-mono text-5xl leading-none font-medium text-accent"
        >{pct(withAi, counted)}</span
      >
      <span class="text-[14px] text-soft"
        >of {n(counted)} commits had AI in them</span
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
  <Card eyebrow="Most AI, by package">
    <ul class="m-0 flex list-none flex-col p-0">
      {#each top as p (p.package)}
        <li class="border-t border-panel-border first:border-t-0">
          <button
            type="button"
            onclick={() => onselect?.(p.id)}
            class="grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-baseline gap-3 bg-transparent py-1.5 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="min-w-0 [overflow-wrap:anywhere]">{p.name}</span>
            <span class="text-[12px] text-muted"
              >{n(p.assisted + p.authored)} of {n(p.commits)}</span
            >
            <span class="font-mono text-[12px] text-muted"
              >{pct(p.assisted + p.authored, p.commits)}</span
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
        >All {n(packages.length)} packages in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}

{#if people.length > 0}
  <Card eyebrow="Most AI, by person">
    {#each people as p (p.author)}
      <div
        class="flex flex-col items-start gap-1 border-t border-panel-border py-1.5 first-of-type:border-t-0"
      >
        <EntityChip
          id={personIdOf(report, p.author)}
          text={p.displayName}
          {index}
          {onselect}
        />
        <span class="text-[13px] text-soft"
          >{n(p.aiCommits)} of {n(p.totalCommits)} commits AI-assisted ({p.personalRatio}%)</span
        >
      </div>
    {/each}
    <p class="m-0 text-[12px] text-muted">
      Counted from Co-authored-by trailers, so it shows who credits AI, not
      everyone who uses it. Select someone to see their packages; Adoption lanes
      shows when each person started.
    </p>
  </Card>
{/if}
