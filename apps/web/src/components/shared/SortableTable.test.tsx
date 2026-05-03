import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type Column, SortableTable } from './SortableTable';

interface Row {
  id: string;
  value: number;
}

const rows: Row[] = [
  { id: 'a', value: 1 },
  { id: 'b', value: 2 },
  { id: 'c', value: 3 },
  { id: 'd', value: 4 },
  { id: 'e', value: 5 },
];

const columns: Column<Row>[] = [
  { key: 'id', label: 'ID', render: (r) => r.id },
  {
    key: 'value',
    label: 'Value',
    sortValue: (r) => r.value,
    render: (r) => String(r.value),
  },
];

describe('SortableTable', () => {
  it('renders all rows when maxRows is undefined', () => {
    render(
      <SortableTable data={rows} columns={columns} rowKey={(r) => r.id} />,
    );
    for (const r of rows) {
      expect(screen.getByText(r.id)).toBeTruthy();
    }
  });

  it('omits the truncation footer when maxRows is undefined', () => {
    render(
      <SortableTable data={rows} columns={columns} rowKey={(r) => r.id} />,
    );
    expect(screen.queryByText(/Showing .* of .* rows/)).toBeNull();
  });

  it('omits the truncation footer when maxRows >= data.length', () => {
    render(
      <SortableTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        maxRows={10}
      />,
    );
    expect(screen.queryByText(/Showing/)).toBeNull();
    for (const r of rows) {
      expect(screen.getByText(r.id)).toBeTruthy();
    }
  });

  it('slices to maxRows and shows the truncation footer when data exceeds the cap', () => {
    render(
      <SortableTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        maxRows={2}
      />,
    );
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.queryByText('c')).toBeNull();
    expect(screen.queryByText('d')).toBeNull();
    expect(screen.queryByText('e')).toBeNull();
    expect(screen.getByText(/Showing 2 of 5 rows/)).toBeTruthy();
  });

  it('applies maxRows after sorting so the top N reflects the active sort', () => {
    render(
      <SortableTable
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        maxRows={2}
      />,
    );
    // Initial render: no sort applied → first two rows in input order.
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();

    // Click the Value header → sort desc → top 2 should now be e, d.
    fireEvent.click(screen.getByText('Value'));
    expect(screen.getByText('e')).toBeTruthy();
    expect(screen.getByText('d')).toBeTruthy();
    expect(screen.queryByText('a')).toBeNull();
    expect(screen.queryByText('b')).toBeNull();
  });

  it('handles empty data without rendering a footer', () => {
    render(
      <SortableTable
        data={[]}
        columns={columns}
        rowKey={(r) => r.id}
        maxRows={10}
      />,
    );
    expect(screen.queryByText(/Showing/)).toBeNull();
  });
});
