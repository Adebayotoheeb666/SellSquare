import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addExpense,
  deleteExpense,
} from "../../../redux/features/expense/expenseSlice";
import ReactPaginate from "react-paginate";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css";
import moment from "moment";
import useFormatter from "../../../customHook/useFormatter";
import "./Expenses.scss";
import { Helmet } from "react-helmet";
import { FiPlus, FiFilter, FiTrash2 } from "react-icons/fi";
import { BiDollarCircle, BiTrendingUp, BiCalendar } from "react-icons/bi";
import { useStateExpensesPagination } from "../../../customHook/useStatePagination";

// Standard UI page size for display
const PAGE_SIZE = 15;

const TableLoader = () => (
  <div className="table-loader">
    <div className="spinner-dot"></div>
    <p>Loading expenses...</p>
  </div>
);

const Expenses = () => {
  const dispatch = useDispatch();
  const { formatter } = useFormatter();

  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "General",
    date: new Date().toISOString().split("T")[0],
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    category: "All",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // STATE-DRIVEN PAGINATION: Uses bulk-loaded data from Redux
  // Page changes NEVER trigger backend calls
  const statePagination = useStateExpensesPagination({
    page: currentPage,
    limit: PAGE_SIZE,
    filters: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      category: filters.category,
    },
  });

  // Get data from state pagination
  const expenses = statePagination.items;
  const pagination = {
    total: statePagination.total,
    totalPages: statePagination.totalPages,
    totalAmount: statePagination.aggregatedStats?.totalAmount || 0,
    currentPage: statePagination.currentPage,
  };
  const isLoading = statePagination.isLoading;

  // Keep the current page within available bounds when filters/data change
  useEffect(() => {
    if (pagination.totalPages && currentPage > pagination.totalPages) {
      setCurrentPage(Math.max(1, pagination.totalPages));
    }
  }, [pagination.totalPages, currentPage]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.amount || !formData.description) {
      return alert("Please fill in all required fields");
    }

    if (parseFloat(formData.amount) <= 0) {
      return alert("Amount must be greater than 0");
    }

    setIsSubmitting(true);
    await dispatch(addExpense(formData));
    setFormData({
      amount: "",
      description: "",
      category: "General",
      date: new Date().toISOString().split("T")[0],
    });

    // Close modal after successful submission
    setShowModal(false);
    setIsSubmitting(false);

    // Real-time update via WebSocket/Change Stream will handle this automatically
  };

  const handleDelete = (id, description) => {
    confirmAlert({
      title: "Delete Expense",
      message: `Are you sure you want to delete "${description}"?`,
      buttons: [
        {
          label: "Delete",
          onClick: async () => {
            await dispatch(deleteExpense(id));
            // Real-time update via WebSocket/Change Stream will handle this automatically
          },
        },
        {
          label: "Cancel",
        },
      ],
    });
  };

  // Page click handler - NO BACKEND CALL, just updates local state
  const handlePageClick = (data) => {
    setCurrentPage(data.selected + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startIndex = statePagination.startIndex || 0;
  const endIndex = statePagination.endIndex || 0;

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    setCurrentPage(1); // Reset to first page on filter change
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      category: "All",
    });
    setCurrentPage(1);
  };

  return (
    <div className="expenses-page">
      <Helmet>
        <title>Expenses | Sell Square - Track Running Costs</title>
        <meta
          name="description"
          content="Track and manage your business running costs and expenses. Add, view, and analyze your business expenses to understand your gross profit."
        />
      </Helmet>

      <div className="expenses-wrapper">
        {/* Header */}
        <div className="expenses-header">
          <div className="header-content">
            <h1>Expenses Management</h1>
            <p>Track and manage your business running costs</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="summary-section">
          <div className="summary-card primary">
            <div className="card-icon">
              <BiDollarCircle size={28} />
            </div>
            <div className="card-content">
              <p className="card-label">Total Expenses</p>
              <h3 className="card-value">
                {formatter(pagination.totalAmount || 0)}
              </h3>
            </div>
          </div>

          <div className="summary-card secondary">
            <div className="card-icon">
              <BiTrendingUp size={28} />
            </div>
            <div className="card-content">
              <p className="card-label">Total Entries</p>
              <h3 className="card-value">{pagination.total || 0}</h3>
            </div>
          </div>

          <div className="summary-card tertiary">
            <div className="card-icon">
              <BiCalendar size={28} />
            </div>
            <div className="card-content">
              <p className="card-label">Current Page</p>
              <h3 className="card-value">
                {currentPage} / {pagination.totalPages || 1}
              </h3>
            </div>
          </div>
        </div>

        {/* Add Expense Button */}
        <div className="add-expense-action">
          <button
            type="button"
            className="btn-add-expense"
            onClick={() => setShowModal(true)}
          >
            <FiPlus size={20} />
            Add New Expense
          </button>
          <button
            type="button"
            className="btn-add-expense"
            onClick={() => statePagination.refresh()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Add Expense Modal */}
        {showModal && (
          <>
            <div
              className="modal-overlay"
              onClick={() => setShowModal(false)}
            ></div>
            <div className="modal-container">
              <div className="modal-content">
                <div className="modal-header">
                  <h2>
                    <FiPlus size={20} /> Add New Expense
                  </h2>
                  <button
                    type="button"
                    className="btn-close-modal"
                    onClick={() => setShowModal(false)}
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="expense-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="amount">Amount *</label>
                      <input
                        id="amount"
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="category">Category</label>
                      <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                      >
                        <option value="General">General</option>
                        <option value="Rent">Rent</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Salaries">Salaries</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Supplies">Supplies</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="date">Date *</label>
                      <input
                        id="date"
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="description">Description *</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Describe the expense..."
                      rows="3"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={isSubmitting}
                  >
                    <FiPlus size={18} />
                    {isSubmitting ? "Adding..." : "Add Expense"}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Filters */}
        <div className="filter-section">
          <button
            className="filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter size={18} />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>

          {showFilters && (
            <div className="filter-content">
              <h3>Filter Expenses</h3>
              <div className="filter-grid">
                <div className="filter-group">
                  <label htmlFor="startDate">Start Date</label>
                  <input
                    id="startDate"
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="endDate">End Date</label>
                  <input
                    id="endDate"
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="filterCategory">Category</label>
                  <select
                    id="filterCategory"
                    name="category"
                    value={filters.category}
                    onChange={handleFilterChange}
                  >
                    <option value="All">All Categories</option>
                    <option value="General">General</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Transportation">Transportation</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                className="btn-clear-filters"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Expense List */}
        <div className="list-section">
          <div className="list-header">
            <h2>Expense History</h2>
            <div className="list-meta">
              <span className="entry-count">
                {pagination.total}{" "}
                {pagination.total === 1 ? "entry" : "entries"}
              </span>
              <span className="page-range">
                {expenses && expenses.length > 0
                  ? `Showing ${startIndex}-${endIndex} of ${
                      pagination.total || 0
                    }`
                  : "No records"}
              </span>
            </div>
          </div>

          {isLoading ? (
            <TableLoader />
          ) : expenses && expenses.length > 0 ? (
            <>
              <div className="table-wrapper">
                <table className="expenses-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense._id} className="expense-row">
                        <td className="date-cell">
                          {moment(expense.date).format("MMM DD, YYYY")}
                        </td>
                        <td className="description-cell">
                          {expense.description}
                        </td>
                        <td className="category-cell">
                          <span
                            className={`category-badge ${expense.category.toLowerCase()}`}
                          >
                            {expense.category}
                          </span>
                        </td>
                        <td className="amount-cell">
                          <span className="amount">
                            {formatter(expense.amount)}
                          </span>
                        </td>
                        <td className="action-cell">
                          <button
                            className="btn-delete-icon"
                            onClick={() =>
                              handleDelete(expense._id, expense.description)
                            }
                            title="Delete expense"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="pagination-wrapper">
                  <ReactPaginate
                    previousLabel="← Prev"
                    nextLabel="Next →"
                    pageCount={pagination.totalPages}
                    onPageChange={handlePageClick}
                    containerClassName="pagination"
                    previousLinkClassName="pagination__link pagination__prev"
                    nextLinkClassName="pagination__link pagination__next"
                    pageLinkClassName="pagination__link pagination__page"
                    disabledClassName="pagination__link--disabled"
                    activeClassName="pagination__link--active"
                    forcePage={currentPage - 1}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <BiDollarCircle size={48} />
              </div>
              <h3>No expenses yet</h3>
              <p>Add your first expense above to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Expenses;
