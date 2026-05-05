import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import marketplaceService from "../../../services/marketplaceService";
import "./Marketplace.scss";

const humanize = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCurrency = (value) => `₦${Number(value || 0).toLocaleString()}`;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function InternalOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canDecide = order?.status === "payment_confirmed";
  const nextStatus = useMemo(() => {
    if (order?.status === "accepted") return "processing";
    if (order?.status === "processing") return "shipped";
    if (order?.status === "shipped") return "delivered";
    return "";
  }, [order?.status]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await marketplaceService.getInternalMarketplaceOrder(orderId);
      setOrder(response?.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load buyer order");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const handleDecide = async (decision) => {
    const payload = { decision };
    if (decision === "rejected") {
      const reason = window.prompt("Enter rejection reason");
      if (!reason) return;
      payload.reason = reason;
    }

    try {
      setIsSubmitting(true);
      await marketplaceService.decideInternalMarketplaceOrder(orderId, payload);
      toast.success(`Order ${decision}`);
      await fetchOrder();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${decision} order`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceStatus = async () => {
    if (!nextStatus) return;
    try {
      setIsSubmitting(true);
      await marketplaceService.updateInternalMarketplaceOrderStatus(orderId, {
        newStatus: nextStatus,
      });
      toast.success(`Order moved to ${humanize(nextStatus)}`);
      await fetchOrder();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update order status");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="marketplace-page">
        <div className="marketplace-panel">
          <p>Loading buyer order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="marketplace-page">
        <div className="marketplace-panel">
          <p>Order not found.</p>
          <Link className="marketplace-ghost-btn" to="/marketplace/orders">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-page marketplace-page--discount">
      <Helmet>
        <title>Buyer Order Detail | Sell Square</title>
      </Helmet>
      <div className="marketplace-header marketplace-header--with-action">
        <div>
          <h1>{order.orderNumber || order._id}</h1>
          <p>
            Buyer: {`${order.buyer?.firstName || ""} ${order.buyer?.lastName || ""}`.trim() || "-"} •{" "}
            {order.buyer?.email || "-"}
          </p>
        </div>
        <div className="marketplace-header-actions">
          <Link className="marketplace-ghost-btn" to="/marketplace/orders">
            Back to Orders
          </Link>
        </div>
      </div>

      <div className="marketplace-panel marketplace-order-detail-shell">
        <div className="discount-overview marketplace-order-hero">
          <div className="discount-overview-top">
            <div>
              <h3>Status: {humanize(order.status)}</h3>
              <p>Created {formatDate(order.createdAt)}</p>
            </div>
            <span className={`discount-status-badge marketplace-order-status-badge status-${order.status}`}>
              {humanize(order.status)}
            </span>
          </div>

          <div className="marketplace-orders-ops marketplace-order-actions">
            {canDecide ? (
              <>
                <button
                  type="button"
                  className="marketplace-primary-btn marketplace-loading-btn"
                  onClick={() => handleDecide("accepted")}
                  disabled={isSubmitting}
                >
                  Accept Order
                </button>
                <button
                  type="button"
                  className="marketplace-ghost-btn marketplace-loading-btn"
                  onClick={() => handleDecide("rejected")}
                  disabled={isSubmitting}
                >
                  Reject Order
                </button>
              </>
            ) : null}
            {nextStatus ? (
              <button
                type="button"
                className="marketplace-primary-btn marketplace-loading-btn"
                onClick={handleAdvanceStatus}
                disabled={isSubmitting}
              >
                Mark as {humanize(nextStatus)}
              </button>
            ) : null}
          </div>
        </div>

        <div className="discount-target-card marketplace-order-card">
          <h4>Order Lines</h4>
          <div className="discount-target-list marketplace-order-lines-list">
            {(order.lines || []).map((line) => (
              <div key={line._id || `${line.product}-${line.sku}`} className="discount-target-item marketplace-order-line-item">
                <div className="marketplace-order-line-main">
                  <strong>{line.name || "-"}</strong>
                  <p>SKU: {line.sku || "-"}</p>
                  <div className="marketplace-order-line-metrics">
                    <span>Qty {line.requestedQty || 0}</span>
                    <span>Price {formatCurrency(line.unitPrice || 0)}</span>
                    <span>Total {formatCurrency(line.lineTotal || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="discount-target-card marketplace-order-card">
          <h4>Order Summary</h4>
          <p>Subtotal: {formatCurrency(order.subtotal || 0)}</p>
          <p>Checkout Session: {order.checkoutSessionRef || "-"}</p>
          <p>Escrow: {order.escrowEntryId?.status || "-"}</p>
          {order.rejectionReason ? <p>Rejection reason: {order.rejectionReason}</p> : null}
        </div>
      </div>
    </div>
  );
}
