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
import { selectBuyer } from "../../../redux/features/buyerAuth/buyerAuthSlice";
import { useBuyerRealtime } from "../../../customHook/useBuyerRealtime";
import "./BuyerOrders.scss";

/**
 * BuyerOrders Component
 * Displays all orders placed by the current buyer in a table format
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
    e.stopPropagation();
    if (window.confirm("Are you sure you have received this order? This will release the funds to the seller.")) {
      dispatch(confirmOrderReceipt(orderId));
    }
  };

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
      {/* Header */}
      <div className="dashboard-header">
        <h1>Orders</h1>
        <div className="header-right">
          <input type="text" placeholder="Search" className="search-input" />
          <button className="notification-btn" title="Notifications">🔔</button>
          <button className="user-menu-btn" title="User Menu">👤</button>
        </div>
      </div>

      {/* Orders Section */}
      <div className="orders-container">
        <div className="orders-header">
          <h2>Order</h2>
          <span className="orders-count">
            {orders.length} {statusFilter ? 'orders found' : 'orders found'}
          </span>
          <div className="orders-actions">
            <button className="date-filter">Last 7 days ↓</button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="status-tabs">
          <button
            className={`tab ${!statusFilter ? 'active' : ''}`}
            onClick={() => { setStatusFilter(null); setCurrentPage(1); }}
          >
            All orders
          </button>
          <button
            className={`tab ${statusFilter === 'payment_confirmed' ? 'active' : ''}`}
            onClick={() => { setStatusFilter('payment_confirmed'); setCurrentPage(1); }}
          >
            Active
          </button>
          <button
            className={`tab ${statusFilter === 'delivered' ? 'active' : ''}`}
            onClick={() => { setStatusFilter('delivered'); setCurrentPage(1); }}
          >
            Completed
          </button>
          <button
            className={`tab ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => { setStatusFilter('rejected'); setCurrentPage(1); }}
          >
            Rejected
          </button>
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
            {/* Orders Table */}
            <div className="table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th className="col-checkbox">
                      <input type="checkbox" />
                    </th>
                    <th className="col-order-id">Order ID</th>
                    <th className="col-product">Product</th>
                    <th className="col-address">Address</th>
                    <th className="col-date">Date/Time</th>
                    <th className="col-amount">Amount</th>
                    <th className="col-status">Status</th>
                    <th className="col-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id} className="order-row" onClick={() => handleOrderClick(order._id)}>
                      <td className="col-checkbox">
                        <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td className="col-order-id">
                        <span className="order-id">#{order.orderNumber || order._id.slice(0, 8)}</span>
                      </td>
                      <td className="col-product">
                        <span className="product-name">{order.lines?.[0]?.product?.name || 'N/A'} and {order.lines?.length > 1 ? `${order.lines.length - 1} other products` : ''}</span>
                      </td>
                      <td className="col-address">
                        <span className="address">{order.shippingAddress?.city || 'N/A'}, {order.shippingAddress?.state || ''}</span>
                      </td>
                      <td className="col-date">
                        <span className="date-time">
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit'
                          })}, {new Date(order.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </td>
                      <td className="col-amount">
                        <span className="amount">{walletCurrency}{(order.subtotal || 0).toLocaleString()}</span>
                      </td>
                      <td className="col-status">
                        <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="col-action">
                        <button className="action-menu-btn" onClick={(e) => e.stopPropagation()}>⋮</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="pagination">
                <span className="pagination-info">Showing 1 to 8 of {orders.length} entries</span>
                <div className="pagination-buttons">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="pagination-button"
                  >
                    Previous
                  </button>
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).slice(0, 5).map((page) => (
                    <button
                      key={page}
                      className={`pagination-button ${currentPage === page ? 'active' : ''}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    disabled={currentPage === pagination.pages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="pagination-button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BuyerOrders;
