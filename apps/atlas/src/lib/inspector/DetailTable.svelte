<script lang="ts" generics="Row extends Record<string, string | number>">
  import type { Column } from './detailTable';

  let {
    title,
    columns,
    rows,
    rowKey,
  }: {
    title: string;
    columns: readonly Column<Row>[];
    rows: readonly Row[];
    /** The column whose value is unique per row (a path, an email). */
    rowKey: keyof Row & string;
  } = $props();

  // Collapsed by default: the canvas is the primary view, the table the detail.
  let sortKey = $state<string | null>(null);
  let descending = $state(true);

  let sorted = $derived.by(() => {
    if (!sortKey) return rows;
    const key = sortKey;
    return [...rows].sort((a, b) => {
      const x = a[key];
      const y = b[key];
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y));
      return descending ? -order : order;
    });
  });

  function sortBy(column: Column<Row>) {
    if (sortKey === column.key) descending = !descending;
    else {
      sortKey = column.key;
      descending = column.numeric ?? false;
    }
  }

  const ariaSort = (key: string) =>
    sortKey !== key ? 'none' : descending ? 'descending' : 'ascending';
</script>

<details class="text-[13px]">
  <summary class="cursor-pointer text-muted select-none">
    {title} ({rows.length.toLocaleString()})
  </summary>
  <div class="mt-2 max-h-80 overflow-auto">
    <table class="w-full border-collapse">
      <thead>
        <tr>
          {#each columns as column (column.key)}
            <th
              aria-sort={ariaSort(column.key)}
              class={[
                'sticky top-0 bg-[var(--card-bg)] py-1 font-normal text-muted',
                column.numeric ? 'text-right' : 'text-left',
              ]}
            >
              <button
                type="button"
                class="cursor-pointer bg-transparent p-0 font-[inherit] text-inherit"
                onclick={() => sortBy(column)}
              >
                {column.label}{sortKey === column.key
                  ? descending
                    ? ' ↓'
                    : ' ↑'
                  : ''}
              </button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each sorted as row (row[rowKey])}
          <tr class="border-t border-panel-border">
            {#each columns as column (column.key)}
              <td class={['py-1', column.numeric ? 'text-right' : 'text-left']}>
                {typeof row[column.key] === 'number'
                  ? row[column.key].toLocaleString()
                  : row[column.key]}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</details>
