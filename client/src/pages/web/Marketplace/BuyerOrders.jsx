import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchBuyerOrders,
  selectBuyerOrders,
  selectBuyerOrdersLoading,
  selectBuyerOrdersError,
  selectBuyerOrdersPagination,
  clearError,
  confirmOrderReceipt,
} from "../../../redux/features/buyerOrders/buyerOrdersSlice";
import {
  fetchBuyerWalletBalance,
  selectBuyerWalletBalance,
  selectBuyerWalletCurrency,
} from "../../../redux/features/buyerWallet/buyerWalletSlice";
import { selectBuyer, logoutBuyer } from "../../../redux/features/buyerAuth/buyerAuthSlice";
import { useBuyerRealtime } from "../../../customHook/useBuyerRealtime";
import "./BuyerOrders.scss";

/**
 * BuyerOrders Component
 * Displays all orders placed by the current buyer with enhanced dashboard features
 */
const BuyerOrders = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const orders = useSelector(selectBuyerOrders);
  const loading = useSelector(selectBuyerOrdersLoading);
  const error = useSelector(selectBuyerOrdersError);
  const pagination = useSelector(selectBuyerOrdersPagination);
  const buyer = useSelector(selectBuyer);
  const walletBalance = useSelector(selectBuyerWalletBalance);
  const walletCurrency = useSelector(selectBuyerWalletCurrency);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(null);
  
  const handleLogout = async () => {
    await dispatch(logoutBuyer());
    navigate("/marketplace/login");
  };

  // Initialize buyer realtime notifications
  useBuyerRealtime();

  // Fetch orders and wallet balance on mount and when page/filter changes
  useEffect(() => {
    dispatch(
      fetchBuyerOrders({
        page: currentPage,
        limit: 20,
        status: statusFilter,
      })
    );
    dispatch(fetchBuyerWalletBalance());
  }, [dispatch, currentPage, statusFilter]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleOrderClick = (orderId) => {
    navigate(`/marketplace/buyer/orders/${orderId}`);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value || null);
    setCurrentPage(1);
  };

  const handleConfirmReceipt = (e, orderId) => {
    e.stopPropagation(); // Prevent navigating to order details
    if (window.confirm("Are you sure you have received this order? This will release the funds to the seller.")) {
      dispatch(confirmOrderReceipt(orderId));
    }
  };

  // Calculate order statistics
  const getOrderStats = () => {
    const stats = {
      total: orders.length,
      pending: orders.filter(order => order.status === 'payment_confirmed').length,
      processing: orders.filter(order => ['accepted', 'processing'].includes(order.status)).length,
      shipped: orders.filter(order => order.status === 'shipped').length,
      delivered: orders.filter(order => order.status === 'delivered').length,
      totalSpent: orders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + (order.subtotal || 0), 0)
    };
    return stats;
  };

  const stats = getOrderStats();

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "payment_confirmed":
        return "status-pending";
      case "accepted":
        return "status-accepted";
      case "processing":
        return "status-processing";
      case "shipped":
        return "status-shipped";
      case "delivered":
        return "status-delivered";
      case "received":
        return "status-received";
      case "rejected":
        return "status-rejected";
      default:
        return "status-default";
    }
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      payment_confirmed: "Pending",
      accepted: "Accepted",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      received: "Received",
      rejected: "Rejected",
    };
    return statusLabels[status] || status;
  };

  return (
    <div className="buyer-dashboard">
      {/* Welcome Section */}
      <div className="dashboard-welcome">
        <div className="welcome-content">
          <div className="welcome-header-row">
            <h1>Welcome back, {buyer?.firstName || 'Buyer'}! 👋</h1>
            <button className="dashboard-logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
          <p>Here's what's happening with your orders and account</p>
        </div>
        <div className="wallet-summary">
          <div className="wallet-balance">
            <span className="balance-label">Wallet Balance</span>
            <span className="balance-amount">
              {walletCurrency}{walletBalance?.toLocaleString() || '0'}
            </span>
          </div>
          <button
            className="wallet-button"
            onClick={() => navigate('/marketplace/buyer/wallet')}
          >
            View Wallet
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button
          className="action-button primary"
          onClick={() => navigate('/marketplace')}
        >
          🛒 Continue Shopping
        </button>
        <button
          className="action-button secondary"
          onClick={() => navigate('/marketplace/cart')}
        >
          🛍️ View Cart
        </button>
        <button
          className="action-button secondary"
          onClick={() => navigate('/marketplace/buyer/wallet')}
        >
          💰 Wallet & Transactions
        </button>
      </div>

      {/* Order Statistics */}
      <div className="order-stats">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Orders</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <span className="stat-number">{stats.pending + stats.processing}</span>
            <span className="stat-label">In Progress</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🚚</div>
          <div className="stat-info">
            <span className="stat-number">{stats.shipped}</span>
            <span className="stat-label">Shipped</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <span className="stat-number">{stats.delivered}</span>
            <span className="stat-label">Delivered</span>
          </div>
        </div>
        <div className="stat-card highlight">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-number">{walletCurrency}{stats.totalSpent.toLocaleString()}</span>
            <span className="stat-label">Total Spent</span>
          </div>
        </div>
      </div>

      {/* Orders Section */}
      <div className="orders-section">
        <div className="section-header">
          <h2>Your Orders</h2>
          <div className="orders-controls">
            <select
              className="status-filter"
              value={statusFilter || ""}
              onChange={handleStatusFilterChange}
            >
              <option value="">All Orders</option>
              <option value="payment_confirmed">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="error-alert">
            <span>{error}</span>
            <button onClick={() => dispatch(clearError())}>Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No orders yet</h3>
            <p>You haven't placed any orders. Start shopping to see your orders here!</p>
            <button
              className="shop-button"
              onClick={() => navigate("/marketplace")}
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="buyer-orders-list">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="order-card"
                  onClick={() => handleOrderClick(order._id)}
                >
                  <div className="order-card-header">
                    <div className="order-info">
                      <h3>Order #{order.orderNumber}</h3>
                      <p className="order-date">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="order-card-body">
                    <div className="order-details">
                      <p className="seller-name">
                        <strong>🏪 Seller:</strong> {order.business?.businessName || "N/A"}
                      </p>
                      <p className="item-count">
                        <strong>📦 Items:</strong> {order.lines?.length || 0} items
                      </p>
                      <p className="amount">
                        <strong>💰 Amount:</strong> {walletCurrency}{(order.subtotal || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="order-card-footer">
                    {order.status === "delivered" && (
                      <button
                        className="confirm-receipt-button"
                        onClick={(e) => handleConfirmReceipt(e, order._id)}
                      >
                        Confirm Receipt
                      </button>
                    )}
                    <button className="view-details-button">
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="pagination-button"
                >
                  ← Previous
                </button>

                <div className="pagination-info">
                  Page {currentPage} of {pagination.pages}
                </div>

                <button
                  disabled={currentPage === pagination.pages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="pagination-button"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BuyerOrders;
