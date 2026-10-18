<script lang="ts">
  import {
    ids,
    personFacts,
    type EntityId,
    type EntityIndex,
  } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import EntityChip from './EntityChip.svelte';
  import FactRows from './FactRows.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    email,
    report,
    index,
    onselect,
  }: {
    email: string;
    report: GitrelicReport;
    index: EntityIndex;
    onselect?: (id: EntityId) => void;
  } = $props();

  let person = $derived(personFacts(email, report));

  const STATUS = {
    active: { text: 'Active', class: 'text-person' },
    quiet: { text: 'Quiet', class: 'text-soft' },
    ghost: { text: 'Gone quiet', class: 'text-ghost' },
  } as const;

  // Focus areas are files or directories; link whichever the report knows.
  const areaId = (path: string): EntityId =>
    index.get(ids.file(path)) ? ids.file(path) : ids.dir(path);
</script>

{#if person}
  <Card eyebrow="Person">
    <div class="flex items-baseline justify-between gap-3">
      <span class="text-lg font-semibold text-person">{person.name}</span>
      <span class={['text-[12px]', STATUS[person.status].class]}>
        {STATUS[person.status].text}
      </span>
    </div>
    <div class="text-[12px] break-all text-muted">{person.email}</div>
    <FactRows rows={person.rows} />
  </Card>

  {#if person.focusAreas.length > 0}
    <Card eyebrow="Focus areas">
      <div class="flex flex-wrap gap-1.5">
        {#each person.focusAreas as area (area)}
          <EntityChip id={areaId(area)} text={area} {index} {onselect} />
        {/each}
      </div>
    </Card>
  {/if}

  {#if person.aliases.length > 0}
    <Card eyebrow="Also commits as">
      <ul class="m-0 list-none p-0 text-[12px] text-soft">
        {#each person.aliases as alias (alias)}
          <li class="break-all">{alias}</li>
        {/each}
      </ul>
    </Card>
  {/if}
{/if}
