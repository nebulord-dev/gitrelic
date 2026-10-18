<script lang="ts">
  import {
    buildEntityIndex,
    computeOutlierBadges,
    type EntityEntry,
    type ThemeName,
  } from '@gitrelic/scene';
  import { onDestroy } from 'svelte';

  import { Nav } from '../state/nav.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import Inspector from './Inspector.svelte';
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

  // Analyzers are selected too: the inspector explains them and links to the
  // view (or to classic, until Atlas has one).
  const pick = (entry: EntityEntry) => nav.select(entry.id);
</script>

<div class="flex h-screen flex-col gap-4 p-4">
  <TopBar {report} bind:theme onsearch={() => (paletteOpen = true)} />
  <div class="flex min-h-0 flex-1 gap-4">
    <Rail {badges} view={nav.view} onopen={(id) => nav.open(id)} />
    <Stage {theme} selected={nav.selection} onselect={(id) => nav.select(id)} />
    <Inspector
      {report}
      {index}
      selection={nav.selection}
      view={nav.view}
      onselect={(id) => nav.select(id)}
      onopen={(id) => nav.open(id)}
    />
  </div>
</div>

<CommandPalette {index} bind:open={paletteOpen} onpick={pick} />
