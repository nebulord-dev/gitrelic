import { type ReactNode, useCallback, useState } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (item: T) => ReactNode;
  sortValue?: (item: T) => number | string;
}

interface SortableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (item: T) => string;
  selectedKey?: string | null;
  onRowClick?: (item: T) => void;
  expandedKey?: string | null;
  renderExpanded?: (item: T) => ReactNode;
  onRowExpand?: (key: string | null) => void;
  maxRows?: number;
}

export function SortableTable<T>({
  data,
  columns,
  rowKey,
  selectedKey,
  onRowClick,
  expandedKey,
  renderExpanded,
  onRowExpand,
  maxRows = 50,
}: SortableTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback(
    (colKey: string) => {
      if (sortCol === colKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortCol(colKey);
        setSortDir('desc');
      }
    },
    [sortCol],
  );

  let sorted = [...data];
  if (sortCol) {
    const col = columns.find((c) => c.key === sortCol);
    if (col?.sortValue) {
      const sv = col.sortValue;
      sorted.sort((a, b) => {
        const va = sv(a);
        const vb = sv(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
  }
  sorted = sorted.slice(0, maxRows);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 0',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            onClick={() => col.sortValue && handleSort(col.key)}
            style={{
              width: col.width,
              flex: col.width ? undefined : 1,
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--text-tertiary)',
              cursor: col.sortValue ? 'pointer' : 'default',
              textAlign: col.align ?? 'left',
              padding: '0 4px',
              userSelect: 'none',
            }}
          >
            {col.label}
            {sortCol === col.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
          </div>
        ))}
      </div>

      {/* Rows */}
      {sorted.map((item) => {
        const key = rowKey(item);
        const isSelected = selectedKey === key;
        const isExpanded = expandedKey === key;

        return (
          <div key={key}>
            <div
              onClick={() => {
                if (onRowExpand) {
                  onRowExpand(isExpanded ? null : key);
                }
                onRowClick?.(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--border-primary)',
                cursor: 'pointer',
                background: isSelected ? 'var(--nav-item-active-bg)' : 'transparent',
              }}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  style={{
                    width: col.width,
                    flex: col.width ? undefined : 1,
                    fontSize: 11,
                    padding: '0 4px',
                    textAlign: col.align ?? 'left',
                    minWidth: 0,
                  }}
                >
                  {col.render(item)}
                </div>
              ))}
            </div>

            {/* Expanded detail */}
            {isExpanded && renderExpanded && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-secondary)',
                  borderBottom: '1px solid var(--border-primary)',
                }}
              >
                {renderExpanded(item)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
