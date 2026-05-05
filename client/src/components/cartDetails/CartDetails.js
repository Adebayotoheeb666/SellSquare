import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  CALC_CART_SUB_TOTAL,
  INCREASE_CART_ITEM,
  DECREASE_CART_ITEM,
  REMOVE_CART_ITEM,
  deleteCartItem,
  getCart,
  checkoutCart,
  selectCartSubTotal,
  increaseCartItems,
  decreaseCartItems,
  GET_CART,
  CALC_CART_ITEMS,
  SET_CART_QUANTITY,
  setNewPrice,
  SET_CART_PRICE,
} from "../../redux/features/cart/cartSlice";
import Loader from "../loader/Loader";
import { confirmAlert } from "react-confirm-alert";
import { Tooltip } from "antd";
import deleteIcon from "../../assets/home/delete-icon.svg";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import "./cartDetail.css";
import {
  selectLoggedInBusinessOwner,
  selectUser,
} from "../../redux/features/auth/authSlice";
import usePaymentUpdate from "../../customHook/usePaymentUpdate";
import { useAsyncToast } from "../../customHook/useAsyncToast";
import ExpiredSubscription from "../paymentUpdates/UpdatePayment";
import {
  fetchBulkCustomers,
  selectCustomersArray,
  selectCustomersMeta,
  selectProductGroupsArray,
} from "../../redux/features/dataCache/bulkDataCacheSlice";
import { selectProductsById } from "../../redux/features/product/productCacheSlice";
import { getPrimaryImagePath } from "../../utils/productImageUtils";
import ImagePreviewModal from "../imagePreview/ImagePreviewModal";

const initialState = { name: "", phone: "", email: "" };

