import { type ReactNode, useCallback, useState } from 'react';

import { cn } from '../../utils/cn';

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

const alignClass: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function SortableTable<T>({
  data,
  columns,
  rowKey,
  selectedKey,
  onRowClick,
  expandedKey,
  renderExpanded,
  onRowExpand,
  maxRows,
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
  const totalRows = sorted.length;
  const truncated = maxRows != null && totalRows > maxRows;
  if (maxRows != null) {
    sorted = sorted.slice(0, maxRows);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center py-1 border-b border-border-primary">
        {columns.map((col) => (
          <div
            key={col.key}
            onClick={() => col.sortValue && handleSort(col.key)}
            className={cn(
              'px-1 text-[9px] uppercase tracking-[1px] text-text-tertiary select-none',
              alignClass[col.align ?? 'left'],
              col.sortValue ? 'cursor-pointer' : 'cursor-default',
              col.width ? undefined : 'flex-1',
            )}
            style={col.width ? { width: col.width } : undefined}
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
              className={cn(
                'flex items-center py-1.5 border-b border-border-primary cursor-pointer',
                isSelected ? 'bg-nav-item-active-bg' : 'bg-transparent',
              )}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  className={cn(
                    'px-1 text-[11px] min-w-0',
                    alignClass[col.align ?? 'left'],
                    col.width ? undefined : 'flex-1',
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.render(item)}
                </div>
              ))}
            </div>

            {/* Expanded detail */}
            {isExpanded && renderExpanded && (
              <div className="px-3 py-2 bg-surface-secondary border-b border-border-primary">
                {renderExpanded(item)}
              </div>
            )}
          </div>
        );
      })}

      {truncated && (
        <div className="px-1 py-1.5 text-[10px] text-text-tertiary text-right italic">
          Showing {maxRows} of {totalRows.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
