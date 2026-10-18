<script lang="ts">
  import {
    coupledWith,
    fileContributors,
    fileFacts,
    ids,
    whatToDo,
    type EntityId,
    type EntityIndex,
    type WeeklyActivity,
  } from '@gitrelic/scene';

  import ActivityCard from './ActivityCard.svelte';
  import Card from './Card.svelte';
  import { fileSections, scrollToSection } from './fileSections';
  import FlaggedBy from './FlaggedBy.svelte';
  import PathText from './PathText.svelte';
  import WhatToDoCard from './WhatToDoCard.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    file,
    report,
    index,
    activity = null,
    historyFailed = false,
    onselect,
    onopen,
  }: {
    file: string;
    report: GitrelicReport;
    index: EntityIndex;
    /** Weekly commits, with this file's marked; null while history loads. */
    activity?: WeeklyActivity | null;
    historyFailed?: boolean;
    onselect?: (id: EntityId) => void;
    onopen?: (lens: string) => void;
  } = $props();

  let slash = $derived(file.lastIndexOf('/'));
  let name = $derived(file.slice(slash + 1));
  let folder = $derived(slash >= 0 ? file.slice(0, slash + 1) : '');
  let rows = $derived(fileFacts(file, report));
  let people = $derived(fileContributors(file, report));
  let coupled = $derived(coupledWith(file, report));
  let chips = $derived.by(() => {
    const out: { text: string; hot: boolean }[] = [];
    const h = report.hotspots.files.find((x) => x.file === file);
    if (h && (h.category === 'critical' || h.category === 'warning'))
      out.push({ text: `${h.category} hotspot`, hot: true });
    const v = report.churnVelocity.files.find((x) => x.file === file);
    if (v?.trend === 'accelerating')
      out.push({ text: 'accelerating', hot: true });
    const lang = report.loc.files.find((x) => x.file === file)?.language;
    if (lang) out.push({ text: lang, hot: false });
    return out;
  });

  let sections = $derived(fileSections(file, report));
  let advice = $derived(whatToDo(file, report));
  let anchors = $derived(new Set(sections.map((s) => s.anchor)));
</script>

<Card eyebrow="File">
  <div class="text-xl leading-snug font-semibold [overflow-wrap:anywhere]">
    {name}
  </div>
  {#if folder}
    <div class="text-[12px] leading-relaxed text-muted">
      <PathText path={folder} />
    </div>
  {/if}
  {#if chips.length > 0}
    <ul class="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {#each chips as chip (chip.text)}
        <li
          class={[
            'rounded-chip bg-control-border px-2 py-0.5 text-[12px]',
            chip.hot ? 'text-accent' : 'text-soft',
          ]}
        >
          {chip.text}
        </li>
      {/each}
    </ul>
  {/if}
  <nav
    aria-label="Sections"
    class="mt-1 flex flex-wrap gap-x-4 gap-y-1 border-t border-panel-border pt-2.5 text-[13px]"
  >
    {#each sections as section (section.anchor)}
      <button
        type="button"
        onclick={() => scrollToSection(section.anchor)}
        class="cursor-pointer bg-transparent p-0 font-[inherit] text-[13px] text-muted hover:text-text"
        >{section.label}</button
      >
    {/each}
  </nav>
</Card>

{#if advice.length > 0}
  <WhatToDoCard {advice} sections={anchors} />
{/if}

<FlaggedBy {rows} id="insp-flagged" {onopen} />

{#snippet who(person: { name: string; percent: number | null })}
  <span class="flex-1 text-person">{person.name}</span>
  {#if person.percent !== null}
    <span class="text-muted">{person.percent}%</span>
  {/if}
{/snippet}

{#if people.length > 0}
  <Card eyebrow="People" id="insp-people">
    <ul class="m-0 flex list-none flex-col gap-1 p-0">
      {#each people as person (person.email)}
        <li>
          <!-- Authors the index lacks (a filtered-out bot) aren't selectable. -->
          {#if index.get(ids.person(person.email))}
            <button
              type="button"
              class="flex w-full cursor-pointer items-baseline gap-2 rounded-chip bg-transparent px-1 py-1 text-left font-[inherit] text-[14px] text-soft hover:text-text"
              onclick={() => onselect?.(ids.person(person.email))}
            >
              {@render who(person)}
            </button>
          {:else}
            <div
              class="flex items-baseline gap-2 px-1 py-1 text-[14px] text-soft"
            >
              {@render who(person)}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </Card>
{/if}

<ActivityCard {activity} failed={historyFailed} id="insp-activity" />

{#if coupled.length > 0}
  <Card eyebrow="Changes with" id="insp-coupled">
    <ul class="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
      {#each coupled as c (c.file)}
        {@const label = c.file.slice(c.file.lastIndexOf('/') + 1)}
        {@const value = `${c.coCommits}× · ${c.strength}%`}
        <li>
          {#if index.get(ids.file(c.file))}
            <button
              type="button"
              title={c.file}
              class="grid w-full cursor-pointer grid-cols-[1fr_auto] gap-3 bg-transparent py-0.5 text-left font-[inherit] text-[13px] text-text hover:text-accent"
              onclick={() => onselect?.(ids.file(c.file))}
            >
              <span class="[overflow-wrap:anywhere]">{label}</span>
              <span class="font-mono text-soft">{value}</span>
            </button>
          {:else}
            <div class="grid grid-cols-[1fr_auto] gap-3 py-0.5" title={c.file}>
              <span class="[overflow-wrap:anywhere]">{label}</span>
              <span class="font-mono text-soft">{value}</span>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </Card>
{/if}
