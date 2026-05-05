import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  fetchBuyerWalletTransactions,
  selectBuyerWalletTransactions,
  selectBuyerWalletTransactionsLoading,
  selectBuyerWalletCurrency,
} from "../../../redux/features/buyerWallet/buyerWalletSlice";
import { useBuyerRealtime } from "../../../customHook/useBuyerRealtime";
import "./BuyerTransactions.scss";

/**
 * BuyerTransactions Component
 * Displays buyer transaction history with filters and tabbed interface
 */
const BuyerTransactions = () => {
  const dispatch = useDispatch();
  const transactions = useSelector(selectBuyerWalletTransactions);
  const loading = useSelector(selectBuyerWalletTransactionsLoading);
  const currency = useSelector(selectBuyerWalletCurrency);

  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Initialize buyer realtime notifications
  useBuyerRealtime();

  useEffect(() => {
    dispatch(fetchBuyerWalletTransactions({ page: currentPage }));
  }, [dispatch, currentPage]);

  // Filter transactions based on active tab and search term
  useEffect(() => {
    let filtered = transactions;

    // Filter by transaction type (tab)
    if (activeTab !== "all") {
      filtered = filtered.filter((tx) => {
        const txType = tx.type === "credit" ? "deposit" : "withdrawal";
        return txType === activeTab || tx.reason?.toLowerCase().includes(activeTab);
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.reason?.toLowerCase().includes(term) ||
          tx.reference?.toLowerCase().includes(term) ||
          tx.amount?.toString().includes(term)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, activeTab, searchTerm]);

  const getTransactionBadgeClass = (type) => {
    return type === "credit" ? "status-completed" : "status-pending";
  };

  const getTransactionLabel = (type) => {
    return type === "credit" ? "Deposit" : "Withdrawal";
  };

  const getTransactionIcon = (type) => {
    return type === "credit" ? "+" : "-";
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm("");
  };

  const tabs = [
    { id: "all", label: "All Transactions" },
    { id: "deposit", label: "Deposit" },
    { id: "withdrawal", label: "Withdrawal" },
    { id: "refund", label: "Refund" },
  ];

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div className="transactions-container">
      {/* Header */}
      <div className="transactions-header">
        <div className="header-top">
          <Link to="/marketplace/buyer/wallet" className="back-link">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Wallet
          </Link>
        </div>
        <h1 className="page-title">Transactions</h1>
        <div className="header-controls">
          <div className="search-container">
            <svg
              className="search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search for products"
              className="search-input"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="filter-section">
            <button className="filter-button">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M6 12h12M9 18h6" />
              </svg>
              Filter
            </button>
            <button className="sort-button">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M7 12h10M11 18h2" />
              </svg>
              Last 7 days
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="transactions-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="transactions-table-wrapper">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6v6H9z" />
            </svg>
            <p>No transactions found</p>
          </div>
        ) : (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Order ID</th>
                <th>Product Name</th>
                <th>Address</th>
                <th>Type</th>
                <th>Date</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((tx, index) => (
                <tr key={tx._id || index}>
                  <td>{startIndex + index + 1}</td>
                  <td className="order-id">{tx.reference || tx.orderId || "-"}</td>
                  <td>
                    <div className="product-cell">
                      <div className="product-icon">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <rect x="2" y="2" width="20" height="20" rx="4" />
                        </svg>
                      </div>
                      <span>{tx.productName || "Smart Watch"}</span>
                    </div>
                  </td>
                  <td className="address-cell">{tx.address || "FUTA North Gate, Akure"}</td>
                  <td>
                    <span className="type-badge">{getTransactionLabel(tx.type)}</span>
                  </td>
                  <td className="date-cell">
                    {new Date(tx.createdAt).toLocaleDateString("en-NG", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="price-cell">
                    {currency}
                    {(tx.amount || 0).toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <span className={`status-badge ${getTransactionBadgeClass(tx.type)}`}>
                      {tx.status || (tx.type === "credit" ? "Completed" : "Pending")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {filteredTransactions.length > 0 && (
        <div className="pagination-section">
          <div className="pagination-info">
            <span>
              Showing {startIndex + 1} to{" "}
              {Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of{" "}
              {filteredTransactions.length} transactions
            </span>
          </div>

          <div className="pagination-controls">
            <button
              className="pagination-button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </button>

            <div className="page-numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`page-number ${currentPage === page ? "active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              className="pagination-button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerTransactions;