export default function CartDetails({ isLoading, cart, user }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cartSubTotal = useSelector(selectCartSubTotal);
  const [customerInfo, setCustomerInfo] = useState(initialState);
  const admin = useSelector(selectLoggedInBusinessOwner);
  const currentUser = useSelector(selectUser);
  const [productQuantity, setProductQuantity] = useState();
  const [deliveryStatus, setDeliveryStatus] = useState("pending");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debounceTimer = useRef(null);
  const { executeWithToast } = useAsyncToast();
  const [editingPrices, setEditingPrices] = useState({});
  const customers = useSelector(selectCustomersArray);
  const customersMeta = useSelector(selectCustomersMeta);
  const productsById = useSelector(selectProductsById);
  const productGroups = useSelector(selectProductGroupsArray);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [previewImagePath, setPreviewImagePath] = useState(null);

  const { isInGracePeriod, isSubscriptionExpired } = usePaymentUpdate({
    currentUser: currentUser,
  });

  const productGroupsById = useMemo(() => {
    return productGroups.reduce((acc, group) => {
      if (group?._id) {
        acc[String(group._id)] = group;
      }
      return acc;
    }, {});
  }, [productGroups]);

  // Payment state
  const [paymentTypes, setPaymentTypes] = useState([]); // supports combos: cash, transfer, pos
  const [isPartPayment, setIsPartPayment] = useState(false);
  const [partPaymentDetails, setPartPaymentDetails] = useState({
    amountPaid: "",
    balance: cartSubTotal,
    paymentParts: [
      {
        amountPaid: "",
        datePaid: new Date().toISOString(),
      },
    ],
  });
  const [paymentAmounts, setPaymentAmounts] = useState({});

  const handleCustomerInfo = (e) => {
    const { name, value } = e.target;
    setCustomerInfo({ ...customerInfo, [name]: value });

    if (name === "name" && value) {
      fetchSuggestions(value);
    } else {
      setSuggestions([]);
    }
  };

  const fetchSuggestions = (name) => {
    if (!name || !name.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const query = name.toLowerCase();
    const suggestions = customers.filter((suggestion) => {
      return suggestion?.name?.toLowerCase().includes(query);
    });
    setSuggestions(suggestions);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion) => {
    setCustomerInfo(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleNameBlur = () => {
    // Delay hiding to allow click events on suggestions to fire first
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  useEffect(() => {
    dispatch(CALC_CART_SUB_TOTAL(cart));
  }, [dispatch, cart]);

  // Ensure customers are bulk-loaded for local suggestions
  useEffect(() => {
    const hasCustomersDataset =
      Boolean(customersMeta?.lastFetchedAt) ||
      Boolean(customersMeta?.isComplete) ||
      customers.length > 0;

    if (!customersMeta?.isLoading && !hasCustomersDataset) {
      dispatch(fetchBulkCustomers());
    }
  }, [
    dispatch,
    customersMeta?.isLoading,
    customersMeta?.lastFetchedAt,
    customersMeta?.isComplete,
    customers.length,
  ]);

  const pendingIncreaseRef = useRef(null);

  const handleIncreament = async (id, cartId, q, maxQuantity) => {
    // Prevent duplicate increase requests
    if (pendingIncreaseRef.current === cartId) {
      return;
    }

    pendingIncreaseRef.current = cartId;

    try {
      const quantity = Number(q) + 1;
      let cartItem = cart?.items.find((item) => item._id === cartId);
      if (!cartItem) return;

      // update cartItem.quantity with quantity before dispatching INCREASE_CART_ITEM
      cartItem = { ...cartItem, quantity };

      // Optimistic update only (no server call during optimistic phase)
      dispatch(INCREASE_CART_ITEM(cartItem));

      // Server call - realtime event will sync if there's a discrepancy
      await dispatch(
        increaseCartItems({ id, cartId, quantity, email: user.email }),
      );
    } finally {
      pendingIncreaseRef.current = null;
    }
  };

  const debounce = useCallback((fn, delay) => {
    return (...args) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        fn(...args);
      }, delay);
    };
  }, []);

  // Handler to update quantity with debounce - prevent duplicate requests
  const pendingQuantityUpdateRef = useRef(null);

  const handleChangeQuantity = useCallback(
    debounce(async (e, id, cartId) => {
      // Prevent duplicate quantity updates for same item
      if (pendingQuantityUpdateRef.current === `${cartId}`) {
        return;
      }

      pendingQuantityUpdateRef.current = `${cartId}`;

      try {
        const raw = e.target.innerText.replace(/\D/g, "");
        const quantity = Math.max(1, Number(raw) || 1);
        let cartItem = cart?.items.find((item) => item._id === cartId);
        if (!cartItem) return;

        cartItem = { ...cartItem, quantity };
        setProductQuantity(quantity);
        dispatch(SET_CART_QUANTITY(cartItem));
        await dispatch(
          increaseCartItems({
            id,
            cartId,
            quantity,
            email: user.email,
          }),
        );
      } finally {
        pendingQuantityUpdateRef.current = null;
      }
    }, 1000),
    [cart, dispatch, user.email],
  );

  const handlePriceInput = (e, id, cartId) => {
    const priceStr = e.currentTarget.innerText.replace(/[^0-9.]/g, "");
    const newPrice = Number(priceStr) || 0;
    setEditingPrices((prev) => ({ ...prev, [cartId]: newPrice }));

    // Recalculate subtotal immediately without mutating the store cart items
    if (cart?.items) {
      const tempCart = {
        ...cart,
        items: cart.items.map((it) =>
          it._id === cartId ? { ...it, price: newPrice } : it,
        ),
      };
      dispatch(CALC_CART_SUB_TOTAL(tempCart));
    }
  };

  // Prevent duplicate price updates
  const pendingPriceUpdateRef = useRef(null);

  const handlePriceBlur = useCallback(
    debounce(async (e, id, cartId) => {
      // Prevent duplicate price updates for same item
      if (pendingPriceUpdateRef.current === `${cartId}`) {
        return;
      }

      pendingPriceUpdateRef.current = `${cartId}`;

      try {
        const priceStr = e.target.innerText.replace(/[^0-9.]/g, "");
        const price = Number(priceStr) || 0;

        let cartItem = cart?.items.find((item) => item._id === cartId);
        if (!cartItem) return;
        cartItem = { ...cartItem, price };

        // Commit to Redux immediately (optimistic)
        dispatch(SET_CART_PRICE(cartItem));

        // Fire backend update (debounced) - realtime event will confirm
        await dispatch(setNewPrice({ id, cartId, price, email: user.email }));

        // Clear transient editing state
        setEditingPrices((prev) => {
          const copy = { ...prev };
          delete copy[cartId];
          return copy;
        });
      } finally {
        pendingPriceUpdateRef.current = null;
      }
    }, 400),
    [cart, dispatch, user.email],
  );

  const pendingDecreaseRef = useRef(null);

  const handleDecreament = async (id, cartId, q) => {
    // Prevent duplicate decrease requests
    if (pendingDecreaseRef.current === cartId) {
      return;
    }

    pendingDecreaseRef.current = cartId;

    try {
      const quantity = Math.max(1, Number(q) - 1);
      let cartItem = cart.items.find((item) => item._id === cartId);
      if (!cartItem) return;

      // update cartItem.quantity with quantity before dispatching DECREASE_CART_ITEM
      cartItem = { ...cartItem, quantity };

      // Optimistic update only
      dispatch(DECREASE_CART_ITEM(cartItem));

      // Server call - realtime event will sync
      await dispatch(
        decreaseCartItems({ id, cartId, quantity, email: user.email }),
      );
    } finally {
      pendingDecreaseRef.current = null;
    }
  };

  const pendingDeleteRef = useRef(null);

  const handleDelete = (item) => {
    confirmAlert({
      title: "Remove this item",
      message: "Are you sure you want to remove this item?.",
      buttons: [
        {
          label: "Remove",
          onClick: async () => {
            // Prevent duplicate deletes
            if (pendingDeleteRef.current === item._id) {
              return;
            }

            pendingDeleteRef.current = item._id;

            try {
              // Optimistic removal
              dispatch(REMOVE_CART_ITEM(item._id));

              // Server call - realtime event will confirm
              await dispatch(
                deleteCartItem({ id: item._id, email: user.email }),
              );
            } finally {
              pendingDeleteRef.current = null;
            }
          },
        },
        {
          label: "Cancel",
        },
      ],
    });
  };

  // handle checkout (optimistic / fast navigation)
  const handleCheckOut = async () => {
    if (customerInfo.name === "") {
      toast.error("Please enter customer's information");
      return;
    }

    // Require payment method only for non-part payment
    if (!isPartPayment && paymentTypes.length === 0) {
      toast.error("Please select at least one payment method");
      return;
    }

    const selected = paymentTypes;
    const normalizedAmounts = selected.length
      ? selected.reduce(
          (acc, method) => ({
            ...acc,
            [method]: Number(paymentAmounts[method] || 0),
          }),
          { ...paymentAmounts },
        )
      : {};

    const hasEnteredAmount = Object.values(normalizedAmounts).some(
      (val) => Number(val) > 0,
    );

    if (!isPartPayment && !hasEnteredAmount) {
      toast.error("Please enter an amount for the selected payment method(s)");
      return;
    }

    // If user provided only the part-payment amount, attach it to the first selected method
    if (
      !hasEnteredAmount &&
      selected.length > 0 &&
      Number(partPaymentDetails.amountPaid) > 0
    ) {
      normalizedAmounts[selected[0]] = Number(partPaymentDetails.amountPaid);
    }

    if (selected.length > 1) {
      for (const m of selected) {
        if (!normalizedAmounts[m] || Number(normalizedAmounts[m]) <= 0) {
          toast.error(`Please enter amount for ${m}`);
          return;
        }
      }
    }

    const amountPaid = selected.length
      ? Object.values(normalizedAmounts).reduce(
          (sum, value) => sum + Number(value || 0),
          0,
        )
      : Number(partPaymentDetails.amountPaid || 0);

    if (!isPartPayment && amountPaid <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    const isPending =
      isPartPayment || Math.round(amountPaid) < Math.round(cartSubTotal);
    const balance = Math.max(cartSubTotal - amountPaid, 0);

    const paymentParts = selected
      .map((method) => {
        const value = Number(normalizedAmounts[method] || 0);
        if (!value) return null;
        return {
          amountPaid: value,
          method,
          datePaid: new Date(),
        };
      })
      .filter(Boolean);

    const paymentPayload = {
      paymentTypes: selected,
      paymentAmounts: normalizedAmounts,
      paymentType: isPending ? "part" : selected.join(","),
      paymentStatus: isPending ? "pending" : "completed",
      partPaymentDetails: {
        amountPaid,
        balance,
        paymentParts,
      },
    };

    try {
      setIsSubmitting(true);
      const resultAction = await dispatch(
        checkoutCart({
          items: cart.items,
          customer: customerInfo,
          user,
          paymentDetails: paymentPayload,
          deliveryStatus: {
            status: deliveryStatus,
            date: new Date().toISOString(),
          },
        }),
      );

      if (checkoutCart.fulfilled.match(resultAction)) {
        // Real-time update via WebSocket/Change Stream will handle cart refresh
        toast.success("Checkout completed successfully!");
        navigate("/inventory/sales");
      } else {
        toast.error(
          resultAction.payload || "Checkout failed. Please try again.",
        );
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error(err?.message || "Checkout failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatter = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const formatNumbers = (x) => {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleTogglePaymentType = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setPaymentTypes((p) => {
        const next = Array.from(new Set([...p, value]));
        // if only one method selected and not part-payment, assume full payment by that method
        if (next.length === 1 && !isPartPayment) {
          setPaymentAmounts({ [value]: cartSubTotal });
        } else {
          setPaymentAmounts((amt) => ({ ...amt, [value]: amt[value] || 0 }));
        }
        return next;
      });
    } else {
      setPaymentTypes((p) => {
        const next = p.filter((x) => x !== value);
        setPaymentAmounts((amt) => {
          const copy = { ...amt };
          delete copy[value];
          // if after removal there's exactly one left and not part-payment, set that one to full total
          if (next.length === 1 && !isPartPayment) {
            return { [next[0]]: cartSubTotal };
          }
          return copy;
        });
        return next;
      });
    }
  };

  const handlePaymentAmountChange = (e) => {
    const { name, value } = e.target;
    // Allow clearable input: store empty string when cleared
    setPaymentAmounts((p) => ({
      ...p,
      [name]: value === "" ? "" : Number(value),
    }));
  };

  // live payment sum and checkout enablement
  const paymentSum = (() => {
    const sum = Object.keys(paymentAmounts).reduce(
      (s, k) => s + Number(paymentAmounts[k] || 0),
      0,
    );
    if (sum > 0) return sum;
    return Number(partPaymentDetails.amountPaid || 0);
  })();

  const liveBalance = Math.max(cartSubTotal - paymentSum, 0);

  const canCheckout =
    !!customerInfo.name &&
    (isPartPayment ? true : paymentTypes.length > 0 && paymentSum > 0);

  // keep single-method amount in sync if cart subtotal changes or part-payment toggled
  useEffect(() => {
    if (paymentTypes.length === 1 && !isPartPayment) {
      const key = paymentTypes[0];
      setPaymentAmounts((prev) => {
        const current = Number(prev[key] || 0);
        if (current > 0) return prev;
        return { [key]: cartSubTotal };
      });
    }
  }, [paymentTypes, cartSubTotal, isPartPayment]);

  useEffect(() => {
    const paid = paymentSum;
    const balance = Math.max(cartSubTotal - paid, 0);
    setPartPaymentDetails((prev) => {
      if (prev.amountPaid === paid && prev.balance === balance) return prev;
      return {
        ...prev,
        amountPaid: paid,
        balance,
      };
    });
  }, [paymentSum, cartSubTotal]);

  const handleTogglePartPayment = (e) => {
    setIsPartPayment(e.target.checked);
  };

  const handlePartPaymentChange = (e) => {
    const { name, value } = e.target;
    const parsed = value === "" ? "" : Number(value);
    const paidNum = parsed === "" ? 0 : parsed;
    const newPartPaymentDetails = {
      ...partPaymentDetails,
      [name]: parsed,
    };
    newPartPaymentDetails.balance = cartSubTotal - paidNum;

    if (name === "amountPaid") {
      newPartPaymentDetails.paymentParts =
        parsed === ""
          ? []
          : [
              {
                amountPaid: paidNum,
                datePaid: new Date().toISOString(),
              },
            ];
    }

    setPartPaymentDetails(newPartPaymentDetails);
  };

  const handleChangeDeliveryStatus = (e) => {
    setDeliveryStatus(e.target.value);
  };

  console.log("deliveryStatus", deliveryStatus);

  return (
    <>
      {admin || currentUser?.permissions?.sellProducts ? (
        <div className="cart-details-page">
          {isLoading && (!cart || !cart.items || cart.items.length === 0) && (
            <p
              style={{ textAlign: "center", padding: "20px", fontSize: "16px" }}
            >
              Loading cart...
            </p>
          )}

          {isSubscriptionExpired ? (
            <ExpiredSubscription isBusinessOwner={admin} />
          ) : (
            <>
              {/* Page header revamp: compact title, breadcrumb and quick total */}
              <div className="cart-header">
                <div className="cart-header-left">
                  <h2 className="cart-title">Sales / Checkout</h2>
                  <nav className="cart-breadcrumb">
                    <Link to="/inventory">Inventory</Link>
                    <span>&nbsp;/&nbsp;</span>
                    <span>Cart</span>
                  </nav>
                </div>
                <div className="cart-header-right">
                  <div className="cart-header-total">
                    <span>Total</span>
                    <strong>{formatter(cartSubTotal)}</strong>
                  </div>
                </div>
              </div>
              {!cart || !cart.items || cart.items.length === 0 ? (
                <div className="empty-cart-container">
                  <div className="empty-cart-content">
                    <svg
                      width="120"
                      height="120"
                      viewBox="0 0 120 120"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="60"
                        cy="60"
                        r="58"
                        stroke="var(--brand-color)"
                        strokeWidth="3"
                        opacity="0.2"
                      />
                      <path
                        d="M40 45L80 45L75 75H45L40 45Z"
                        stroke="var(--brand-color)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                      <circle cx="52" cy="85" r="4" fill="var(--brand-color)" />
                      <circle cx="68" cy="85" r="4" fill="var(--brand-color)" />
                      <path
                        d="M45 45L42 30H30"
                        stroke="var(--brand-color)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    <h1 className="empty-cart-title">Your Cart is Empty</h1>
                    <p className="empty-cart-text">
                      Add products from your inventory to get started
                    </p>
                    <Link to="/inventory" className="empty-cart-link">
                      <button className="browse-products-btn">
                        Browse Products
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="cart-body">
                  <div className="cart-items">
                    {cart.items.map((item, index) => {
                      const {
                        _id,
                        name,
                        price,
                        quantity,
                        image,
                        category,
                        id,
                        images,
                        productIsaGroup,
                        itemGroup,
                      } = item;
                      const cachedProduct = productsById?.[String(id)] || null;
                      const productImagePath = getPrimaryImagePath(images, image);
                      const cachedProductImagePath = cachedProduct
                        ? getPrimaryImagePath(cachedProduct.images, cachedProduct.image)
                        : "";
                      const cachedPricing = cachedProduct?.discountPricing || null;
                      const hasRecordedSalesDiscount = Boolean(cachedPricing?.hasDiscount);
                      const originalDiscountPrice = Number(cachedPricing?.originalPrice || 0);
                      const isGroupItem = Boolean(productIsaGroup);
                      const groupImagePath =
                        isGroupItem && itemGroup
                          ? getPrimaryImagePath(
                              productGroupsById[String(itemGroup)]?.images,
                              productGroupsById[String(itemGroup)]?.image,
                            )
                          : "";
                      const displayImagePath =
                        productImagePath || cachedProductImagePath || groupImagePath;
                      return (
                        <div
                          className="cart-item-card"
                          key={_id || id || `${name}-${index}`}
                        >
                          {displayImagePath && (
                            <div className="cart-item-image" onClick={() => {
                              setPreviewImagePath(displayImagePath);
                              setIsImagePreviewOpen(true);
                            }} style={{ cursor: "pointer" }}>
                              <img src={displayImagePath} alt={name} />
                            </div>
                          )}
                          <div className="cart-item-details">
                            <h3 className="cart-item-name">{name}</h3>
                            <p className="cart-item-category">{category}</p>
                            <div className="cart-item-price">
                              {hasRecordedSalesDiscount && originalDiscountPrice > 0 ? (
                                <span className="cart-discount-old-price">
                                  {formatter(originalDiscountPrice)}
                                </span>
                              ) : null}
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onInput={(e) => handlePriceInput(e, id, _id)}
                                onBlur={(e) => handlePriceBlur(e, id, _id)}
                                className="price-editable"
                              >
                                {formatter(price)}
                              </span>
                            </div>
                          </div>
                          <div className="cart-item-quantity">
                            <div className="quantity-controls">
                              <button
                                onClick={() =>
                                  handleDecreament(id, _id, quantity)
                                }
                                disabled={quantity <= 1}
                              >
                                -
                              </button>
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => handleChangeQuantity(e, id, _id)}
                                className="quantity-editable"
                              >
                                {Math.max(1, Number(quantity) || 1)}
                              </span>
                              <button
                                onClick={() =>
                                  handleIncreament(
                                    id,
                                    _id,
                                    quantity,
                                    item.maxQuantity || item.remainingQuantity,
                                  )
                                }
                                disabled={
                                  quantity >=
                                  (item.maxQuantity ||
                                    item.remainingQuantity ||
                                    Infinity)
                                }
                                style={{
                                  opacity:
                                    quantity >=
                                    (item.maxQuantity ||
                                      item.remainingQuantity ||
                                      Infinity)
                                      ? 0.5
                                      : 1,
                                  cursor:
                                    quantity >=
                                    (item.maxQuantity ||
                                      item.remainingQuantity ||
                                      Infinity)
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="cart-item-subtotal">
                            <p>
                              {formatter(
                                ((editingPrices[_id] ?? price) || 0) *
                                  (Number(quantity) || 0),
                              )}
                            </p>
                          </div>
                          <div className="cart-item-actions">
                            <Tooltip title="Remove">
                              <img
                                src={deleteIcon}
                                alt="delete"
                                onClick={() => handleDelete(item)}
                                className="delete-icon"
                              />
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Checkout and Customer Info Card */}
                  <div className="cart-info">
                    <div className="customer-info">
                      <h3>Customer Information</h3>
                      <div className="name_field_customer_info">
                        <label>Name</label>
                        <input
                          type="text"
                          name="name"
                          value={customerInfo.name}
                          onChange={handleCustomerInfo}
                          onBlur={handleNameBlur}
                          placeholder="Customer Name"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="suggestions-container">
                            {suggestions.map((s, index) => (
                              <div
                                key={s._id || s.email || `${s.name}-${index}`}
                                className="suggestion"
                                onClick={() => handleSuggestionClick(s)}
                              >
                                {s.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label>Phone</label>
                        <input
                          type="text"
                          name="phone"
                          value={customerInfo.phone}
                          onChange={handleCustomerInfo}
                          placeholder="Customer Phone"
                        />
                      </div>
                      <div>
                        <label>Email</label>
                        <input
                          type="email"
                          name="email"
                          value={customerInfo.email}
                          onChange={handleCustomerInfo}
                          placeholder="Customer Email"
                        />
                      </div>
                    </div>

                    <div className="payment-info">
                      <h3>Payment Method</h3>
                      <div className="payment-methods">
                        {["cash", "transfer", "pos"].map((method) => (
                          <div className="pm-item" key={method}>
                            <input
                              type="checkbox"
                              id={`pm-${method}`}
                              value={method}
                              checked={paymentTypes.includes(method)}
                              onChange={handleTogglePaymentType}
                              className="pm-checkbox"
                            />
                            <label htmlFor={`pm-${method}`}>
                              {method.toUpperCase()}
                            </label>
                          </div>
                        ))}
                      </div>
                      <div className="part-payment-toggle">
                        <input
                          type="checkbox"
                          id="part-payment"
                          checked={isPartPayment}
                          onChange={handleTogglePartPayment}
                          className="pm-checkbox"
                        />
                        <label htmlFor="part-payment">PART PAYMENT</label>
                      </div>

                      {paymentTypes.length > 0 && (
                        <div className="payment-amounts">
                          {paymentTypes.map((method) => (
                            <div className="pm-amount-item" key={method}>
                              <label>{method.toUpperCase()}</label>
                              <input
                                type="number"
                                name={method}
                                value={paymentAmounts[method] ?? ""}
                                onChange={handlePaymentAmountChange}
                                placeholder={`Amount for ${method}`}
                              />
                            </div>
                          ))}
                          <p className="payment-balance-text">
                            Balance after payment: {formatter(liveBalance)}
                          </p>
                        </div>
                      )}

                      {isPartPayment && (
                        <div className="part-payment-details">
                          <label>Amount Paid</label>
                          <input
                            type="number"
                            name="amountPaid"
                            value={partPaymentDetails.amountPaid}
                            onChange={handlePartPaymentChange}
                            placeholder="Enter amount paid"
                          />
                          <p>
                            Balance: {formatter(partPaymentDetails.balance)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="delivery-info">
                      <h3>Delivery Status</h3>
                      <select
                        value={deliveryStatus}
                        onChange={handleChangeDeliveryStatus}
                      >
                        <option value="pending">Pending</option>
                        <option value="delivered">Delivered</option>
                        <option value="pickedup">Picked up</option>
                      </select>
                    </div>

                    <div className="cart-summary">
                      <div className="summary-item">
                        <span>Subtotal</span>
                        <span>{formatter(cartSubTotal)}</span>
                      </div>
                      <div className="summary-item total">
                        <span>Total</span>
                        <span>{formatter(cartSubTotal)}</span>
                      </div>
                    </div>

                    <div className="check-out-actions">
                      <button
                        className="checkout-btn"
                        onClick={handleCheckOut}
                        disabled={!canCheckout || isLoading}
                      >
                        {isLoading || isSubmitting
                          ? "Processing..."
                          : "Checkout"}
                      </button>
                      <button
                        className="return-btn"
                        onClick={() => navigate("/inventory")}
                      >
                        Return to Products
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="unauthorized-containers">
          <h1>Unauthorized</h1>
        </div>
      )}
      <ImagePreviewModal
        isOpen={isImagePreviewOpen}
        imageSrc={previewImagePath}
        alt="Cart item image"
        onClose={() => {
          setIsImagePreviewOpen(false);
          setPreviewImagePath(null);
        }}
      />    </>
  );
}
