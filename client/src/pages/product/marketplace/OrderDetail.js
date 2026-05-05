import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import "./Marketplace.scss";
import marketplaceService from "../../../services/marketplaceService";
import {
  selectBulkMarketplaceOrders,
  updateBulkCacheItem,
} from "../../../redux/features/dataCache/bulkDataCacheSlice";

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

const STATUS_LABELS = {
  placed: "Placed",
  payment_confirmed: "Payment Confirmed",
  accepted: "Accepted",
  rejected: "Rejected",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
};

const compactAddressFromValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object") return "";

  const parts = [
    value.addressLine1,
    value.addressLine2,
    value.street,
    value.city,
    value.state,
    value.country,
    value.postalCode,
    value.zip,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  return parts.join(", ");
};

const humanizeFulfillmentMethod = (method) => {
  const normalized = String(method || "").toLowerCase().trim();
  if (normalized === "pickup") return "Pickup";
  if (normalized === "delivery") return "Delivery";
  return "-";
};

const getLineImage = (line = {}) =>
  line?.selectedImage ||
  line?.lineMeta?.selectedImage ||
  line?.variantImage ||
  line?.lineMeta?.variantImage ||
  line?.groupImage ||
  line?.lineMeta?.groupImage ||
  line?.variant?.image ||
  line?.image ||
  line?.product?.image ||
  line?.productSnapshot?.variant?.image ||
  line?.productSnapshot?.variantImage ||
  line?.productSnapshot?.image ||
  line?.productSnapshot?.coverImage ||
  line?.productSnapshot?.images?.[0] ||
  line?.images?.[0] ||
  "";

const getLineVariantLabel = (line = {}) =>
  line?.variant?.name ||
  line?.variantName ||
  line?.optionLabel ||
  line?.productSnapshot?.variant?.name ||
  line?.productSnapshot?.variantName ||
  "";

const getLineBoughtQty = (line = {}) =>
  Number(line?.requestedQty ?? line?.quantity ?? line?.qty ?? 0);

const buildFullAcceptDecisions = (lines = []) =>
  lines.map((line) => ({
    lineId: line.lineId,
    acceptedQty: line.lineStatus === "out_of_stock" ? 0 : Number(line.requestedQty || 0),
    rejectedQty: line.lineStatus === "out_of_stock" ? Number(line.requestedQty || 0) : 0,
    reason: line.lineStatus === "out_of_stock" ? "Out of stock" : "Full acceptance",
  }));

const buildFullRejectDecisions = (lines = []) =>
  lines.map((line) => ({
    lineId: line.lineId,
    acceptedQty: 0,
    rejectedQty: Number(line.requestedQty || 0),
    reason: "Full rejection",
  }));

const MarketplaceOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const marketplaceOrders = useSelector(selectBulkMarketplaceOrders);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState("");

  const order = useMemo(
    () => marketplaceOrders?.byId?.[orderId] || null,
    [marketplaceOrders, orderId],
  );

  // log order for debugging
  console.log("MarketplaceOrderDetail - order:", order);

  const sortedHistory = useMemo(() => {
    const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
    return [...history].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [order?.statusHistory]);

  const canConfirmPayment = order?.status === "placed";
  const canDecideLines = order?.status === "payment_confirmed";
  const fulfillmentMethod = humanizeFulfillmentMethod(order?.fulfillment?.method);
  const compactAddress =
    compactAddressFromValue(order?.shippingAddress) || compactAddressFromValue(order?.customer?.address);
  const buyerPhone =
    order?.shippingAddress?.phone || order?.fulfillment?.phone || order?.customer?.phone || "";
  const buyerEmail =
    order?.shippingAddress?.email || order?.fulfillment?.email || order?.customer?.email || "";

  const nextStatusAction = useMemo(() => {
    if (!order?.status) return null;

    if (order.status === "accepted") {
      return {
        status: "processing",
        label: "Mark as Processing",
      };
    }

    if (order.status === "processing") {
      return {
        status: "shipped",
        label: "Mark as Shipped",
      };
    }

    if (order.status === "shipped") {
      return {
        status: "delivered",
        label: "Mark as Delivered",
      };
    }

    return null;
  }, [order?.status]);

  const patchOrderInCache = (updatedOrder) => {
    if (!updatedOrder?._id) return;

    dispatch(
      updateBulkCacheItem({
        dataType: "marketplaceOrders",
        item: updatedOrder,
      }),
    );
  };

  const startAction = (actionKey) => {
    setIsSubmitting(true);
    setActiveAction(actionKey);
  };

  const finishAction = () => {
    setIsSubmitting(false);
    setActiveAction("");
  };

  const isActionLoading = (actionKey) => isSubmitting && activeAction === actionKey;

  const ActionButtonContent = ({ loading, idleLabel, loadingLabel }) => {
    return (
      <>
        {loading ? <span className="marketplace-btn-spinner" aria-hidden="true" /> : null}
        <span>{loading ? loadingLabel : idleLabel}</span>
      </>
    );
  };

  const handleConfirmPayment = async () => {
    if (!order?._id || isSubmitting) return;

    try {
      startAction("confirm_payment");
      const response = await marketplaceService.confirmMarketplacePayment(order._id, {
        paymentId: `internal_${Date.now()}`,
        trustedPaidFlag: false,
      });

      patchOrderInCache(response?.order);
      toast.success("Payment confirmed");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to confirm payment",
      );
    } finally {
      finishAction();
    }
  };

  const handleFullAccept = async () => {
    if (!order?._id || isSubmitting) return;

    try {
      startAction("full_accept");
      const response = await marketplaceService.decideMarketplaceOrderLines(order._id, {
        decisions: buildFullAcceptDecisions(order.lines || []),
      });

      patchOrderInCache(response?.order);
      toast.success("Order fully accepted");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to accept order",
      );
    } finally {
      finishAction();
    }
  };

  const handleFullReject = async () => {
    if (!order?._id || isSubmitting) return;

    try {
      startAction("full_reject");
      const response = await marketplaceService.decideMarketplaceOrderLines(order._id, {
        decisions: buildFullRejectDecisions(order.lines || []),
      });

      patchOrderInCache(response?.order);
      toast.success("Order fully rejected");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to reject order",
      );
    } finally {
      finishAction();
    }
  };

  const handleAdvanceStatus = async () => {
    if (!order?._id || !nextStatusAction || isSubmitting) return;

    try {
      startAction("advance_status");
      const response = await marketplaceService.updateMarketplaceOrderStatus(order._id, {
        status: nextStatusAction.status,
        reason: `Internal operation: ${nextStatusAction.status}`,
      });

      patchOrderInCache(response?.order);
      toast.success(`${humanize(nextStatusAction.status)} updated`);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to update status",
      );
    } finally {
      finishAction();
    }
  };

  const handleRefreshOrder = async () => {
    if (!order?._id || isSubmitting) return;

    try {
      startAction("refresh_order");
      const response = await marketplaceService.getMarketplaceOrder(order._id);
      patchOrderInCache(response?.order);
      toast.success("Order refreshed");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to refresh order",
      );
    } finally {
      finishAction();
    }
  };

  if (!order) {
    return (
      <div className="marketplace-page">
        <div className="marketplace-header">
          <h1>Order Details</h1>
          <p>The order is not available in cache yet. Return to Orders list.</p>
        </div>
        <div className="marketplace-panel">
          <button
            type="button"
            className="marketplace-ghost-btn"
            onClick={() => navigate("/marketplace/orders")}
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-page marketplace-page--discount">
      <Helmet>
        <title>Order Detail | Sell Square</title>
        <meta
          name="description"
          content="Manage marketplace order operations in Sell Square."
        />
      </Helmet>

      <div className="marketplace-header marketplace-header--with-action">
        <div>
          <h1>{order.orderNumber || order._id}</h1>
          <p>
            Partner Ref: {order.partnerOrderRef || "-"} • Created {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="marketplace-header-actions">
          <button
            type="button"
            className="marketplace-ghost-btn"
            onClick={handleRefreshOrder}
            disabled={isActionLoading("refresh_order")}
          >
            <ActionButtonContent
              loading={isActionLoading("refresh_order")}
              idleLabel="Refresh"
              loadingLabel="Refreshing"
            />
          </button>
          <Link className="marketplace-ghost-btn" to="/marketplace/orders">
            Back to Orders
          </Link>
        </div>
      </div>

      <div className="marketplace-panel marketplace-order-detail-shell">
        <div className="discount-overview marketplace-order-hero">
          <div className="discount-overview-top">
            <div>
              <h3>Status: {STATUS_LABELS[order?.status] || humanize(order?.status)}</h3>
              <p>
                Customer: {order.customer?.name || "-"} • {order.customer?.email || "-"}
              </p>
            </div>
            <div className="discount-overview-actions">
              <span className={`discount-status-badge marketplace-order-status-badge status-${order?.status || "unknown"}`}>
                {STATUS_LABELS[order?.status] || humanize(order?.status)}
              </span>
            </div>
          </div>

          <div className="marketplace-order-meta-actions-layout">
            <div className="marketplace-order-meta-grid">
              <div className="marketplace-order-meta-card">
                <span>Customer</span>
                <strong>{order.customer?.name || "-"}</strong>
                <p>{order.customer?.email || order.customer?.phone || "-"}</p>
              </div>
              <div className="marketplace-order-meta-card">
                <span>Shipping Contact</span>
                <strong>{order.shippingAddress?.name || order.customer?.name || "-"}</strong>
                <p>{order.shippingAddress?.phone || order.customer?.phone || "-"}</p>
              </div>
              <div className="marketplace-order-meta-card">
                <span>Payment</span>
                <strong>{order.payment?.isPaid ? "Paid" : "Pending"}</strong>
                <p>{order.payment?.paymentId || "No payment reference"}</p>
              </div>
            </div>

            <div className="marketplace-orders-ops marketplace-order-actions">
              {canConfirmPayment ? (
                <button
                  type="button"
                  className="marketplace-primary-btn marketplace-loading-btn"
                  disabled={isSubmitting}
                  onClick={handleConfirmPayment}
                >
                  <ActionButtonContent
                    loading={isActionLoading("confirm_payment")}
                    idleLabel="Confirm Payment"
                    loadingLabel="Confirming Payment..."
                  />
                </button>
              ) : null}

              {canDecideLines ? (
                <>
                  <button
                    type="button"
                    className="marketplace-primary-btn marketplace-loading-btn"
                    disabled={isSubmitting}
                    onClick={handleFullAccept}
                  >
                    <ActionButtonContent
                      loading={isActionLoading("full_accept")}
                      idleLabel="Full Accept Order"
                      loadingLabel="Accepting Order..."
                    />
                  </button>
                  <button
                    type="button"
                    className="marketplace-ghost-btn marketplace-loading-btn"
                    disabled={isSubmitting}
                    onClick={handleFullReject}
                  >
                    <ActionButtonContent
                      loading={isActionLoading("full_reject")}
                      idleLabel="Full Reject Order"
                      loadingLabel="Rejecting Order..."
                    />
                  </button>
                </>
              ) : null}

              {nextStatusAction ? (
                <button
                  type="button"
                  className="marketplace-primary-btn marketplace-loading-btn"
                  disabled={isSubmitting}
                  onClick={handleAdvanceStatus}
                >
                  <ActionButtonContent
                    loading={isActionLoading("advance_status")}
                    idleLabel={nextStatusAction.label}
                    loadingLabel="Updating Status..."
                  />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="discount-target-card marketplace-order-card">
          <h4>Order Lines</h4>
          <div className="marketplace-order-line-metrics" style={{ marginTop: 0, marginBottom: 10 }}>
            <span>Fulfillment: {fulfillmentMethod}</span>
            {compactAddress ? <span>Address: {compactAddress}</span> : null}
            {buyerPhone ? <span>Phone: {buyerPhone}</span> : null}
            {buyerEmail ? <span>Email: {buyerEmail}</span> : null}
          </div>
          <div className="discount-target-list marketplace-order-lines-list">
            {(order.lines || []).map((line) => (
              <div key={line.lineId} className="discount-target-item marketplace-order-line-item">
                <div className="marketplace-order-line-media">
                  {getLineImage(line) ? (
                    <img src={getLineImage(line)} alt={line.name || "Order line"} className="marketplace-order-line-image" loading="lazy" />
                  ) : (
                    <div className="marketplace-order-line-image marketplace-order-line-image--placeholder" aria-hidden="true">
                      {String(line.name || "Item").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="marketplace-order-line-main">
                    <strong>{line.name}</strong>
                    {getLineVariantLabel(line) ? (
                      <span className="marketplace-order-line-variant">{getLineVariantLabel(line)}</span>
                    ) : null}
                    <p>SKU: {line.sku || "-"}</p>
                    <div className="marketplace-order-line-metrics">
                      <span>Qty Bought {getLineBoughtQty(line)}</span>
                      <span>Requested {line.requestedQty}</span>
                      <span>Accepted {line.acceptedQty || 0}</span>
                      <span>Rejected {line.rejectedQty || 0}</span>
                    </div>
                  </div>
                </div>
                <span className={`discount-status-chip marketplace-order-line-chip status-${line?.lineStatus || "unknown"}`}>
                  {humanize(line.lineStatus)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="discount-target-card marketplace-order-card">
          <h4>Status History</h4>
          {sortedHistory.length > 0 ? (
            <div className="marketplace-status-history-list">
              {sortedHistory.map((entry, index) => (
                <article key={`${entry.to}-${entry.at}-${index}`} className="marketplace-status-history-item">
                  <div className="marketplace-status-history-marker" aria-hidden="true">
                    <span />
                  </div>
                  <div className="marketplace-status-history-content">
                    <div className="marketplace-status-history-top">
                      <strong>{humanize(entry.to)}</strong>
                      <span>{formatDate(entry.at)}</span>
                    </div>
                    <p>
                      From {humanize(entry.from || "-")} • By {entry.by || "system"}
                    </p>
                    {entry.reason ? (
                      <span className="marketplace-status-history-reason">{entry.reason}</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="marketplace-order-muted">No status history yet.</p>
          )}
        </div>

        <div className="discount-target-card marketplace-order-card">
          <h4>Warnings</h4>
          {Array.isArray(order.warnings) && order.warnings.length > 0 ? (
            <ul className="marketplace-order-warning-list">
              {order.warnings.map((warning, index) => (
                <li key={`${warning.code || "warning"}-${index}`}>
                  {warning.code ? `${warning.code}: ` : ""}
                  {warning.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="marketplace-order-muted">No warnings</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceOrderDetail;
