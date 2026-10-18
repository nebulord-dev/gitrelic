<script lang="ts">
  import {
    buildEntityIndex,
    computeOutlierBadges,
    fromCommitIndex,
    PRESET_GROUPS,
    touchesEntity,
    weeklyActivity,
    type CommitLike,
    type EntityEntry,
    type ThemeName,
  } from '@gitrelic/scene';
  import { onDestroy, onMount } from 'svelte';

  import { loadCommits } from '../data/loadReport';
  import { initialCollapsed, rememberCollapsed } from '../state/inspectorPref';
  import { Nav } from '../state/nav.svelte';
  import TimeStrip from '../time/TimeStrip.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import GuideSheet from './GuideSheet.svelte';
  import Inspector from './Inspector.svelte';
  import LensBar from './LensBar.svelte';
  import Rail from './Rail.svelte';
  import Stage from './Stage.svelte';
  import TopBar from './TopBar.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    report,
    theme = $bindable(),
  }: { report: GitrelicReport; theme: ThemeName } = $props();

  let index = $derived(buildEntityIndex(report));
  let badges = $derived(computeOutlierBadges(report));
  const nav = new Nav(() => index);
  onDestroy(() => nav.destroy());

  let paletteOpen = $state(false);
  let guideOpen = $state(false);
  let collapsed = $state(initialCollapsed());
  $effect(() => rememberCollapsed(collapsed));

  // The time strip and the inspector's activity read the commit history,
  // fetched once; until it arrives (or if it fails) both say so.
  let commits = $state.raw<CommitLike[] | null>(null);
  let historyFailed = $state(false);
  onMount(() => {
    loadCommits().then(
      (idx) => (commits = fromCommitIndex(idx)),
      () => (historyFailed = true),
    );
  });
  let touches = $derived(nav.selection ? touchesEntity(nav.selection) : null);
  let activity = $derived(commits ? weeklyActivity(commits, touches) : null);

  let viewLabel = $derived(
    PRESET_GROUPS.find((g) => g.id === nav.view)?.label ?? '',
  );

  // Analyzers are selected too: the inspector explains them and links to the
  // lens (or to classic, until Atlas has one).
  const pick = (entry: EntityEntry) => nav.select(entry.id);
  const openLens = (id: string) => void nav.openLens(id);
</script>

<div class="flex h-screen flex-col gap-4 p-4">
  <TopBar
    {report}
    bind:theme
    onsearch={() => (paletteOpen = true)}
    onguide={() => (guideOpen = true)}
  />
  <div class="flex min-h-0 flex-1 gap-4">
    <Rail {badges} view={nav.view} onopen={(v) => nav.openView(v)} />
    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <LensBar view={nav.view} lens={nav.lens} {badges} onopen={openLens} />
      <Stage {theme} selected={nav.selection} onselect={(id) => nav.select(id)}>
        {#snippet empty()}
          <p class="m-0 max-w-sm leading-relaxed">
            None of {viewLabel}'s lenses has an Atlas view yet. Each one in the
            bar above opens in the classic dashboard.
          </p>
        {/snippet}
      </Stage>
      <TimeStrip
        {activity}
        selected={touches !== null}
        failed={historyFailed}
      />
    </div>
    <Inspector
      {report}
      {index}
      view={nav.view}
      lens={nav.lens}
      selection={nav.selection}
      activity={touches ? activity : null}
      {historyFailed}
      bind:collapsed
      onselect={(id) => nav.select(id)}
      onopen={openLens}
      onguide={() => (guideOpen = true)}
    />
  </div>
</div>

<CommandPalette {index} bind:open={paletteOpen} onpick={pick} />
<GuideSheet bind:open={guideOpen} lens={nav.lens} onopen={openLens} />
