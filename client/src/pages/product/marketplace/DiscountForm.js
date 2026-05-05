import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import "./Marketplace.scss";
import {
  createDiscount,
  getDiscount,
  updateDiscount,
} from "../../../redux/features/discount/discountSlice";
import { selectAllProductsArray } from "../../../redux/features/product/productCacheSlice";
import {
  addBulkCacheItem,
  selectProductGroupsArray,
  selectDiscountsArray,
} from "../../../redux/features/dataCache/bulkDataCacheSlice";
import { selectIsBootstrapped } from "../../../redux/features/dataCache/dataCacheSlice";

const toDateInputValue = (date) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  return `₦${numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const steps = ["Basic", "Schedule", "Products"];
const stepDescriptions = {
  Basic: "Set name, type, and value",
  Schedule: "Choose active period and description",
  Products: "Pick where this discount applies",
};

const GroupStateCheckbox = ({ state, onChange, disabled = false }) => {
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
      onChange={onChange}
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

const normalizeIdArray = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value?._id || value || ""))
        .filter(Boolean),
    ),
  );

const areIdArraysEqual = (first = [], second = []) => {
  if (first.length !== second.length) {
    return false;
  }

  const firstSet = new Set(first.map((value) => String(value)));
  if (firstSet.size !== second.length) {
    return false;
  }

  return second.every((value) => firstSet.has(String(value)));
};

const MarketplaceDiscountForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const products = useSelector(selectAllProductsArray);
  const productGroups = useSelector(selectProductGroupsArray);
  const discounts = useSelector(selectDiscountsArray);
  const isBootstrapped = useSelector(selectIsBootstrapped);
  const discountById = useSelector(
    (state) => state.bulkDataCache.discounts.byId?.[id],
  );

  const isEdit = Boolean(id);
  const existingDiscount = isEdit ? discountById || null : null;

  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingDiscount, setIsResolvingDiscount] = useState(false);
  const [activeProductsTab, setActiveProductsTab] = useState("single");
  const [singleSearchTerm, setSingleSearchTerm] = useState("");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [openGroupIds, setOpenGroupIds] = useState([]);
  const [hasHydratedLegacyGroupItems, setHasHydratedLegacyGroupItems] =
    useState(false);
  const [formData, setFormData] = useState({
    discountName: existingDiscount?.discountName || "",
    discountType: existingDiscount?.discountType || "marketplace_sales",
    discountAmount: existingDiscount?.discountAmount || "",
    discountValueType: existingDiscount?.discountValueType || "percentage",
    startDate: toDateInputValue(existingDiscount?.startDate),
    expirationDate: toDateInputValue(existingDiscount?.expirationDate),
    applyTo: existingDiscount?.applyTo || "single_product",
    groupSelection: existingDiscount?.groupSelection || "all_items",
    description: existingDiscount?.description || "",
    appliedProducts:
      existingDiscount?.appliedProducts?.map((item) => item?._id || item) || [],
    appliedProductGroups:
      existingDiscount?.appliedProductGroups?.map(
        (item) => item?._id || item,
      ) || [],
    appliedGroupItems:
      existingDiscount?.appliedGroupItems?.map((item) => item?._id || item) ||
      [],
  });

  useEffect(() => {
    if (!isEdit || !existingDiscount) return;
    setHasHydratedLegacyGroupItems(false);
    setFormData({
      discountName: existingDiscount.discountName || "",
      discountType: existingDiscount.discountType || "marketplace_sales",
      discountAmount: existingDiscount.discountAmount || "",
      discountValueType: existingDiscount.discountValueType || "percentage",
      startDate: toDateInputValue(existingDiscount.startDate),
      expirationDate: toDateInputValue(existingDiscount.expirationDate),
      applyTo: existingDiscount.applyTo || "single_product",
      groupSelection: existingDiscount.groupSelection || "all_items",
      description: existingDiscount.description || "",
      appliedProducts:
        existingDiscount.appliedProducts?.map((item) => item?._id || item) ||
        [],
      appliedProductGroups:
        existingDiscount.appliedProductGroups?.map(
          (item) => item?._id || item,
        ) || [],
      appliedGroupItems:
        existingDiscount.appliedGroupItems?.map((item) => item?._id || item) ||
        [],
    });
  }, [existingDiscount, isEdit]);

  useEffect(() => {
    if (searchParams.get("step") === "products") {
      setActiveStep(2);
    }
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const resolveDiscount = async () => {
      if (!isEdit || !id || existingDiscount || !isBootstrapped) return;

      try {
        setIsResolvingDiscount(true);
        const fetchedDiscount = await dispatch(getDiscount(id)).unwrap();
        if (isMounted && fetchedDiscount?._id) {
          dispatch(
            addBulkCacheItem({ dataType: "discounts", item: fetchedDiscount }),
          );
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
  }, [dispatch, existingDiscount, id, isBootstrapped, isEdit]);

  const groupedProductsMap = useMemo(() => {
    const map = new Map();

    products.forEach((product) => {
      if (!product?.productIsaGroup || !product?.itemGroup) {
        return;
      }

      const groupId = String(product.itemGroup);
      if (!map.has(groupId)) {
        map.set(groupId, []);
      }

      map.get(groupId).push(product);
    });

    return map;
  }, [products]);

  const standaloneProducts = useMemo(
    () => products.filter((product) => !product.productIsaGroup),
    [products],
  );

  const unavailableProductIdSet = useMemo(() => {
    const blocked = new Set();

    discounts.forEach((discount) => {
      if (!discount?._id) return;
      if (isEdit && String(discount._id) === String(id)) return;

      normalizeIdArray(discount.appliedProducts).forEach((productId) => {
        blocked.add(productId);
      });

      normalizeIdArray(discount.appliedGroupItems).forEach((productId) => {
        blocked.add(productId);
      });

      if (discount.groupSelection !== "selected_items") {
        const groupIdSet = new Set(normalizeIdArray(discount.appliedProductGroups));
        groupedProductsMap.forEach((groupItems, groupId) => {
          if (!groupIdSet.has(groupId)) return;
          groupItems.forEach((item) => blocked.add(String(item._id)));
        });
      }
    });

    return blocked;
  }, [discounts, groupedProductsMap, id, isEdit]);

  const filteredStandaloneProducts = useMemo(() => {
    const term = singleSearchTerm.trim().toLowerCase();
    if (!term) return standaloneProducts;
    return standaloneProducts.filter((product) => {
      const haystack =
        `${product?.name || ""} ${product?.sku || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [singleSearchTerm, standaloneProducts]);

  const availableStandaloneProducts = useMemo(
    () =>
      filteredStandaloneProducts.filter(
        (product) => !unavailableProductIdSet.has(String(product._id)),
      ),
    [filteredStandaloneProducts, unavailableProductIdSet],
  );

  const availableGroupItemsMap = useMemo(() => {
    const map = new Map();

    groupedProductsMap.forEach((groupItems, groupId) => {
      map.set(
        groupId,
        groupItems.filter(
          (item) => !unavailableProductIdSet.has(String(item._id)),
        ),
      );
    });

    return map;
  }, [groupedProductsMap, unavailableProductIdSet]);

  const filteredGroups = useMemo(() => {
    const term = groupSearchTerm.trim().toLowerCase();

    return productGroups.filter((group) => {
      const groupId = String(group?._id || "");
      const availableGroupItems = availableGroupItemsMap.get(groupId) || [];

      if (availableGroupItems.length === 0) {
        return false;
      }

      if (!term) {
        return true;
      }

      const groupNameMatch = String(group?.groupName || "")
        .toLowerCase()
        .includes(term);
      const itemMatch = availableGroupItems.some(
        (product) => {
          const haystack =
            `${product?.name || ""} ${product?.sku || ""}`.toLowerCase();
          return haystack.includes(term);
        },
      );
      return groupNameMatch || itemMatch;
    });
  }, [availableGroupItemsMap, groupSearchTerm, productGroups]);

  const appliedGroupItemIdSet = useMemo(
    () => new Set(formData.appliedGroupItems.map((value) => String(value))),
    [formData.appliedGroupItems],
  );

  const selectedGroupIds = useMemo(() => {
    const ids = [];
    groupedProductsMap.forEach((groupItems, groupId) => {
      const hasSelectedItem = groupItems.some((item) =>
        appliedGroupItemIdSet.has(String(item._id)),
      );

      if (hasSelectedItem) {
        ids.push(groupId);
      }
    });

    return ids;
  }, [appliedGroupItemIdSet, groupedProductsMap]);

  const deriveSelectedGroupsFromItemSet = (itemSet) => {
    const ids = [];
    groupedProductsMap.forEach((groupItems, groupId) => {
      const hasSelectedItem = groupItems.some((item) =>
        itemSet.has(String(item._id)),
      );

      if (hasSelectedItem) {
        ids.push(groupId);
      }
    });
    return ids;
  };

  useEffect(() => {
    setFormData((prev) => {
      const nextAppliedProducts = prev.appliedProducts.filter(
        (productId) => !unavailableProductIdSet.has(String(productId)),
      );

      const nextItemSet = new Set(
        prev.appliedGroupItems
          .map((value) => String(value))
          .filter((value) => !unavailableProductIdSet.has(value)),
      );

      const nextAppliedGroupItems = Array.from(nextItemSet);
      const nextAppliedProductGroups = deriveSelectedGroupsFromItemSet(nextItemSet);

      const hasChanged =
        !areIdArraysEqual(nextAppliedProducts, prev.appliedProducts) ||
        !areIdArraysEqual(nextAppliedGroupItems, prev.appliedGroupItems) ||
        !areIdArraysEqual(nextAppliedProductGroups, prev.appliedProductGroups);

      if (!hasChanged) {
        return prev;
      }

      return {
        ...prev,
        appliedProducts: nextAppliedProducts,
        appliedGroupItems: nextAppliedGroupItems,
        appliedProductGroups: nextAppliedProductGroups,
      };
    });
  }, [groupedProductsMap, unavailableProductIdSet]);

  const toggleGroupExpanded = (groupId) => {
    const normalizedGroupId = String(groupId);
    setOpenGroupIds((prev) =>
      prev.includes(normalizedGroupId)
        ? prev.filter((idValue) => idValue !== normalizedGroupId)
        : [...prev, normalizedGroupId],
    );
  };

  useEffect(() => {
    if (
      !isEdit ||
      hasHydratedLegacyGroupItems ||
      existingDiscount?.groupSelection !== "all_items" ||
      !Array.isArray(formData.appliedProductGroups) ||
      formData.appliedProductGroups.length === 0 ||
      formData.appliedGroupItems.length > 0
    ) {
      return;
    }

    const selectedGroupSet = new Set(
      formData.appliedProductGroups.map((value) => String(value)),
    );

    const nextItemIds = [];
    groupedProductsMap.forEach((groupItems, groupId) => {
      if (!selectedGroupSet.has(groupId)) {
        return;
      }

      groupItems.forEach((item) => {
        nextItemIds.push(String(item._id));
      });
    });

    if (nextItemIds.length > 0) {
      setFormData((prev) => ({
        ...prev,
        appliedGroupItems: nextItemIds,
      }));
    }

    setHasHydratedLegacyGroupItems(true);
  }, [
    existingDiscount?.groupSelection,
    formData.appliedGroupItems.length,
    formData.appliedProductGroups,
    groupedProductsMap,
    hasHydratedLegacyGroupItems,
    isEdit,
  ]);

  const hasSelectedSingleProducts = formData.appliedProducts.length > 0;
  const hasSelectedGroupProducts = selectedGroupIds.length > 0;

  const selectedCounts = useMemo(
    () => ({
      products: formData.appliedProducts.length,
      groups: selectedGroupIds.length,
      groupItems: formData.appliedGroupItems.length,
    }),
    [
      formData.appliedGroupItems.length,
      selectedGroupIds.length,
      formData.appliedProducts.length,
    ],
  );

  const toggleSelection = (field, value) => {
    if (field === "appliedProducts" && unavailableProductIdSet.has(String(value))) {
      return;
    }

    setFormData((prev) => {
      const current = new Set(prev[field]);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }

      return {
        ...prev,
        [field]: Array.from(current),
      };
    });
  };

  const toggleGroupSelection = (groupId, shouldSelectAll) => {
    const normalizedGroupId = String(groupId);

    setFormData((prev) => {
      const itemSet = new Set(
        prev.appliedGroupItems.map((value) => String(value)),
      );
      const groupItems = groupedProductsMap.get(normalizedGroupId) || [];

      if (shouldSelectAll) {
        groupItems.forEach((item) => {
          const itemId = String(item._id);
          if (!unavailableProductIdSet.has(itemId)) {
            itemSet.add(itemId);
          }
        });
      } else {
        groupItems.forEach((item) => itemSet.delete(String(item._id)));
      }

      return {
        ...prev,
        appliedProductGroups: deriveSelectedGroupsFromItemSet(itemSet),
        appliedGroupItems: Array.from(itemSet),
      };
    });
  };

  const toggleGroupItemSelection = (groupId, itemId) => {
    const normalizedGroupId = String(groupId);
    const normalizedItemId = String(itemId);

    if (unavailableProductIdSet.has(normalizedItemId)) {
      return;
    }

    setFormData((prev) => {
      const itemSet = new Set(
        prev.appliedGroupItems.map((value) => String(value)),
      );
      if (itemSet.has(normalizedItemId)) {
        itemSet.delete(normalizedItemId);
      } else {
        itemSet.add(normalizedItemId);
      }

      const selectedGroups = deriveSelectedGroupsFromItemSet(itemSet);

      if (
        !selectedGroups.includes(normalizedGroupId) &&
        itemSet.has(normalizedItemId)
      ) {
        selectedGroups.push(normalizedGroupId);
      }

      return {
        ...prev,
        appliedProductGroups: selectedGroups,
        appliedGroupItems: Array.from(itemSet),
      };
    });
  };

  const validateStep = (step) => {
    if (step === 0) {
      if (!formData.discountName.trim()) {
        toast.error("Discount name is required");
        return false;
      }

      if (
        formData.discountAmount === "" ||
        Number(formData.discountAmount) < 0 ||
        (formData.discountValueType === "percentage" &&
          Number(formData.discountAmount) > 100)
      ) {
        toast.error("Enter a valid discount value");
        return false;
      }
    }

    if (step === 1) {
      if (!formData.startDate || !formData.expirationDate) {
        toast.error("Start and expiration dates are required");
        return false;
      }

      if (new Date(formData.startDate) > new Date(formData.expirationDate)) {
        toast.error("Start date must be before expiration date");
        return false;
      }
    }

    if (step === 2) {
      if (!hasSelectedSingleProducts && !hasSelectedGroupProducts) {
        toast.error("Select at least one product or group");
        return false;
      }
    }

    return true;
  };

  const nextStep = () => {
    if (!validateStep(activeStep)) return;
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateStep(2)) return;

    const hasSingleProducts = formData.appliedProducts.length > 0;
    const hasGroupProducts = selectedGroupIds.length > 0;

    const applyTo =
      hasSingleProducts && hasGroupProducts
        ? "both"
        : hasSingleProducts
          ? "single_product"
          : "group_product";

    const selectedGroupSet = new Set(selectedGroupIds);

    const allSelectedGroupItemIds = new Set(
      products
        .filter(
          (product) =>
            product?.productIsaGroup &&
            product?.itemGroup &&
            selectedGroupSet.has(String(product.itemGroup)),
        )
        .map((product) => String(product._id)),
    );

    const selectedGroupItemIds = Array.from(
      new Set(
        formData.appliedGroupItems
          .map((value) => String(value))
          .filter((value) => allSelectedGroupItemIds.has(value)),
      ),
    );

    const groupSelection =
      hasGroupProducts &&
      selectedGroupItemIds.length > 0 &&
      selectedGroupItemIds.length < allSelectedGroupItemIds.size
        ? "selected_items"
        : "all_items";

    const payload = {
      discountName: formData.discountName.trim(),
      discountType: formData.discountType,
      discountAmount: Number(formData.discountAmount),
      discountValueType: formData.discountValueType,
      startDate: formData.startDate,
      expirationDate: formData.expirationDate,
      applyTo,
      description: formData.description.trim(),
      appliedProducts: hasSingleProducts ? formData.appliedProducts : [],
      appliedProductGroups: hasGroupProducts ? selectedGroupIds : [],
      groupSelection: hasGroupProducts ? groupSelection : "all_items",
      appliedGroupItems:
        hasGroupProducts && groupSelection === "selected_items"
          ? selectedGroupItemIds
          : [],
    };

    try {
      setIsSubmitting(true);

      const request = isEdit
        ? dispatch(updateDiscount({ id, discountData: payload })).unwrap()
        : dispatch(createDiscount(payload)).unwrap();

      await toast.promise(request, {
        loading: isEdit ? "Updating discount..." : "Creating discount...",
        success: isEdit
          ? "Discount updated successfully"
          : "Discount created successfully",
        error: (error) =>
          typeof error === "string" ? error : "Failed to save discount",
      });

      navigate(
        isEdit ? `/marketplace/discounts/${id}` : "/marketplace/discounts",
      );
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && !existingDiscount && (isResolvingDiscount || !isBootstrapped)) {
    return (
      <div className="marketplace-page marketplace-page--discount">
        <div className="marketplace-panel">
          <div className="marketplace-empty">
            <h3>Loading discount...</h3>
            <p>Please wait while we load this discount for editing.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isEdit && !existingDiscount && isBootstrapped && !isResolvingDiscount) {
    return (
      <div className="marketplace-page marketplace-page--discount">
        <div className="marketplace-panel">
          <div className="marketplace-empty">
            <h3>Discount not found</h3>
            <p>This discount may have been deleted or is unavailable.</p>
            <Link
              to="/marketplace/discounts"
              className="marketplace-primary-btn"
            >
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
        <title>
          {isEdit ? "Edit Marketplace Discount" : "Create Marketplace Discount"}{" "}
          | Sell Square
        </title>
      </Helmet>

      <div className="marketplace-header marketplace-header--with-action">
        <div>
          <h1>{isEdit ? "Edit Discount" : "Create Discount"}</h1>
          <p>Set up promotions in simple guided steps.</p>
        </div>
        <div className="marketplace-header-actions">
          <Link
            to="/marketplace/discounts"
            className="marketplace-ghost-btn discount-back-icon-btn"
            aria-label="Back to discounts"
            title="Back"
          >
            ←
          </Link>
        </div>
      </div>

      <div className="marketplace-panel discount-wizard-panel discount-form-shell">
        <div
          className="discount-stepper"
          role="tablist"
          aria-label="Discount steps"
        >
          {steps.map((step, index) => (
            <div
              key={step}
              className={`discount-step ${index === activeStep ? "is-active" : ""} ${
                index < activeStep ? "is-done" : ""
              }`}
            >
              <span>{index + 1}</span>
              <div>
                <p>{step}</p>
                <small>{stepDescriptions[step]}</small>
              </div>
            </div>
          ))}
        </div>

        <form className="discount-form" onSubmit={handleSubmit}>
          {activeStep === 0 ? (
            <div className="discount-step-content discount-section-card">
              <label>
                Discount Name
                <input
                  required
                  value={formData.discountName}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      discountName: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="discount-form-grid">
                <label>
                  Discount Type
                  <select
                    value={formData.discountType}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        discountType: event.target.value,
                      }))
                    }
                  >
                    <option value="marketplace_sales">Marketplace sales</option>
                    <option value="recorded_sales">Recorded sales</option>
                  </select>
                </label>

                <label>
                  Value Type
                  <select
                    value={formData.discountValueType}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        discountValueType: event.target.value,
                      }))
                    }
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="amount">Amount (₦)</option>
                  </select>
                </label>

                <label>
                  {formData.discountValueType === "percentage"
                    ? "Discount Percentage"
                    : "Discount Amount"}
                  <input
                    required
                    min="0"
                    max={
                      formData.discountValueType === "percentage"
                        ? "100"
                        : undefined
                    }
                    type="number"
                    value={formData.discountAmount}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        discountAmount: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <p className="discount-helper-text">
                Percentage discounts must be between 0 and 100.
              </p>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="discount-step-content discount-section-card">
              <div className="discount-form-grid">
                <label>
                  Start Date
                  <input
                    required
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Expiration Date
                  <input
                    required
                    type="datetime-local"
                    value={formData.expirationDate}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        expirationDate: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label>
                Description (optional)
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <p className="discount-helper-text">
                This description is optional and can help your team understand
                the promotion goal.
              </p>
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="discount-step-content discount-section-card">
              <h4 className="discount-products-title">Products</h4>

              <div className="discount-target-tabs">
                <div
                  className="discount-target-tabs-head"
                  role="tablist"
                  aria-label="Discount product targets"
                >
                  <div className="discount-target-tab-buttons">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeProductsTab === "single"}
                      className={`discount-target-tab ${activeProductsTab === "single" ? "is-active" : ""}`}
                      onClick={() => setActiveProductsTab("single")}
                    >
                      Single ({selectedCounts.products})
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeProductsTab === "group"}
                      className={`discount-target-tab ${activeProductsTab === "group" ? "is-active" : ""}`}
                      onClick={() => setActiveProductsTab("group")}
                    >
                      Group ({selectedCounts.groups})
                    </button>
                  </div>
                </div>

                <div className="discount-target-panel">
                  {activeProductsTab === "single" ? (
                    <div className="selection-box">
                      <input
                        type="search"
                        className="selection-search"
                        placeholder="Search products by name or SKU"
                        value={singleSearchTerm}
                        onChange={(event) =>
                          setSingleSearchTerm(event.target.value)
                        }
                      />
                      {availableStandaloneProducts.map((product) => (
                        <label
                          key={product._id}
                          className="selection-item"
                        >
                          <input
                            type="checkbox"
                            checked={formData.appliedProducts.includes(
                              product._id,
                            )}
                            onChange={() =>
                              toggleSelection("appliedProducts", product._id)
                            }
                          />
                          <span className="discount-selection-copy">
                            <span>{product.name}</span>
                            <span className="discount-price-meta">
                              {formatCurrency(product?.price)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {activeProductsTab === "group" ? (
                    <div className="selection-box">
                      <div className="group-toolbar">
                        <input
                          type="search"
                          className="selection-search"
                          placeholder="Search groups or items"
                          value={groupSearchTerm}
                          onChange={(event) =>
                            setGroupSearchTerm(event.target.value)
                          }
                        />
                      </div>

                      <div className="group-selection-list">
                        {filteredGroups.map((group) => {
                          const groupId = String(group._id);
                          const groupItems =
                            availableGroupItemsMap.get(groupId) || [];
                          const searchTerm = groupSearchTerm
                            .trim()
                            .toLowerCase();
                          const nestedItems = groupItems.filter((product) => {
                            if (!searchTerm) return true;
                            const haystack =
                              `${product?.name || ""} ${product?.sku || ""}`.toLowerCase();
                            return haystack.includes(searchTerm);
                          });

                          const selectedCount = groupItems.filter((product) =>
                            appliedGroupItemIdSet.has(String(product._id)),
                          ).length;

                          const selectableGroupItemCount = groupItems.length;

                          const selectionState =
                            selectableGroupItemCount === 0 || selectedCount === 0
                              ? "none"
                              : selectedCount < selectableGroupItemCount
                                ? "partial"
                                : "full";

                          const isExpanded = openGroupIds.includes(groupId);

                          return (
                            <div className="group-dropdown-card" key={groupId}>
                              <div className="group-dropdown-head">
                                <GroupStateCheckbox
                                  state={selectionState}
                                  disabled={selectableGroupItemCount === 0}
                                  onChange={(event) =>
                                    toggleGroupSelection(
                                      groupId,
                                      event.target.checked,
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className="group-dropdown-trigger"
                                  onClick={() => toggleGroupExpanded(groupId)}
                                >
                                  <span className="group-dropdown-title-wrap">
                                    <span className="group-dropdown-title">
                                      {group.groupName}
                                    </span>
                                    <span className="group-dropdown-meta">
                                      {selectedCount}/{selectableGroupItemCount} selected
                                    </span>
                                  </span>
                                  <GroupChevronIcon isOpen={isExpanded} />
                                </button>
                              </div>

                              {isExpanded ? (
                                <div className="group-dropdown-body">
                                  {nestedItems.length ? (
                                    nestedItems.map((product) => (
                                      <label
                                        key={product._id}
                                        className="selection-item selection-item--nested"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={appliedGroupItemIdSet.has(
                                            String(product._id),
                                          )}
                                          onChange={() =>
                                            toggleGroupItemSelection(
                                              groupId,
                                              product._id,
                                            )
                                          }
                                        />
                                        <span className="discount-selection-copy">
                                          <span>{product.name}</span>
                                          <span className="discount-price-meta">
                                            {formatCurrency(product?.price)}
                                          </span>
                                        </span>
                                      </label>
                                    ))
                                  ) : (
                                    <p className="group-dropdown-empty">
                                      No items match this search.
                                    </p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        {filteredGroups.length === 0 ? (
                          <p className="group-dropdown-empty">
                            No eligible groups are available.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="discount-form-actions">
            <Link to="/marketplace/discounts" className="marketplace-ghost-btn">
              Cancel
            </Link>

            {activeStep > 0 ? (
              <button
                type="button"
                className="marketplace-ghost-btn"
                onClick={() => setActiveStep((prev) => Math.max(prev - 1, 0))}
              >
                Back
              </button>
            ) : null}

            {activeStep < steps.length - 1 ? (
              <button
                className="marketplace-primary-btn"
                type="button"
                onClick={nextStep}
              >
                Next
              </button>
            ) : (
              <button
                className="marketplace-primary-btn"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Save Changes"
                    : "Create Discount"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarketplaceDiscountForm;
