import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchBuyerOrderDetail,
  selectSelectedOrder,
  selectOrderDetailLoading,
  selectBuyerOrdersError,
  clearSelectedOrder,
} from "../../../redux/features/buyerOrders/buyerOrdersSlice";
import "./BuyerOrderDetail.scss";

/**
 * BuyerOrderDetail Component
 * Displays detailed information about a specific buyer order
 */
const BuyerOrderDetail = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const order = useSelector(selectSelectedOrder);
  const loading = useSelector(selectOrderDetailLoading);
  const error = useSelector(selectBuyerOrdersError);

  useEffect(() => {
    if (orderId) {
      dispatch(fetchBuyerOrderDetail(orderId));
    }

    return () => {
      dispatch(clearSelectedOrder());
    };
  }, [dispatch, orderId]);

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
      rejected: "Rejected",
    };
    return statusLabels[status] || status;
  };

  if (loading) {
    return (
      <div className="order-detail-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-detail-container">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Go Back
        </button>
        <div className="error-state">
          <p>{error || "Order not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="order-detail-container">
      <button className="back-button" onClick={() => navigate(-1)}>
        ← Go Back
      </button>

      <div className="order-detail-header">
        <div className="order-title-section">
          <h1>Order #{order.orderNumber}</h1>
          <p className="order-date">
            {new Date(order.createdAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>
      </div>

      <div className="order-detail-content">
        <div className="order-section seller-section">
          <h3>Seller Information</h3>
          <p className="seller-name">{order.business?.businessName || "N/A"}</p>
          <p className="seller-email">{order.business?.businessEmail || "N/A"}</p>
        </div>

        <div className="order-section customer-section">
          <h3>Shipping Address</h3>
          <p>{order.shippingAddress || "N/A"}</p>
        </div>

        {order.rejectionReason && (
          <div className="order-section rejection-section">
            <h3>Rejection Reason</h3>
            <p className="rejection-reason">{order.rejectionReason}</p>
          </div>
        )}

        <div className="order-section items-section">
          <h3>Order Items</h3>
          <table className="items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines && order.lines.length > 0 ? (
                order.lines.map((line, index) => (
                  <tr key={index}>
                    <td>{line.name}</td>
                    <td>{line.sku || "N/A"}</td>
                    <td>{line.requestedQty}</td>
                    <td>₦{line.unitPrice?.toLocaleString() || 0}</td>
                    <td>₦{line.lineTotal?.toLocaleString() || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-items">
                    No items in this order
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="order-section summary-section">
          <h3>Order Summary</h3>
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>₦{order.subtotal?.toLocaleString() || 0}</span>
          </div>
          <div className="summary-row total">
            <span>Total Amount:</span>
            <span>₦{order.subtotal?.toLocaleString() || 0}</span>
          </div>
        </div>

        {order.statusHistory && order.statusHistory.length > 0 && (
          <div className="order-section timeline-section">
            <h3>Status Timeline</h3>
            <div className="timeline">
              {order.statusHistory.map((entry, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <p className="timeline-transition">
                      {entry.from} → {entry.to}
                    </p>
                    <p className="timeline-date">
                      {new Date(entry.at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {entry.reason && (
                      <p className="timeline-reason">Reason: {entry.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerOrderDetail;
