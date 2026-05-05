import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import "./Marketplace.scss";
import marketplaceService from "../../../services/marketplaceService";
import {
  selectMarketplaceOrdersArray,
  selectMarketplaceOrdersMeta,
  fetchBulkMarketplaceOrders,
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

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "placed", label: "Placed" },
  { value: "payment_confirmed", label: "Payment Confirmed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
];

const MarketplaceOrders = () => {
  const dispatch = useDispatch();
  const orders = useSelector(selectMarketplaceOrdersArray);
  const meta = useSelector(selectMarketplaceOrdersMeta);
  const [activeTab, setActiveTab] = useState("partner");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [buyerOrders, setBuyerOrders] = useState([]);
  const [buyerLoading, setBuyerLoading] = useState(false);
  const [buyerReloadTick, setBuyerReloadTick] = useState(0);
  const filterRef = useRef(null);

  useEffect(() => {
    if (activeTab === "partner") {
      dispatch(
        fetchBulkMarketplaceOrders({
          force: false,
          status: statusFilter === "all" ? "" : statusFilter,
        }),
      );
    }
  }, [dispatch, activeTab, statusFilter]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!filterRef.current?.contains(event.target)) {
        setShowFilterMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowFilterMenu(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const fetchBuyerOrders = async () => {
      if (activeTab !== "buyer") return;
      try {
        setBuyerLoading(true);
        const response = await marketplaceService.getInternalMarketplaceOrders({
          status: statusFilter === "all" ? "" : statusFilter,
          page: 1,
          limit: 20,
        });
        setBuyerOrders(response?.data || []);
      } catch (error) {
        setBuyerOrders([]);
      } finally {
        setBuyerLoading(false);
      }
    };

    fetchBuyerOrders();
  }, [activeTab, statusFilter, buyerReloadTick]);

  const sourceOrders = activeTab === "partner" ? orders : buyerOrders;

  const sortedOrders = useMemo(
    () =>
      [...sourceOrders].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      ),
    [sourceOrders],
  );

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return sortedOrders.filter((order) => {
      if (statusFilter !== "all" && order?.status !== statusFilter) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        order?.orderNumber,
        order?.partnerOrderRef,
        order?.customer?.name,
        order?.customer?.email,
        order?._id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [searchTerm, sortedOrders, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: sortedOrders.length,
      placed: 0,
      payment_confirmed: 0,
      accepted: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      rejected: 0,
    };

    sortedOrders.forEach((order) => {
      const orderStatus = order?.status;
      if (counts[orderStatus] !== undefined) {
        counts[orderStatus] += 1;
      }
    });

    return counts;
  }, [sortedOrders]);

  const summaryMetrics = useMemo(() => {
    return sortedOrders.reduce(
      (acc, order) => {
        const acceptedRevenue = Number(order?.totals?.acceptedSubtotal || 0);
        const requestedRevenue = Number(order?.totals?.requestedSubtotal || 0);

        acc.totalRevenue += acceptedRevenue > 0 ? acceptedRevenue : requestedRevenue;
        acc.totalItems += (order?.lines || []).reduce(
          (lineAcc, line) => lineAcc + Number(line?.requestedQty || 0),
          0,
        );
        if (order?.payment?.isPaid) {
          acc.paidOrders += 1;
        }
        return acc;
      },
      {
        totalItems: 0,
        totalRevenue: 0,
        paidOrders: 0,
      },
    );
  }, [sortedOrders]);

  return (
    <div className="marketplace-page">
      <Helmet>
        <title>Marketplace Orders | Sell Square</title>
        <meta
          name="description"
          content="Track and manage marketplace orders in Sell Square."
        />
      </Helmet>

      <div className="marketplace-header">
        <h1>Orders</h1>
        <p>
          Track marketplace orders in real time and take action quickly across payment,
          acceptance, and fulfillment.
        </p>
      </div>

      <div className="marketplace-panel">
        <div className="discount-tabs" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={activeTab === "partner" ? "active" : ""}
            onClick={() => setActiveTab("partner")}
          >
            Partner Orders
          </button>
          <button
            type="button"
            className={activeTab === "buyer" ? "active" : ""}
            onClick={() => setActiveTab("buyer")}
          >
            Buyer Orders
          </button>
        </div>

        <div className="marketplace-orders-summary-grid">
          <div className="marketplace-orders-summary-card">
            <span>Total Orders</span>
            <strong>{statusCounts.all}</strong>
          </div>
          <div className="marketplace-orders-summary-card">
            <span>Total Items</span>
            <strong>{summaryMetrics.totalItems}</strong>
          </div>
          <div className="marketplace-orders-summary-card">
            <span>Total Revenue</span>
            <strong>{formatCurrency(summaryMetrics.totalRevenue)}</strong>
          </div>
          <div className="marketplace-orders-summary-card">
            <span>Paid Orders</span>
            <strong>{summaryMetrics.paidOrders}</strong>
          </div>
        </div>

        <div className="discount-controls marketplace-orders-controls">
          <div className="discount-searchbox">
            <input
              type="search"
              value={searchTerm}
              placeholder="Search by order number, customer, partner ref"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="marketplace-orders-filter-wrap" ref={filterRef}>
            <button
              type="button"
              className={`marketplace-orders-filter-btn ${statusFilter !== "all" ? "is-active" : ""}`}
              aria-label="Filter orders by status"
              aria-expanded={showFilterMenu}
              onClick={() => setShowFilterMenu((prev) => !prev)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M4 6H20M7 12H17M10 18H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {showFilterMenu ? (
              <div className="marketplace-orders-filter-menu" role="menu">
                {STATUS_OPTIONS.map((option) => {
                  const count = statusCounts[option.value] ?? statusCounts.all;
                  const active = statusFilter === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`marketplace-orders-filter-item ${active ? "is-active" : ""}`}
                      onClick={() => {
                        setStatusFilter(option.value);
                        setShowFilterMenu(false);
                      }}
                    >
                      <span>{option.label}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="marketplace-ghost-btn discount-refresh-btn"
            onClick={() =>
              activeTab === "partner"
                ? dispatch(
                    fetchBulkMarketplaceOrders({
                      force: true,
                      status: statusFilter === "all" ? "" : statusFilter,
                    }),
                  )
                : setBuyerReloadTick((prev) => prev + 1)
            }
            title="Refresh orders"
            aria-label="Refresh orders"
          >
            <span className="discount-refresh-icon" aria-hidden="true">
              ↻
            </span>
            <span className="discount-refresh-label">Refresh</span>
          </button>
        </div>

        {(activeTab === "partner" ? meta?.isLoading : buyerLoading) ? <p>Loading marketplace orders…</p> : null}
        {!(activeTab === "partner" ? meta?.isLoading : buyerLoading) && filteredOrders.length === 0 ? (
          <div className="marketplace-empty">
            <h3>No orders yet</h3>
            <p>New marketplace orders will appear here as they are created.</p>
          </div>
        ) : null}

        {!(activeTab === "partner" ? meta?.isLoading : buyerLoading) && filteredOrders.length > 0 ? (
          <div className="discounts-table-wrap marketplace-orders-table-wrap marketplace-orders-table-desktop">
            <table className="discounts-table marketplace-orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>{activeTab === "partner" ? "Customer" : "Buyer"}</th>
                  <th>Status</th>
                  <th>{activeTab === "partner" ? "Payment" : "Escrow"}</th>
                  <th>Totals</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order._id}>
                    <td>
                      <strong>{order.orderNumber || order._id}</strong>
                      <p className="marketplace-orders-subtext">
                        Ref: {activeTab === "partner" ? order.partnerOrderRef || "-" : order.checkoutSessionRef || "-"}
                      </p>
                    </td>
                    <td>
                      <strong>
                        {activeTab === "partner"
                          ? order.customer?.name || "-"
                          : `${order.buyer?.firstName || ""} ${order.buyer?.lastName || ""}`.trim() || "-"}
                      </strong>
                      <p className="marketplace-orders-subtext">
                        {activeTab === "partner"
                          ? order.customer?.email || order.customer?.phone || "-"
                          : order.buyer?.email || "-"}
                      </p>
                    </td>
                    <td>
                      <span className={`discount-status-badge marketplace-order-status-badge status-${order?.status || "unknown"}`}>
                        {humanize(order.status)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`marketplace-order-payment-badge ${
                          activeTab === "partner"
                            ? order.payment?.isPaid
                              ? "is-paid"
                              : "is-pending"
                            : order.escrowEntryId?.status === "held"
                              ? "is-paid"
                              : "is-pending"
                        }`}
                      >
                        {activeTab === "partner"
                          ? order.payment?.isPaid
                            ? "Paid"
                            : "Pending"
                          : order.escrowEntryId?.status || "held"}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {formatCurrency(
                          activeTab === "partner"
                            ? order.totals?.requestedSubtotal
                            : order.subtotal,
                        )}
                      </strong>
                      <p className="marketplace-orders-subtext">
                        {activeTab === "partner"
                          ? `Accepted ${formatCurrency(order.totals?.acceptedSubtotal)}`
                          : `${order.lines?.length || 0} item(s)`}
                      </p>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <Link
                        className="marketplace-primary-btn marketplace-orders-action-btn"
                        to={
                          activeTab === "partner"
                            ? `/marketplace/orders/${order._id}`
                            : `/marketplace/buyer-orders/${order._id}`
                        }
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MarketplaceOrders;
