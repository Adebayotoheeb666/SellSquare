import React, { useState, useEffect, useCallback } from "react";
import marketplaceAdminService from "../../../../services/marketplaceAdminService";
import { toast } from "sonner";
import moment from "moment";

const EscrowManagementTab = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [releasingId, setReleasingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  const fetchOrders = useCallback(async (page = 1, status = "all") => {
    setLoading(true);
    try {
      const response = await marketplaceAdminService.listPendingEscrows({
        page,
        status,
        limit: 20,
      });
      setOrders(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch pending escrows:", error);
      toast.error(error.response?.data?.message || "Failed to load escrow orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(1, filter);
  }, [fetchOrders, filter]);

  const handleReleaseFunds = async (orderId) => {
    if (!window.confirm("Are you sure you want to manually release these funds to the business? This action cannot be undone.")) {
      return;
    }

    setReleasingId(orderId);
    try {
      await marketplaceAdminService.releaseEscrow(orderId);
      toast.success("Funds released successfully");
      // Refresh list
      fetchOrders(pagination.page, filter);
    } catch (error) {
      console.error("Failed to release escrow:", error);
      toast.error(error.response?.data?.message || "Failed to release funds");
    } finally {
      setReleasingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "received":
        return "status-delivered"; // Use existing styles if possible
      case "delivered":
        return "status-shipped";
      case "shipped":
        return "status-shipped";
      default:
        return "status-default";
    }
  };

  return (
    <div className="escrow_management_tab">
      <div className="tab_header">
        <h2>Escrow Management</h2>
        <div className="filter_controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="admin_select"
          >
            <option value="all">All Pending</option>
            <option value="received">Received (Customer confirmed)</option>
            <option value="delivered">Delivered (Awaiting confirmation)</option>
          </select>
          <button 
            className="refresh_btn" 
            onClick={() => fetchOrders(pagination.page, filter)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="businesses-table-wrapper">
        {loading ? (
          <div className="loading_state">
            <div className="spinner"></div>
            <p>Loading escrow orders...</p>
          </div>
        ) : orders.length > 0 ? (
          <table className="businesses-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Business</th>
                <th>Buyer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>
                    <span className="order_number">#{order.orderNumber}</span>
                  </td>
                  <td>
                    <div className="info_cell">
                      <strong>{order.business?.businessName}</strong>
                      <span>{order.business?.email}</span>
                    </div>
                  </td>
                  <td>
                    <div className="info_cell">
                      <strong>{order.buyer?.firstName} {order.buyer?.lastName}</strong>
                      <span>{order.buyer?.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className="amount_cell">
                      ₦{order.subtotal?.toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <span className={`plan-badge ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <span className="date_cell">
                      {moment(order.receivedAt || order.deliveredAt || order.createdAt).format("MMM D, YYYY")}
                    </span>
                  </td>
                  <td>
                    <button
                      className="release_btn"
                      onClick={() => handleReleaseFunds(order._id)}
                      disabled={releasingId === order._id}
                    >
                      {releasingId === order._id ? "Releasing..." : "Release Funds"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no_results">
            <h3 className="empty_state_title">No Pending Escrows</h3>
            <p className="empty_state_description">
              There are currently no orders awaiting manual escrow release.
            </p>
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="pagination-button"
            disabled={pagination.page === 1}
            onClick={() => fetchOrders(pagination.page - 1, filter)}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            className="pagination-button"
            disabled={pagination.page === pagination.pages}
            onClick={() => fetchOrders(pagination.page + 1, filter)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default EscrowManagementTab;
