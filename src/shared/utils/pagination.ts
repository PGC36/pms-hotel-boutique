export const PAGE_SIZE = 10;

export type PaginatedItems<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
};

export function paginateItems<T>(items: readonly T[], requestedPage: number): PaginatedItems<T> {
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const currentPage = totalPages === 0 ? 1 : Math.max(1, Math.min(totalPages, requestedPage));
  const start = (currentPage - 1) * PAGE_SIZE;

  return {
    items: items.slice(start, start + PAGE_SIZE),
    currentPage,
    totalPages,
  };
}
