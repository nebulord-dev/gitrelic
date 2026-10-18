<script lang="ts">
  // The analyzer catalog fills this in PR 3.1; for now it is the collapsible
  // frame: a 56px icon rail that expands to 240px.
  let expanded = $state(false);
</script>

<nav
  aria-label="Analyzers"
  class={[
    'panel flex shrink-0 flex-col p-2 transition-[width] duration-300 motion-reduce:transition-none',
    expanded ? 'w-60' : 'w-14',
  ]}
>
  <button
    type="button"
    aria-expanded={expanded}
    aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
    onclick={() => (expanded = !expanded)}
    class="grid size-10 cursor-pointer place-content-center rounded-chip text-muted hover:text-text"
  >
    <span aria-hidden="true">{expanded ? '«' : '»'}</span>
  </button>
</nav>
