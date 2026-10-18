<script lang="ts">
  import { nextSort, visibleRows, type TableView } from './tableRows';
  import type { EntityId, LensTable } from '@gitrelic/scene';

  let {
    table,
    label,
    open = $bindable(false),
    selected = null,
    onhover,
    onselect,
  }: {
    table: LensTable;
    /** The lens's name, for the heading. */
    label: string;
    open?: boolean;
    selected?: EntityId | null;
    /** A row under the pointer (or focused): the stage lights its mark. */
    onhover?: (id: EntityId | null) => void;
    onselect?: (id: EntityId) => void;
  } = $props();

  let filter = $state('');
  let tiers = $state(new Set<number>());
  let sort = $state<TableView['sort']>({ column: '', descending: true });
  // A new lens's table starts from its own default sort.
  $effect.pre(() => {
    sort = { ...table.sort };
  });
  let view = $derived(visibleRows(table, { filter, tiers, sort }));

  const TIER_DOT = ['bg-risk-0', 'bg-risk-1', 'bg-risk-2', 'bg-risk-3'];
  const n = (v: number) => v.toLocaleString('en-US');

  function toggleTier(t: number) {
    const next = new Set(tiers);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    tiers = next;
  }

  function close() {
    open = false;
    onhover?.(null);
  }

  // Capture phase, so Escape closes the drawer before the inspector reads
  // it as "clear the selection".
  function onKey(e: KeyboardEvent) {
    // A modal over the drawer (the palette, the guide) closes first.
    const modal = document.querySelector('[aria-modal="true"]') !== null;
    if (open && e.key === 'Escape' && !modal) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  const ariaSort = (id: string) =>
    sort.column !== id ? 'none' : sort.descending ? 'descending' : 'ascending';
</script>

<svelte:window onkeydowncapture={onKey} />

{#if open}
  <section
    aria-label={`${label} table`}
    class="absolute inset-x-0 bottom-0 z-10 flex h-[48%] min-h-60 flex-col overflow-hidden rounded-[var(--panel-radius)] border border-panel-border bg-bg"
  >
    <header
      class="flex flex-wrap items-center gap-3 border-b border-panel-border px-4 py-2.5"
    >
      <h2 class="m-0 text-[13px] font-semibold">
        {label}
        <span class="font-normal text-muted"
          >· {n(view.matched)} of {n(table.rows.length)}</span
        >
      </h2>
      <input
        bind:value={filter}
        type="search"
        placeholder="Filter by path…"
        aria-label="Filter rows"
        class="h-8 w-56 rounded-chip border border-control-border bg-transparent px-2.5 font-[inherit] text-[13px] text-text"
      />
      <div role="group" aria-label="Tiers" class="flex gap-1">
        {#each table.tierNames as name, t (t)}
          <button
            type="button"
            aria-pressed={tiers.has(t)}
            onclick={() => toggleTier(t)}
            class={[
              'flex cursor-pointer items-center gap-1.5 rounded-chip border border-control-border px-2 py-1 font-[inherit] text-[12px]',
              tiers.has(t)
                ? 'bg-control-border text-text'
                : 'bg-transparent text-muted hover:text-text',
            ]}
          >
            <span
              class={['size-2 rounded-full', TIER_DOT[t]]}
              aria-hidden="true"
            ></span>{name}
          </button>
        {/each}
      </div>
      <button
        type="button"
        aria-label="Close the table (Esc)"
        title="Close (Esc)"
        onclick={close}
        class="ml-auto grid size-7 cursor-pointer place-content-center rounded-chip border border-control-border bg-transparent text-muted hover:text-text"
        >✕</button
      >
    </header>

    <div class="min-h-0 flex-1 overflow-auto">
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {#each table.columns as column (column.id)}
              <th
                aria-sort={ariaSort(column.id)}
                class={[
                  'sticky top-0 bg-bg px-4 py-1.5 font-normal text-muted',
                  column.numeric ? 'text-right' : 'text-left',
                ]}
              >
                <button
                  type="button"
                  onclick={() =>
                    (sort = nextSort(sort, column.id, column.numeric ?? false))}
                  class="cursor-pointer bg-transparent p-0 font-[inherit] text-inherit hover:text-text"
                >
                  {column.label}{sort.column === column.id
                    ? sort.descending
                      ? ' ↓'
                      : ' ↑'
                    : ''}
                </button>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each view.rows as row (row.id)}
            <tr
              class={[
                'border-t border-panel-border',
                row.id === selected
                  ? 'bg-control-border'
                  : 'hover:bg-panel-border',
              ]}
              onmouseenter={() => onhover?.(row.id)}
              onmouseleave={() => onhover?.(null)}
            >
              {#each table.columns as column, c (column.id)}
                <td
                  class={[
                    'px-4 py-1',
                    column.numeric ? 'text-right font-mono' : 'text-left',
                  ]}
                >
                  {#if c === 0}
                    <!-- The row's control: a click or Enter selects it, and
                         focus lights its mark like the pointer does. -->
                    <button
                      type="button"
                      onclick={() => onselect?.(row.id)}
                      onfocus={() => onhover?.(row.id)}
                      onblur={() => onhover?.(null)}
                      class="flex cursor-pointer items-center gap-2 bg-transparent p-0 text-left font-[inherit] text-inherit [overflow-wrap:anywhere] hover:text-accent"
                    >
                      <span
                        class={[
                          'size-2 shrink-0 rounded-full',
                          TIER_DOT[row.tier],
                        ]}
                        aria-hidden="true"
                      ></span>
                      {row.cells[column.id]}
                    </button>
                  {:else}
                    {typeof row.cells[column.id] === 'number'
                      ? n(row.cells[column.id] as number)
                      : row.cells[column.id]}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
      {#if view.matched > view.rows.length}
        <p class="m-0 px-4 py-2 text-[12px] text-muted">
          Showing the first {n(view.rows.length)}. Filter to narrow the rest.
        </p>
      {:else if view.matched === 0}
        <p class="m-0 px-4 py-3 text-[13px] text-muted">Nothing matches.</p>
      {/if}
    </div>
  </section>
{/if}
