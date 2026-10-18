<script lang="ts">
  import {
    buildEntityIndex,
    catalogEntry,
    computeOutlierBadges,
    docsUrl,
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
  import TableDrawer from '../table/TableDrawer.svelte';
  import TimeStrip from '../time/TimeStrip.svelte';
  import { nextFanFocus } from '../views/fanFocus';
  import { palettePick } from '../views/palettePick';
  import { stageClick } from '../views/stageClick';
  import CommandPalette from './CommandPalette.svelte';
  import GuideSheet from './GuideSheet.svelte';
  import Inspector from './Inspector.svelte';
  import LensBar from './LensBar.svelte';
  import Rail from './Rail.svelte';
  import { modalOpen, pressed } from './shortcut';
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

  // An analyzer with an Atlas view opens its lens, with nothing selected so
  // the inspector shows the lens itself. Anything else is selected: the
  // inspector explains a classic-only analyzer and links there.
  function pick(entry: EntityEntry) {
    const lens = palettePick(entry.id);
    if (lens && nav.openLens(lens)) nav.select(null);
    else nav.select(entry.id);
  }
  const openLens = (id: string) => void nav.openLens(id);

  // The stage draws the open lens's view, in its form. Layouts lay out in a
  // fixed world; the stage fits it to whatever size it has.
  const WORLD = { width: 1200, height: 800 };
  let fanFocus = $state<EntityId | null>(null);
  $effect(() => {
    const selection = nav.selection;
    // Only while Overview's ring is open; a lens picked elsewhere doesn't
    // leave a fan waiting for the next visit.
    const onRing = nav.lens === 'overview';
    fanFocus = untrack(() =>
      onRing ? nextFanFocus(fanFocus, selection, report, index) : null,
    );
  });
  let lensView = $derived(nav.lens ? VIEWS.get(nav.lens) : undefined);
  let layout = $derived(
    lensView?.layouts.find((l) => l.id === nav.form) ?? lensView?.layouts[0],
  );
  let forms = $derived(
    lensView?.layouts.map((l) => ({ id: l.id, label: l.label })) ?? [],
  );
  // The primary form stays out of the URL, like every default.
  const setForm = (id: string) =>
    nav.setForm(id === lensView?.layouts[0].id ? null : id);
  let lensDocs = $derived.by(() => {
    const entry = nav.lens ? catalogEntry(nav.lens) : undefined;
    return entry ? (docsUrl(entry) ?? undefined) : undefined;
  });
  // The ring fans its focused lens; other layouts re-form around a
  // selection of a kind they declare (the field draws a selected file even
  // when it's cool). Anything else gives them no focus, so a click they
  // can't show doesn't rebuild and re-plan the scene.
  let layoutFocus = $derived.by(() => {
    if (!layout?.focusKinds) return null;
    if (nav.lens === 'overview') return fanFocus;
    const kind = nav.selection ? entityKind(nav.selection) : null;
    return kind && layout.focusKinds.includes(kind) ? nav.selection : null;
  });
  // Commits are read only by layouts that need them, so the time strip's
  // fetch doesn't rebuild (and re-plan) a scene that ignores them.
  let layoutCommits = $derived(layout?.needsCommits ? commits : null);
  let scene = $derived(
    layout && (!layout.needsCommits || layoutCommits)
      ? layout.build(
          {
            report,
            commits: layoutCommits,
            focus: layoutFocus,
            index,
          },
          WORLD,
        )
      : null,
  );

  // The detail table (docs/atlas-views.md › The inspector): a full-width
  // drawer over the stage, built only while it's open.
  let tableOpen = $state(false);
  let lensTable = $derived(
    tableOpen && lensView?.table
      ? lensView.table({ report, commits: null, index })
      : null,
  );
  // A table row under the pointer lights its mark on the stage.
  let rowHover = $state<EntityId | null>(null);
  // However the drawer goes away (T, a lens without a table), its rows go
  // with it, and an unmounted row never fires mouseleave: let go of the
  // highlight here. A lens without a table also closes it, so coming back
  // doesn't reopen it unasked.
  $effect(() => {
    if (!lensView?.table) tableOpen = false;
  });
  $effect(() => {
    if (!lensTable) rowHover = null;
  });
  function onKey(e: KeyboardEvent) {
    // A modal (the palette, the guide) owns the keyboard while it's open.
    if (modalOpen()) return;
    if (pressed(e, 't') && lensView?.table) {
      // Opening doesn't move focus, so T closes it again; the key's
      // character has nowhere useful to go either way.
      e.preventDefault();
      tableOpen = !tableOpen;
    }
  }

  // A second click on a lens dot opens it (Atlas lenses only; classic is
  // the inspector's button). The arm belongs to the stage: a selection made
  // anywhere else clears it.
  let armed = $state<EntityId | null>(null);
  $effect(() => {
    if (nav.selection !== untrack(() => armed)) armed = null;
  });
  function stageSelect(id: EntityId | null) {
    const click = stageClick(armed, nav.selection, id);
    armed = click.armed;
    if (click.open) nav.openLens(click.open);
    else nav.select(id);
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
      <div class="relative flex min-h-0 flex-1 flex-col">
        <Stage
          {theme}
          {scene}
          selected={nav.selection}
          onselect={stageSelect}
          caption={layout?.caption}
          docs={lensDocs}
          {forms}
          form={layout?.id}
          onform={setForm}
          frameKey={`${nav.lens ?? ''}:${layout?.id ?? ''}`}
          highlight={rowHover}
          ontable={lensView?.table ? () => (tableOpen = !tableOpen) : undefined}
          {tableOpen}
        >
          {#snippet empty()}
            <p class="m-0 max-w-sm leading-relaxed">
              None of {viewLabel}'s lenses has an Atlas view yet. Each one in
              the bar above opens in the classic dashboard.
            </p>
          {/snippet}
        </Stage>
        {#if lensTable}
          <TableDrawer
            table={lensTable}
            label={catalogEntry(nav.lens ?? '')?.label ?? ''}
            bind:open={tableOpen}
            selected={nav.selection}
            onhover={(id) => (rowHover = id)}
            onselect={(id) => nav.select(id)}
          />
        {/if}
      </div>
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
      ontable={lensView?.table ? () => (tableOpen = true) : undefined}
    />
  </div>
</div>

<svelte:window onkeydown={onKey} />

<CommandPalette {index} bind:open={paletteOpen} onpick={pick} />
<GuideSheet bind:open={guideOpen} lens={nav.lens} onopen={openLens} />
