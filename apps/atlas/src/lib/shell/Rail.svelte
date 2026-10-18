<script lang="ts">
  import {
    lensesOf,
    PRESET_GROUPS,
    type Badge,
    type PresetGroup,
  } from '@gitrelic/scene';

  import GroupIcon from './GroupIcon.svelte';

  let {
    badges,
    view,
    onopen,
  }: {
    badges: ReadonlyMap<string, Badge>;
    view: PresetGroup;
    onopen?: (view: PresetGroup) => void;
  } = $props();

  // A view's dot rolls up its lenses' badges (docs/atlas-views.md).
  const hasOutliers = (group: PresetGroup) =>
    lensesOf(group).some((e) => badges.has(e.id));
</script>

<!-- Five destinations, always 56px: the lens bar lists each view's analyzers. -->
<nav aria-label="Views" class="panel flex w-14 shrink-0 flex-col gap-1 p-2">
  {#each PRESET_GROUPS as group (group.id)}
    {@const flagged = hasOutliers(group.id)}
    <button
      type="button"
      title={group.label}
      aria-label={`${group.label}${flagged ? ' (has outliers)' : ''}`}
      aria-current={view === group.id ? 'page' : undefined}
      onclick={() => onopen?.(group.id)}
      class={[
        'relative grid size-10 shrink-0 cursor-pointer place-content-center rounded-chip',
        view === group.id
          ? 'bg-control-border text-accent'
          : 'text-muted hover:text-text',
      ]}
    >
      <GroupIcon group={group.id} />
      {#if flagged}
        <span
          class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent"
          aria-hidden="true"
        ></span>
      {/if}
    </button>
  {/each}
</nav>
