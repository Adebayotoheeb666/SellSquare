import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { confirmAlert } from "react-confirm-alert";
import moment from "moment";
import { toast } from "sonner";
import "react-confirm-alert/src/react-confirm-alert.css";
import "./Marketplace.scss";
import { deleteDiscount } from "../../../redux/features/discount/discountSlice";
import {
  fetchBulkDiscounts,
  removeBulkCacheItem,
  selectDiscountsArray,
  selectDiscountsMeta,
} from "../../../redux/features/dataCache/bulkDataCacheSlice";
import { selectIsBootstrapped } from "../../../redux/features/dataCache/dataCacheSlice";
import { selectIsLoggedIn } from "../../../redux/features/auth/authSlice";

const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="7"
      cy="7"
      r="5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 11L15 15"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FilterIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 4H18M5 9H15M8 14H12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const formatDiscountValue = (discount) => {
  const amount = Number(discount?.discountAmount || 0);
  return discount?.discountValueType === "percentage"
    ? `${amount}%`
    : `₦${amount.toLocaleString()}`;
};

const formatAppliedTo = (discount) => {
  if (discount?.applyTo === "both") {
    const productCount = Array.isArray(discount?.appliedProducts)
      ? discount.appliedProducts.length
      : 0;
    const groupCount = Array.isArray(discount?.appliedProductGroups)
      ? discount.appliedProductGroups.length
      : 0;
    return `${productCount} product${productCount === 1 ? "" : "s"}, ${groupCount} group${groupCount === 1 ? "" : "s"}`;
  }

  if (discount?.applyTo === "single_product") {
    const count = Array.isArray(discount?.appliedProducts)
      ? discount.appliedProducts.length
      : 0;
    return `${count} product${count === 1 ? "" : "s"}`;
  }

  const count = Array.isArray(discount?.appliedProductGroups)
    ? discount.appliedProductGroups.length
    : 0;
  return `${count} group${count === 1 ? "" : "s"}`;
};

