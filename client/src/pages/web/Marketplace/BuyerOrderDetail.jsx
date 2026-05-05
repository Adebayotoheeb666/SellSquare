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
        ← Go back
      </button>

      <div className="product-list-section">
        <h2>Product List</h2>

        <div className="products-table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th className="col-index">#</th>
                <th className="col-image">Image</th>
                <th className="col-product-name">Product Name</th>
                <th className="col-price">Price</th>
                <th className="col-quantity">Quantity</th>
                <th className="col-subtotal">Sub-total</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {order.lines && order.lines.length > 0 ? (
                order.lines.map((line, index) => (
                  <tr key={index}>
                    <td className="col-index">{index + 1}</td>
                    <td className="col-image">
                      {line.product?.image ? (
                        <img src={line.product.image} alt={line.name} className="product-thumbnail" />
                      ) : (
                        <div className="product-thumbnail-placeholder">No image</div>
                      )}
                    </td>
                    <td className="col-product-name">{line.name || line.product?.name || "N/A"}</td>
                    <td className="col-price">₦{line.unitPrice?.toLocaleString() || 0}</td>
                    <td className="col-quantity">{line.requestedQty}</td>
                    <td className="col-subtotal">₦{line.lineTotal?.toLocaleString() || 0}</td>
                    <td className="col-action">
                      <button className="action-btn" title="More options">⋮</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-items">
                    No items in this order
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="order-totals">
          <div className="total-row">
            <span className="total-label">Total</span>
            <span className="total-amount">₦{order.subtotal?.toLocaleString() || 0}</span>
          </div>
        </div>

        <div className="payment-method-section">
          <h3>Payment Method</h3>
          <p className="payment-type">{order.paymentMethod || "Card Payment"}</p>
        </div>

        <div className="tracking-details-section">
          <h3>Tracking Details</h3>
          <div className="tracking-grid">
            <div className="tracking-item">
              <label>Order ID</label>
              <p className="tracking-value">{order.orderNumber || order._id}</p>
            </div>
            <div className="tracking-item">
              <label>Placed on</label>
              <p className="tracking-value">
                {new Date(order.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="tracking-item">
              <label>Status</label>
              <p className="tracking-value">
                <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                  {getStatusLabel(order.status)}
                </span>
              </p>
            </div>
            <div className="tracking-item">
              <label>Estimated Delivery Date</label>
              <p className="tracking-value">
                {order.estimatedDeliveryDate
                  ? new Date(order.estimatedDeliveryDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {order.rejectionReason && (
          <div className="rejection-section">
            <h3>Rejection Reason</h3>
            <p className="rejection-reason">{order.rejectionReason}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerOrderDetail;
