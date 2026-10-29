import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Pagination } from './Pagination';

export function PaginatedList<T>({
  items,
  getKey,
  renderItem,
  listClassName,
  label,
  resetKey = '',
  pageSize = 10,
}: {
  items: T[];
  getKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  listClassName: string;
  label: string;
  resetKey?: string;
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => setPage(1), [resetKey, pageSize]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  return (
    <>
      <div className={listClassName}>
        {items.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => (
          <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
        ))}
      </div>
      <Pagination
        currentPage={currentPage}
        onPageChange={setPage}
        totalPages={totalPages}
        label={label}
      />
    </>
  );
}
