"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  loading = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination-btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || loading}
        aria-label="Previous page"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Previous Page
      </button>

      <span className="pagination-info">
        Page {page} of {totalPages}
      </span>

      <button
        type="button"
        className="pagination-btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || loading}
        aria-label="Next page"
      >
        Next Page
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </nav>
  );
}
