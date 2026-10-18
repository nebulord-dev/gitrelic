<script lang="ts">
  import {
    fileContributors,
    fileFacts,
    fileMentions,
    ids,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import FactRows from './FactRows.svelte';
  import JumpToCard from './JumpToCard.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    file,
    report,
    index,
    onselect,
    onopen,
  }: {
    file: string;
    report: GitrelicReport;
    index: EntityIndex;
    onselect?: (id: EntityId) => void;
    onopen?: (id: string) => void;
  } = $props();

  let rows = $derived(fileFacts(file, report));
  let people = $derived(fileContributors(file, report));
  let mentions = $derived(fileMentions(file, report));
</script>

<Card eyebrow="File">
  <div class="font-mono text-[13px] break-all">{file}</div>
  <FactRows {rows} />
</Card>

{#snippet who(person: { name: string; percent: number | null })}
  <span class="flex-1 truncate text-person">{person.name}</span>
  {#if person.percent !== null}
    <span class="text-muted">{person.percent}%</span>
  {/if}
{/snippet}

{#if people.length > 0}
  <Card eyebrow="Top contributors">
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      {#each people as person (person.email)}
        <li>
          <!-- Authors the index lacks (a filtered-out bot) aren't selectable. -->
          {#if index.get(ids.person(person.email))}
            <button
              type="button"
              class="flex w-full cursor-pointer items-center gap-2 rounded-chip bg-transparent px-1 py-1 text-left font-[inherit] text-[13px] text-soft hover:text-text"
              onclick={() => onselect?.(ids.person(person.email))}
            >
              {@render who(person)}
            </button>
          {:else}
            <div
              class="flex items-center gap-2 px-1 py-1 text-[13px] text-soft"
            >
              {@render who(person)}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </Card>
{/if}

<JumpToCard presets={mentions} {onopen} />