const MarketplaceDiscounts = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const actionRef = useRef(null);
  const menuRef = useRef(null);
  const filterRef = useRef(null);
  const hasAttemptedDiscountRecoveryRef = useRef(false);

  const discounts = useSelector(selectDiscountsArray);
  const discountsMeta = useSelector(selectDiscountsMeta);
  const isBootstrapped = useSelector(selectIsBootstrapped);
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!actionRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpenMenuId(null);
      }

      if (!filterRef.current?.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !isBootstrapped) {
      return;
    }

    if (discountsMeta?.isLoading) {
      return;
    }

    const hasCompletedBulkHydration =
      Boolean(discountsMeta?.lastFetchedAt) &&
      discountsMeta?.isComplete &&
      !discountsMeta?.error;

    if (hasCompletedBulkHydration) {
      hasAttemptedDiscountRecoveryRef.current = false;
      return;
    }

    const hasRuntimeItems = discounts.length > 0;
    const needsInitialOrErrorRecovery =
      !discountsMeta?.lastFetchedAt || Boolean(discountsMeta?.error);
    const needsPartialRealtimeRecovery =
      hasRuntimeItems && !discountsMeta?.isComplete;

    if (
      !hasAttemptedDiscountRecoveryRef.current &&
      (needsInitialOrErrorRecovery || needsPartialRealtimeRecovery)
    ) {
      hasAttemptedDiscountRecoveryRef.current = true;
      dispatch(fetchBulkDiscounts({ force: true }));
    }
  }, [
    dispatch,
    discounts.length,
    discountsMeta?.error,
    discountsMeta?.isLoading,
    discountsMeta?.lastFetchedAt,
    discountsMeta?.isComplete,
    isBootstrapped,
    isLoggedIn,
  ]);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  const sortedDiscounts = useMemo(() => {
    return [...discounts].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }, [discounts]);

  const filteredDiscounts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return sortedDiscounts.filter((discount) => {
      if (statusFilter !== "all" && (discount?.status || "draft") !== statusFilter) {
        return false;
      }

      if (typeFilter !== "all" && discount?.discountType !== typeFilter) {
        return false;
      }

      if (!term) return true;

      const haystack = `${discount?.discountName || ""} ${discount?.discountType || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [searchTerm, sortedDiscounts, statusFilter, typeFilter]);

  const handleDelete = (id) => {
    confirmAlert({
      title: "Delete Discount",
      message: "Are you sure you want to delete this discount?",
      buttons: [
        {
          label: "Delete",
          onClick: async () => {
            await dispatch(deleteDiscount(id));
            dispatch(removeBulkCacheItem({ dataType: "discounts", itemId: id }));
            toast.success("Discount deleted successfully");
          },
        },
        {
          label: "Cancel",
        },
      ],
    });
  };

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0);

  return (
    <div className="marketplace-page marketplace-page--discount">
      <Helmet>
        <title>Marketplace Discounts | Sell Square</title>
        <meta
          name="description"
          content="Create and manage marketplace discounts in Sell Square."
        />
      </Helmet>

      <div className="marketplace-header marketplace-header--with-action marketplace-header--stacked-mobile">
        <div>
          <h1>Discounts</h1>
          <p>Manage promotions and discounts for marketplace products.</p>
        </div>
        <div className="discount-controls">
          <div className="discount-searchbox">
            <span className="discount-searchbox-icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={searchTerm}
              placeholder="Search discounts by name or type"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="discount-filter" ref={filterRef}>
            <button
              type="button"
              className={`discount-filter-btn ${activeFilterCount > 0 ? "is-active" : ""}`}
              onClick={() => setIsFilterOpen((prev) => !prev)}
            >
              <FilterIcon />
              <span>Filter</span>
              <ChevronDownIcon />
              {activeFilterCount > 0 ? (
                <span className="discount-filter-badge">{activeFilterCount}</span>
              ) : null}
            </button>

            {isFilterOpen ? (
              <div className="discount-filter-dropdown">
                <div className="discount-filter-head">
                  <h4>Filter Discounts</h4>
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTypeFilter("all");
                        setStatusFilter("all");
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="discount-filter-section">
                  <h5>Discount Type</h5>
                  <label>
                    <input
                      type="radio"
                      checked={typeFilter === "all"}
                      onChange={() => setTypeFilter("all")}
                    />
                    <span>All Types</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={typeFilter === "marketplace_sales"}
                      onChange={() => setTypeFilter("marketplace_sales")}
                    />
                    <span>Marketplace sales</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={typeFilter === "recorded_sales"}
                      onChange={() => setTypeFilter("recorded_sales")}
                    />
                    <span>Recorded sales</span>
                  </label>
                </div>

                <div className="discount-filter-section">
                  <h5>Status</h5>
                  <label>
                    <input
                      type="radio"
                      checked={statusFilter === "all"}
                      onChange={() => setStatusFilter("all")}
                    />
                    <span>All Statuses</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={statusFilter === "active"}
                      onChange={() => setStatusFilter("active")}
                    />
                    <span>Active</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={statusFilter === "draft"}
                      onChange={() => setStatusFilter("draft")}
                    />
                    <span>Draft</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={statusFilter === "expired"}
                      onChange={() => setStatusFilter("expired")}
                    />
                    <span>Expired</span>
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <Link className="marketplace-primary-btn" to="/marketplace/discounts/create">
            + Create Discount
          </Link>

          <button
            type="button"
            className="marketplace-ghost-btn discount-refresh-btn"
            onClick={() => dispatch(fetchBulkDiscounts({ force: true }))}
            title="Refresh discounts"
            aria-label="Refresh discounts"
          >
            <span className="discount-refresh-icon" aria-hidden="true">
              ↻
            </span>
            <span className="discount-refresh-label">Refresh</span>
          </button>
        </div>
      </div>

      <div className="marketplace-panel marketplace-panel--bare">
        {discountsMeta?.isLoading && discounts.length === 0 ? (
          <div className="marketplace-empty">
            <h3>Loading discounts...</h3>
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="marketplace-empty">
            <h3>No discounts yet</h3>
            <p>Try adjusting search/filter or create a new discount.</p>
          </div>
        ) : (
          <div className="discounts-table-wrap" ref={actionRef}>
            <div className="discounts-table-toolbar">
              <p>
                {filteredDiscounts.length} discount{filteredDiscounts.length === 1 ? "" : "s"} found
              </p>
            </div>
            <table className="discounts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Expiry</th>
                  <th>Applied To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscounts.map((discount) => (
                  <tr key={discount._id}>
                    <td>{discount.discountName}</td>
                    <td>
                      {discount.discountType === "marketplace_sales"
                        ? "Marketplace sales"
                        : "Recorded sales"}
                    </td>
                    <td>{formatDiscountValue(discount)}</td>
                    <td>{moment(discount.expirationDate).format("DD MMM YYYY")}</td>
                    <td>{formatAppliedTo(discount)}</td>
                    <td>
                      <div className="discount-actions-cell">
                        <button
                          className="icon-btn"
                          title="View"
                          onClick={() =>
                            navigate(`/marketplace/discounts/${discount._id}`)
                          }
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M2 12C3.8 7.8 7.4 5 12 5C16.6 5 20.2 7.8 22 12C20.2 16.2 16.6 19 12 19C7.4 19 3.8 16.2 2 12Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        </button>

                        <button
                          className="icon-btn"
                          title="More"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const desiredLeft = rect.right - 150;
                            const boundedLeft = Math.max(
                              8,
                              Math.min(desiredLeft, window.innerWidth - 158),
                            );
                            setMenuPosition({
                              top: rect.bottom + 8,
                              left: boundedLeft,
                            });
                            setOpenMenuId((prev) =>
                              prev === discount._id ? null : discount._id,
                            );
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                            <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openMenuId
        ? createPortal(
            <div
              ref={menuRef}
              className="discount-action-menu discount-action-menu--portal"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <button
                onClick={() => {
                  navigate(`/marketplace/discounts/${openMenuId}`);
                  setOpenMenuId(null);
                }}
              >
                View
              </button>
              <button
                onClick={() => {
                  navigate(`/marketplace/discounts/${openMenuId}/edit`);
                  setOpenMenuId(null);
                }}
              >
                Edit
              </button>
              <button
                className="danger"
                onClick={() => {
                  handleDelete(openMenuId);
                  setOpenMenuId(null);
                }}
              >
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default MarketplaceDiscounts;
