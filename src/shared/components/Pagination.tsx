import './presentation.css';

export type PaginationProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  label?: string;
};

export function Pagination({
  currentPage,
  onPageChange,
  totalPages,
  label = 'Paginación',
}: PaginationProps) {
  const count = Number.isFinite(totalPages) ? Math.max(0, Math.floor(totalPages)) : 0;
  if (count <= 1) return null;
  const page = Number.isFinite(currentPage)
    ? Math.max(1, Math.min(count, Math.floor(currentPage)))
    : 1;
  return (
    <nav className="ui-pagination" aria-label={label}>
      <button
        className="ui-action"
        disabled={page === 1}
        onClick={() => {
          if (page > 1) onPageChange(page - 1);
        }}
        type="button"
      >
        Anterior
      </button>
      <span role="status" aria-live="polite">
        Página {page} de {count}
      </span>
      <button
        className="ui-action"
        disabled={page === count}
        onClick={() => {
          if (page < count) onPageChange(page + 1);
        }}
        type="button"
      >
        Siguiente
      </button>
    </nav>
  );
}
