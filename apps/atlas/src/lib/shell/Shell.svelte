<script lang="ts">
  import {
    buildEntityIndex,
    classicUrl,
    computeOutlierBadges,
    entityKey,
    entityKind,
    fromCommitIndex,
    PRESET_GROUPS,
    previousNamesOf,
    touchesEntity,
    weeklyActivity,
    weeklyHits,
    VIEWS,
    type CommitLike,
    type EntityEntry,
    type EntityId,
    type ThemeName,
  } from '@gitrelic/scene';
  import { onDestroy, onMount, untrack } from 'svelte';

  import { loadCommits } from '../data/loadReport';
  import { initialCollapsed, rememberCollapsed } from '../state/inspectorPref';
  import { Nav } from '../state/nav.svelte';
  import TimeStrip from '../time/TimeStrip.svelte';
  import { nextFanFocus } from '../views/fanFocus';
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
  // A lens's alternate forms are its layouts after the first.
  const formsOf = (lens: string) =>
    VIEWS.get(lens)
      ?.layouts.slice(1)
      .map((l) => l.id) ?? [];
  const nav = new Nav(() => index, window, formsOf);
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
  let touches = $derived.by(() => {
    const id = nav.selection;
    if (!id) return null;
    // A renamed file keeps the history it made under its old paths.
    const before =
      entityKind(id) === 'file' ? previousNamesOf(entityKey(id), report) : [];
    return touchesEntity(id, before);
  });
  // Weekly totals once; a selection change recomputes only its own weeks.
  let series = $derived(commits ? weeklyActivity(commits) : null);
  let activity = $derived(
    commits && series
      ? {
          ...series,
          hits: weeklyHits(
            commits,
            series.start,
            series.totals.length,
            touches,
          ),
        }
      : null,
  );

  let viewLabel = $derived(
    PRESET_GROUPS.find((g) => g.id === nav.view)?.label ?? '',
  );

  // Analyzers are selected too: the inspector explains them and links to the
  // lens (or to classic, until Atlas has one).
  const pick = (entry: EntityEntry) => nav.select(entry.id);
  const openLens = (id: string) => void nav.openLens(id);

  // The stage draws the open lens's view, in its form. Layouts lay out in a
  // fixed world; the stage fits it to whatever size it has.
  const WORLD = { width: 1200, height: 800 };
  let fanFocus = $state<EntityId | null>(null);
  $effect(() => {
    const selection = nav.selection;
    fanFocus = untrack(() => nextFanFocus(fanFocus, selection, report, index));
  });
  let layout = $derived.by(() => {
    const view = nav.lens ? VIEWS.get(nav.lens) : undefined;
    if (!view) return undefined;
    return view.layouts.find((l) => l.id === nav.form) ?? view.layouts[0];
  });
  let scene = $derived(
    layout && (!layout.needsCommits || commits)
      ? layout.build({ report, commits, focus: fanFocus, index }, WORLD)
      : null,
  );

  // A second click on a lens dot opens that lens: in Atlas if it has a
  // view, otherwise in classic.
  function stageSelect(id: EntityId | null) {
    if (id && id === nav.selection && id.startsWith('analyzer:')) {
      const preset = id.slice('analyzer:'.length);
      if (!nav.openLens(preset)) window.location.assign(classicUrl(preset));
      return;
    }
    nav.select(id);
  }
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
      <Stage {theme} {scene} selected={nav.selection} onselect={stageSelect}>
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
