import { useEffect, useMemo, useState, type AriaAttributes, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import './presentation.css';

export type DataTableColumn<Row extends object> = {
  header: string;
  id: string;
  cell: (row: Row) => ReactNode;
  sortValue?: (row: Row) => string | number | null | undefined;
};

type TableHeader = {
  id: string;
  label: ReactNode;
  sort?: AriaAttributes['aria-sort'];
  className?: string;
};

/** Single table renderer, also used by adapters for the legacy views. */
export function TableFrame({
  headers,
  children,
  caption,
  className = 'ui-table',
  wrapperClassName = 'ui-table-region',
}: {
  headers: TableHeader[];
  children: ReactNode;
  caption?: string;
  className?: string;
  wrapperClassName?: string;
}) {
  return (
    <div
      className={wrapperClassName}
      role="region"
      aria-label={caption ?? 'Tabla de datos'}
      tabIndex={0}
    >
      <table className={className}>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header.id} scope="col" aria-sort={header.sort} className={header.className}>
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export type DataTableProps<Row extends object> = {
  columns: DataTableColumn<Row>[];
  data: Row[];
  emptyMessage?: string;
  getRowId: (row: Row, index: number) => string | number;
  caption?: string;
  pageSize?: number;
};

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export function DataTable<Row extends object>({
  columns,
  data,
  emptyMessage = 'No hay registros para mostrar.',
  getRowId,
  caption = 'Registros',
  pageSize = 5,
}: DataTableProps<Row>) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ id: string; direction: 'ascending' | 'descending' } | null>(
    null,
  );
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 5;
  const totalPages = Math.max(1, Math.ceil(data.length / size));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => setPage(1), [size]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  const sorted = useMemo(() => {
    const rows = data.map((row, index) => ({ row, index }));
    const value = columns.find((column) => column.id === sort?.id)?.sortValue;
    if (!value || !sort) return rows;
    return rows.sort((a, b) => {
      const left = value(a.row),
        right = value(b.row);
      if (left == null && right == null) return a.index - b.index;
      if (left == null) return 1;
      if (right == null) return -1;
      const order =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : collator.compare(String(left), String(right));
      return order === 0 ? a.index - b.index : order * (sort.direction === 'ascending' ? 1 : -1);
    });
  }, [data, columns, sort]);

  if (!data.length) return <EmptyState description={emptyMessage} />;

  return (
    <div>
      <TableFrame
        caption={caption}
        headers={columns.map((column) => ({
          id: column.id,
          sort: column.sortValue ? (sort?.id === column.id ? sort.direction : 'none') : undefined,
          label: column.sortValue ? (
            <button
              className="ui-table-sort"
              type="button"
              onClick={() => {
                setSort({
                  id: column.id,
                  direction:
                    sort?.id === column.id && sort.direction === 'ascending'
                      ? 'descending'
                      : 'ascending',
                });
                setPage(1);
              }}
              aria-label={`Ordenar por ${column.header}`}
            >
              {column.header}{' '}
              <span aria-hidden="true">
                {sort?.id === column.id ? (sort.direction === 'ascending' ? '↑' : '↓') : '↕'}
              </span>
            </button>
          ) : (
            column.header
          ),
        }))}
      >
        {sorted.slice((currentPage - 1) * size, currentPage * size).map(({ row, index }) => (
          <tr key={getRowId(row, index)}>
            {columns.map((column) => (
              <td key={column.id}>{column.cell(row)}</td>
            ))}
          </tr>
        ))}
      </TableFrame>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        label={`Paginación de ${caption}`}
      />
    </div>
  );
}
