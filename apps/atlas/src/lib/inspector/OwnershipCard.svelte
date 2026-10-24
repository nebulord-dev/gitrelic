<script lang="ts">
  import {
    ids,
    ownershipFindings,
    ownershipMapOf,
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
    /** Opens the full table of packages. */
    ontable?: () => void;
  } = $props();

  // With nothing selected the lens leads with the truck factor: how many
  // people the code depends on (docs/atlas-views.md › Ownership).
  let map = $derived(ownershipMapOf(report));
  let findings = $derived(ownershipFindings({ report, commits: null }));
  let truck = $derived(map.truckFactor);
  let key = $derived(
    [...map.people.values()]
      .filter((p) => p.slot !== null)
      .sort((a, b) => a.slot! - b.slot!),
  );
  let others = $derived(map.people.size - key.length);
  // One string, so formatting the markup can't split it.
  let othersLabel = $derived(`${others} ${others === 1 ? 'other' : 'others'}`);
  const n = (v: number) => v.toLocaleString('en-US');
  const nameOf = (email: string) => map.people.get(email)?.name ?? email;
  // Literal class names, so Tailwind generates them.
  const SWATCH = [
    'bg-owner-0',
    'bg-owner-1',
    'bg-owner-2',
    'bg-owner-3',
    'bg-owner-4',
    'bg-owner-5',
  ] as const;
</script>

<Card eyebrow="Ownership">
  {#if truck.files > 0}
    <div class="flex items-baseline gap-2.5">
      <span class="font-mono text-5xl leading-none font-medium text-accent"
        >{n(truck.value)}</span
      >
      <span class="text-[14px] text-soft"
        >{truck.value === 1 ? 'person' : 'people'} would have to leave before half
        the files have nobody left who wrote them</span
      >
    </div>
    <p class="m-0 text-[14px] text-text">
      {#each truck.people as email, i (email)}{#if i > 0}{i ===
          truck.people.length - 1
            ? ' and '
            : ', '}{/if}<button
          type="button"
          onclick={() => onselect?.(ids.person(email))}
          class="cursor-pointer bg-transparent p-0 font-[inherit] text-[inherit] text-text underline decoration-control-border underline-offset-2 hover:text-accent"
          >{nameOf(email)}</button
        >{/each}
    </p>
    <p class="m-0 text-[12px] text-muted">
      The truck factor, over the {n(truck.files)} files with two or more commits in
      this window.
    </p>
  {/if}
  {#each findings as finding (finding.id)}
    <FindingCard {finding} {index} {onselect} />
  {/each}
</Card>

{#if key.length > 0}
  <Card eyebrow="Colors">
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      {#each key as person (person.email)}
        <li>
          <button
            type="button"
            onclick={() => onselect?.(ids.person(person.email))}
            class="flex w-full cursor-pointer items-center gap-2.5 bg-transparent py-1 text-left font-[inherit] text-[14px] text-text hover:text-accent"
          >
            <span class="size-2.5 shrink-0 rounded-sm {SWATCH[person.slot!]}"
            ></span>
            <span class="min-w-0 [overflow-wrap:anywhere]"
              >{person.name}{person.quiet ? ' (quiet)' : ''}</span
            >
          </button>
        </li>
      {/each}
      {#if others > 0}
        <li class="flex items-center gap-2.5 py-1 text-[14px] text-muted">
          <span class="size-2.5 shrink-0 rounded-sm bg-ghost"></span>
          {othersLabel}
        </li>
      {/if}
    </ul>
    <p class="m-0 text-[12px] text-muted">
      A cell takes its top contributor's color, stronger the more of it is
      theirs.
    </p>
    {#if ontable}
      <button
        type="button"
        onclick={() => ontable?.()}
        class="cursor-pointer self-start bg-transparent p-0 font-[inherit] text-[13px] text-accent"
        >All {n(map.packages.length)} packages in the table (T) ▸</button
      >
    {/if}
  </Card>
{/if}
