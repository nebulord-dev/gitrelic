<script lang="ts">
  import {
    CATALOG,
    classicUrl,
    PRESET_GROUPS,
    type Badge,
    type PresetGroup,
  } from '@gitrelic/scene';

  import GroupIcon from './GroupIcon.svelte';

  let {
    badges,
    view = null,
    onopen,
  }: {
    badges: ReadonlyMap<string, Badge>;
    view?: string | null;
    onopen?: (id: string) => void;
  } = $props();

  // Collapsed: 56px of group icons. Expanded: 240px, every analyzer by group.
  let expanded = $state(false);

  const groups = PRESET_GROUPS.map((g) => ({
    ...g,
    entries: CATALOG.filter((e) => e.group === g.id),
  }));
  const groupHasBadge = (id: PresetGroup) =>
    CATALOG.some((e) => e.group === id && badges.has(e.id));
</script>

<nav
  aria-label="Analyzers"
  class={[
    'panel flex shrink-0 flex-col gap-1 overflow-x-hidden overflow-y-auto p-2 transition-[width] duration-300 motion-reduce:transition-none',
    expanded ? 'w-60' : 'w-14',
  ]}
>
  <button
    type="button"
    aria-expanded={expanded}
    aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
    onclick={() => (expanded = !expanded)}
    class="grid size-10 shrink-0 cursor-pointer place-content-center rounded-chip text-muted hover:text-text"
  >
    <span aria-hidden="true">{expanded ? '«' : '»'}</span>
  </button>

  {#if expanded}
    {#each groups as group (group.id)}
      <section class="mt-2" aria-label={group.label}>
        <h2
          class="m-0 flex items-center gap-2 px-2 py-1 text-[10px] font-normal tracking-[0.16em] text-muted uppercase"
        >
          <GroupIcon group={group.id} />
          {group.label}
        </h2>
        <ul class="m-0 list-none p-0">
          {#each group.entries as entry (entry.id)}
            {@const badge = badges.get(entry.id)}
            <li>
              {#if entry.atlas}
                <button
                  type="button"
                  aria-current={view === entry.id ? 'page' : undefined}
                  onclick={() => onopen?.(entry.id)}
                  class={[
                    'flex w-full cursor-pointer items-center gap-2 rounded-chip px-2 py-1.5 text-left text-[13px]',
                    view === entry.id
                      ? 'text-accent'
                      : 'text-soft hover:text-text',
                  ]}
                >
                  <span class="flex-1 truncate">{entry.label}</span>
                  {#if badge}
                    <span
                      class="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink"
                      title={badge.reason}>{badge.count}</span
                    >
                  {/if}
                </button>
              {:else}
                <a
                  href={classicUrl(entry.id)}
                  class="flex items-center gap-2 rounded-chip px-2 py-1.5 text-[13px] text-muted no-underline hover:text-soft"
                  title="Opens in the classic dashboard"
                >
                  <span class="flex-1 truncate">{entry.label}</span>
                  {#if badge}
                    <span
                      class="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink"
                      title={badge.reason}>{badge.count}</span
                    >
                  {/if}
                  <span class="text-[11px]" aria-label="classic dashboard"
                    >↗</span
                  >
                </a>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {:else}
    {#each groups as group (group.id)}
      <button
        type="button"
        title={group.label}
        aria-label={`${group.label}${groupHasBadge(group.id) ? ' (has outliers)' : ''}`}
        onclick={() => (expanded = true)}
        class="relative grid size-10 shrink-0 cursor-pointer place-content-center rounded-chip text-muted hover:text-text"
      >
        <GroupIcon group={group.id} />
        {#if groupHasBadge(group.id)}
          <span
            class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent"
            aria-hidden="true"
          ></span>
        {/if}
      </button>
    {/each}
  {/if}
</nav>
