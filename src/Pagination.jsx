function Pagination({ page, size, totalPages, totalElements, disabled, onPage, onSizeChange }) {
  const atStart = page <= 0
  const atEnd = page >= totalPages - 1
  const from = totalElements === 0 ? 0 : page * size + 1
  const to = Math.min((page + 1) * size, totalElements)

  return (
    <nav className="pagination" aria-label="Orders pagination">
      <p className="muted pagination-summary">
        {totalElements === 0
          ? 'No orders'
          : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${totalElements.toLocaleString()} orders`}
      </p>
      <div className="pagination-controls">
        <label className="page-size">
          Per page
          <select
            name="pageSize"
            value={size}
            disabled={disabled}
            onChange={(event) => onSizeChange(Number(event.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
        <button
          type="button"
          className="btn-ghost"
          aria-label="First page"
          disabled={disabled || atStart}
          onClick={() => onPage(0)}
        >
          «
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={disabled || atStart}
          onClick={() => onPage(page - 1)}
        >
          Prev
        </button>
        <span className="page-indicator">
          Page {page + 1} of {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className="btn-ghost"
          disabled={disabled || atEnd}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
        <button
          type="button"
          className="btn-ghost"
          aria-label="Last page"
          disabled={disabled || atEnd}
          onClick={() => onPage(totalPages - 1)}
        >
          »
        </button>
      </div>
    </nav>
  )
}

export default Pagination
