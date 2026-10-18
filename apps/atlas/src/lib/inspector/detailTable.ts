/** A DetailTable column; `numeric` right-aligns it and sorts descending first. */
export interface Column<Row> {
  key: keyof Row & string;
  label: string;
  numeric?: boolean;
}
