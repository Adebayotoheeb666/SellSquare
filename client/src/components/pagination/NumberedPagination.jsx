import React from "react";
import "./NumberedPagination.css";

/**
 * NumberedPagination Component
 * Displays numbered page buttons with ellipsis for large page counts
 * Example: < 1 2 3 ... 10 >
 * 
 * @param {number} currentPage - The current active page (1-indexed)
 * @param {number} totalPages - Total number of pages
 * @param {function} onPageChange - Callback when page is changed
 * @param {number} maxVisible - Maximum number of page buttons to show (default: 5)
 */
const NumberedPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  maxVisible = 5
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than maxVisible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const leftOffset = Math.floor(maxVisible / 2);
      const rightOffset = maxVisible - leftOffset - 1;

      let start = Math.max(2, currentPage - leftOffset);
      let end = Math.min(totalPages - 1, currentPage + rightOffset);

      // Adjust if we're near the start
      if (currentPage - leftOffset <= 2) {
        end = Math.min(totalPages - 1, maxVisible - 1);
        start = 2;
      }

      // Adjust if we're near the end
      if (currentPage + rightOffset >= totalPages - 1) {
        start = Math.max(2, totalPages - maxVisible + 2);
        end = totalPages - 1;
      }

      // Add left ellipsis
      if (start > 2) {
        pages.push("...");
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add right ellipsis
      if (end < totalPages - 1) {
        pages.push("...");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="numbered-pagination">
      <button
        className="pagination-nav-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        &lt;
      </button>

      {pageNumbers.map((page, index) => {
        if (page === "...") {
          return (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">
              ...
            </span>
          );
        }

        return (
          <button
            key={page}
            className={`pagination-number-btn ${currentPage === page ? "active" : ""}`}
            onClick={() => onPageChange(page)}
            aria-label={`Go to page ${page}`}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </button>
        );
      })}

      <button
        className="pagination-nav-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        &gt;
      </button>
    </div>
  );
};

export default NumberedPagination;
