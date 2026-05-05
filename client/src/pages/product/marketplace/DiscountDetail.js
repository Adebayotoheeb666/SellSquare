import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import "./Marketplace.scss";
import { getDiscount } from "../../../redux/features/discount/discountSlice";
import {
  addBulkCacheItem,
  selectProductGroupsArray,
} from "../../../redux/features/dataCache/bulkDataCacheSlice";
import { selectIsBootstrapped } from "../../../redux/features/dataCache/dataCacheSlice";
import { selectAllProductsArray } from "../../../redux/features/product/productCacheSlice";

const getLabel = (value) => {
  if (value === "marketplace_sales") return "Marketplace sales";
  if (value === "recorded_sales") return "Recorded sales";
  if (value === "single_product") return "Single product";
  if (value === "group_product") return "Group product";
  if (value === "both") return "Single + Group products";
  if (value === "all_items") return "All items in selected groups";
  if (value === "selected_items") return "Selected items in groups";
  return value || "N/A";
};

const toEntityId = (item) => {
  if (!item) return null;
  if (typeof item === "string") return item;
  return item._id ? String(item._id) : null;
};

const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  return `₦${numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const getPriceBreakdown = (price, discountAmount, discountValueType) => {
  const originalPrice = Number(price || 0);
  const amount = Math.max(Number(discountAmount || 0), 0);

  if (originalPrice <= 0) {
    return {
      originalPrice: 0,
      newPrice: 0,
      discountAmountApplied: 0,
      percentOff: 0,
    };
  }

  if (discountValueType === "percentage") {
    const clampedPercent = Math.min(Math.max(amount, 0), 100);
    const discountApplied = (originalPrice * clampedPercent) / 100;

    return {
      originalPrice,
      newPrice: Math.max(originalPrice - discountApplied, 0),
      discountAmountApplied: discountApplied,
      percentOff: clampedPercent,
    };
  }

  const discountApplied = Math.min(amount, originalPrice);
  const percentOff = originalPrice > 0 ? (discountApplied / originalPrice) * 100 : 0;

  return {
    originalPrice,
    newPrice: Math.max(originalPrice - discountApplied, 0),
    discountAmountApplied: discountApplied,
    percentOff,
  };
};

const GroupStateCheckbox = ({ state, disabled = true }) => {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = state === "partial";
    }
  }, [state]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      className="group-state-checkbox"
      checked={state === "full"}
      readOnly
      disabled={disabled}
    />
  );
};

const GroupChevronIcon = ({ isOpen }) => (
  <svg
    className={`group-chevron ${isOpen ? "is-open" : ""}`}
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

const MarketplaceDiscountDetail = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const discount = useSelector((state) => state.bulkDataCache.discounts.byId?.[id]);
  const products = useSelector(selectAllProductsArray);
  const productGroups = useSelector(selectProductGroupsArray);
  const isBootstrapped = useSelector(selectIsBootstrapped);
  const [isResolvingDiscount, setIsResolvingDiscount] = useState(false);
  const [activeProductsTab, setActiveProductsTab] = useState("single");
  const [expandedGroupIds, setExpandedGroupIds] = useState([]);

  const hasSingleProducts =
    discount?.applyTo === "single_product" || discount?.applyTo === "both";
  const hasGroupProducts =
    discount?.applyTo === "group_product" || discount?.applyTo === "both";

  useEffect(() => {
    if (!discount?.applyTo) return;

    if (hasSingleProducts) {
      setActiveProductsTab("single");
      return;
    }

    if (hasGroupProducts) {
      setActiveProductsTab("group");
    }
  }, [discount?.applyTo, hasGroupProducts, hasSingleProducts]);

  useEffect(() => {
    let isMounted = true;

    const resolveDiscount = async () => {
      if (!id || discount || !isBootstrapped) return;

      try {
        setIsResolvingDiscount(true);
        const fetchedDiscount = await dispatch(getDiscount(id)).unwrap();
        if (isMounted && fetchedDiscount?._id) {
          dispatch(addBulkCacheItem({ dataType: "discounts", item: fetchedDiscount }));
        }
      } catch (error) {
      } finally {
        if (isMounted) {
          setIsResolvingDiscount(false);
        }
      }
    };

    resolveDiscount();

    return () => {
      isMounted = false;
    };
  }, [dispatch, discount, id, isBootstrapped]);

  const discountValue = useMemo(() => {
    const amount = Number(discount?.discountAmount || 0);
    return discount?.discountValueType === "percentage"
      ? `${amount}%`
      : `₦${amount.toLocaleString()}`;
  }, [discount]);

  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      if (!product?._id) return;
      map.set(String(product._id), product);
    });
    return map;
  }, [products]);

  const groupMap = useMemo(() => {
    const map = new Map();
    productGroups.forEach((group) => {
      if (!group?._id) return;
      map.set(String(group._id), group);
    });
    return map;
  }, [productGroups]);

  const productsByGroup = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      if (!product?.productIsaGroup || !product?.itemGroup) return;
      const groupId = String(product.itemGroup);
      if (!map.has(groupId)) {
        map.set(groupId, []);
      }
      map.get(groupId).push(product);
    });
    return map;
  }, [products]);

  const appliedProductIds = useMemo(
    () => (Array.isArray(discount?.appliedProducts) ? discount.appliedProducts : [])
      .map(toEntityId)
      .filter(Boolean),
    [discount?.appliedProducts],
  );

  const appliedGroupIds = useMemo(
    () => (Array.isArray(discount?.appliedProductGroups) ? discount.appliedProductGroups : [])
      .map(toEntityId)
      .filter(Boolean),
    [discount?.appliedProductGroups],
  );

  const appliedGroupItemIds = useMemo(
    () => (Array.isArray(discount?.appliedGroupItems) ? discount.appliedGroupItems : [])
      .map(toEntityId)
      .filter(Boolean),
    [discount?.appliedGroupItems],
  );

  const appliedProducts = useMemo(
    () => appliedProductIds.map((productId) => {
      const fromMap = productMap.get(productId);
      if (fromMap) {
        return {
          id: productId,
          name: fromMap.name || fromMap.sku || productId,
          price: Number(fromMap.price || 0),
        };
      }

      const embedded = (discount?.appliedProducts || []).find(
        (item) => String(item?._id) === productId,
      );

      return {
        id: productId,
        name: embedded?.name || embedded?.sku || productId,
        price: Number(embedded?.price || 0),
      };
    }),
    [appliedProductIds, discount?.appliedProducts, productMap],
  );

  const groupSelections = useMemo(
    () => appliedGroupIds.map((groupId) => {
      const group = groupMap.get(groupId);
      const groupName = group?.groupName || groupId;
      const groupItems = productsByGroup.get(groupId) || [];

      const selectedItems = groupItems.filter((item) =>
        appliedGroupItemIds.includes(String(item._id)),
      );

      const allItemsSelected =
        groupItems.length > 0 && selectedItems.length === groupItems.length;

      const isFull = discount?.groupSelection !== "selected_items"
        ? groupItems.length > 0
        : allItemsSelected;

      const isPartial = discount?.groupSelection === "selected_items"
        ? selectedItems.length > 0 && !isFull
        : false;

      return {
        id: groupId,
        name: groupName,
        items: discount?.groupSelection === "selected_items" ? selectedItems : groupItems,
        totalItems: groupItems.length,
        selectedCount: selectedItems.length,
        state: isFull ? "full" : isPartial ? "partial" : "none",
      };
    }),
    [
      appliedGroupIds,
      appliedGroupItemIds,
      discount?.groupSelection,
      groupMap,
      productsByGroup,
    ],
  );

  const toggleGroupExpanded = (groupId) => {
    const normalizedGroupId = String(groupId);
    setExpandedGroupIds((prev) =>
      prev.includes(normalizedGroupId)
        ? prev.filter((value) => value !== normalizedGroupId)
        : [...prev, normalizedGroupId],
    );
  };

  const renderPricePreview = (price) => {
    const numericPrice = Number(price || 0);
    if (numericPrice <= 0) return null;

    const breakdown = getPriceBreakdown(
      numericPrice,
      discount?.discountAmount,
      discount?.discountValueType,
    );

    return (
      <span className="discount-price-meta">
        <span className="discount-old-price">
          {formatCurrency(breakdown.originalPrice)}
        </span>{" "}
        <span>&nbsp;&nbsp;&nbsp;</span>
        
        <span className="discount-new-price">
          {formatCurrency(breakdown.newPrice)}
        </span>{""}
        <span>&nbsp;&nbsp;&nbsp;</span>
        <span className="discount-off-chip">
          {`${breakdown.percentOff.toFixed(
            breakdown.percentOff % 1 === 0 ? 0 : 1,
          )}% off`}
        </span>{" "}
      </span>
    );
  };

  if (!discount && (isResolvingDiscount || !isBootstrapped)) {
    return (
      <div className="marketplace-page marketplace-page--discount">
        <div className="marketplace-panel">
          <div className="marketplace-empty">
            <h3>Loading discount...</h3>
            <p>Please wait while we load this discount.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!discount) {
    return (
      <div className="marketplace-page marketplace-page--discount">
        <div className="marketplace-panel">
          <div className="marketplace-empty">
            <h3>Discount not found</h3>
            <p>This discount may have been deleted or not loaded yet.</p>
            <Link className="marketplace-primary-btn" to="/marketplace/discounts">
              Back to Discounts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-page marketplace-page--discount">
      <Helmet>
        <title>{discount.discountName} | Marketplace Discount</title>
      </Helmet>

      <div className="marketplace-header marketplace-header--with-action">
        <div>
          <h1>{discount.discountName}</h1>
          <p>Review discount configuration and targeted products.</p>
        </div>
        <div className="marketplace-header-actions">
          <Link className="marketplace-ghost-btn" to="/marketplace/discounts">
            Back
          </Link>
          <Link
            className="marketplace-primary-btn"
            to={`/marketplace/discounts/${discount._id}/edit`}
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="marketplace-panel discount-detail-shell">
        <div className="discount-overview">
          <div className="discount-overview-main">
            <h2>{discountValue}</h2>
            <p>
              {getLabel(discount.discountType)} • {getLabel(discount.applyTo)}
            </p>
          </div>
          <span className={`discount-pill ${discount.status || "draft"}`}>
            {discount.status || "draft"}
          </span>
        </div>

        <div className="discount-detail-grid discount-detail-grid--compact">
          <div className="discount-stat-card">
            <h4>Discount Type</h4>
            <p>{getLabel(discount.discountType)}</p>
          </div>
          <div className="discount-stat-card">
            <h4>Discount Value</h4>
            <p>{discountValue}</p>
          </div>
          <div className="discount-stat-card">
            <h4>Start Date</h4>
            <p>{moment(discount.startDate).format("DD MMM YYYY, h:mm A")}</p>
          </div>
          <div className="discount-stat-card">
            <h4>Expiration Date</h4>
            <p>{moment(discount.expirationDate).format("DD MMM YYYY, h:mm A")}</p>
          </div>
          <div className="discount-stat-card">
            <h4>Apply To</h4>
            <p>{getLabel(discount.applyTo)}</p>
          </div>
        </div>

        <div className="discount-target-tabs">
          <div className="discount-target-tabs-head" role="tablist" aria-label="Discount product targets">
            <div className="discount-target-tab-buttons">
              {hasSingleProducts ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeProductsTab === "single"}
                  className={`discount-target-tab ${activeProductsTab === "single" ? "is-active" : ""}`}
                  onClick={() => setActiveProductsTab("single")}
                >
                  Single ({appliedProducts.length})
                </button>
              ) : null}

              {hasGroupProducts ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeProductsTab === "group"}
                  className={`discount-target-tab ${activeProductsTab === "group" ? "is-active" : ""}`}
                  onClick={() => setActiveProductsTab("group")}
                >
                  Group ({groupSelections.length})
                </button>
              ) : null}
            </div>

            <Link
              to={`/marketplace/discounts/${discount._id}/edit?step=products`}
              className="discount-target-add"
              aria-label="Add products to discount"
              title="Add products"
            >
              +
            </Link>
          </div>

          <div className="discount-target-panel">
            {activeProductsTab === "single" && hasSingleProducts ? (
              <div className="discount-target-card discount-target-card--flat">
                {appliedProducts.length ? (
                  <ul>
                    {appliedProducts.map((product) => (
                      <li key={product.id} className="discount-selection-row">
                        <input type="checkbox" checked readOnly disabled />
                        <span className="discount-selection-copy">
                          <span>{product.name}</span>
                          {renderPricePreview(product.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No single products selected.</p>
                )}
              </div>
            ) : null}

            {activeProductsTab === "group" && hasGroupProducts ? (
              <div className="discount-target-card discount-target-card--flat">
                {groupSelections.length ? (
                  <div className="discount-group-dropdown-list">
                    {groupSelections.map((group) => {
                      const isOpen = expandedGroupIds.includes(String(group.id));
                      return (
                        <div key={group.id} className="discount-group-dropdown-item">
                          <div className="group-dropdown-head">
                            <GroupStateCheckbox state={group.state} />
                            <button
                              type="button"
                              className="group-dropdown-trigger"
                              onClick={() => toggleGroupExpanded(group.id)}
                            >
                              <span className="group-dropdown-title-wrap">
                                <span className="group-dropdown-title">{group.name}</span>
                                <span className="group-dropdown-meta">
                                  {group.selectedCount}/{group.totalItems} selected
                                </span>
                              </span>
                              <GroupChevronIcon isOpen={isOpen} />
                            </button>
                          </div>

                          {isOpen ? (
                            <div className="discount-group-dropdown-body">
                              {group.items.length ? (
                                <ul>
                                  {group.items.map((item) => (
                                    <li key={item._id} className="discount-selection-row">
                                      <input type="checkbox" checked readOnly disabled />
                                      <span className="discount-selection-copy">
                                        <span>{item.name || item.sku || item._id}</span>
                                        {renderPricePreview(item?.price)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p>No items available in this group.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {discount.description ? (
          <div className="discount-description">
            <h4>Description</h4>
            <p>{discount.description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MarketplaceDiscountDetail;
