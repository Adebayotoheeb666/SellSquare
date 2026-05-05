import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import cartService from "./cartService";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import fileDownload from "js-file-download";

/**
 * Safely extract array from any backend payload.
 * CRITICAL: This ensures Redux state ALWAYS contains arrays, never objects.
 * This is the root fix for "items.forEach is not a function" errors.
 */
const ensureArray = (payload, ...fieldNames) => {
  // Already an array
  if (Array.isArray(payload)) {
    return payload;
  }

  // Null/undefined
  if (payload == null) {
    return [];
  }

  // Not an object
  if (typeof payload !== "object") {
    console.warn("[CartSlice] Unexpected payload type:", typeof payload);
    return [];
  }

  // Try specified field names first
  for (const field of fieldNames) {
    if (Array.isArray(payload[field])) {
      return payload[field];
    }
  }

  // Try common patterns
  const commonFields = ["items", "data", "results", "records"];
  for (const field of commonFields) {
    if (Array.isArray(payload[field])) {
      return payload[field];
    }
  }

  console.warn(
    "[CartSlice] Could not extract array from payload:",
    Object.keys(payload),
  );
  return [];
};

// check if cart items is in local storage and set it to cart state
let isReceiptGenerated = false;

const initialState = {
  cart: localStorage.getItem("cartItems")
    ? JSON.parse(localStorage.getItem("cartItems"))
    : {},
  isError: false,
  checkouts: [],
  allCheckouts: [],
  customers: [],
  customersLoaded: false, // Track if customers have been loaded this session
  isSuccess: false,
  isCartLoading: false,
  message: "",
  cartProfitValue: 0,
  cartSoldValue: 0,
  cartSubTotal: 0,
  totalCashCollected: 0,
  totalTransferCollected: 0,
  totalCollectedOnPOS: 0,
  pendingSalesValue: 0,
  pendingProfitValue: 0,
  cartItems: 0,
  incompletePayments: [],
  // Pagination for incomplete payments
  incompletePaymentsPagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasMore: false,
  },
  // Pagination metadata
  checkoutsPagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasMore: false,
  },
  allCheckoutsPagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasMore: false,
  },
  checkoutYears: [],
  // Aggregated statistics for all filtered results
  checkoutsAggregatedStats: {
    totalSales: 0,
    totalProfit: 0,
    totalCash: 0,
    totalTransfer: 0,
    totalPOS: 0,
    totalPending: 0,
    totalPendingProfit: 0,
    totalItems: 0,
  },
};

const computeCartSubTotal = (cart) => {
  if (!cart || !cart.items) return 0;
  return cart.items.reduce((sum, item) => {
    const price = Number(item?.price || 0);
    const quantity = Number(item?.quantity || 0);
    return sum + price * quantity;
  }, 0);
};

const persistCartState = (state, cart) => {
  const nextCart = cart || { items: [] };
  state.cartSubTotal = computeCartSubTotal(nextCart);
  state.cart = nextCart;
  try {
    localStorage.setItem("cartItems", JSON.stringify(nextCart));
  } catch (e) {
    // localStorage quota exceeded – try a slimmed-down copy without heavy
    // fields (e.g. base64 images, long descriptions) that aren't needed for
    // cart display on next page load.
    try {
      const slim = {
        ...nextCart,
        items: Array.isArray(nextCart.items)
          ? nextCart.items.map(({ image, images, description, ...rest }) => rest)
          : nextCart.items,
      };
      localStorage.setItem("cartItems", JSON.stringify(slim));
    } catch (_) {
      // Still too large – silently skip persistence.  Redux state and the
      // server copy of the cart remain the authoritative sources.
      console.warn(
        "[CartSlice] Could not persist cart to localStorage – quota exceeded",
      );
    }
  }
};

// Add to cart
export const addToCart = createAsyncThunk(
  "product/addProductToCart",
  async ({ id, formData }, thunkAPI) => {
    try {
      return await cartService.addToCart(id, formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Get cart
export const getCart = createAsyncThunk(
  "products/getCart",
  async (email, thunkAPI) => {
    try {
      return await cartService.getCart(email);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const deleteCartItem = createAsyncThunk(
  "product/deleteCartItem",
  async ({ id, email }, thunkAPI) => {
    try {
      return await cartService.deleteCartItem(id, email);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// increase cart items
export const increaseCartItems = createAsyncThunk(
  "product/increaseCartItems",
  async (formData, thunkAPI) => {
    try {
      return await cartService.increaseCartItems(formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// set new price for item at sales
export const setNewPrice = createAsyncThunk(
  "product/setNewPrice",
  async ({ id, cartId, price, email }, thunkAPI) => {
    try {
      return await cartService.setPrice(id, cartId, price, email);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// Set new quantity for product
export const setQuantity = createAsyncThunk(
  "product/setCatQuantity",
  async ({ id, cartId, quantity }, thunkAPI) => {
    try {
      return await cartService.setCartQuantity(id, cartId, quantity);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// decrease cart items
export const decreaseCartItems = createAsyncThunk(
  "product/decreaseCartItems",
  async (formData, thunkAPI) => {
    try {
      return await cartService.decreaseCartItems(formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// checkout cart
export const checkoutCart = createAsyncThunk(
  "product/checkoutCart",
  async (formData, thunkAPI) => {
    try {
      return await cartService.checkoutCart(formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// get checkouts
export const getCheckouts = createAsyncThunk(
  "product/getCheckouts",
  async (
    { start, end, page = 1, limit = 10, search = "", filters = {} },
    thunkAPI,
  ) => {
    try {
      if (start === "" || end === "") {
        return await cartService.getCheckouts(
          start,
          end,
          page,
          limit,
          search,
          filters,
        );
      }
      return await cartService.getCheckouts(
        start,
        end,
        page,
        limit,
        search,
        filters,
      );
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// get all checkouts
export const getAllCheckouts = createAsyncThunk(
  "product/getAllCheckouts",
  async ({ page = 1, limit = 10, search = "" } = {}, thunkAPI) => {
    try {
      return await cartService.getAllCheckouts(page, limit, search);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// get checkout years
export const getCheckoutYears = createAsyncThunk(
  "product/getCheckoutYears",
  async (_, thunkAPI) => {
    try {
      return await cartService.getCheckoutYears();
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// generate receipt
export const generateReceipt = createAsyncThunk(
  "product/generateReceipt",
  async (id, thunkAPI) => {
    try {
      const receipt = await cartService.generateReceipt(id);

      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 1000);
      const receiptName = `receipt_${timestamp}_${randomNum}.pdf`;

      const pdfBlob = new Blob([receipt], { type: "application/pdf" });
      fileDownload(receipt, receiptName);

      return true;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// send receipt to customer via whatsapp
export const sendReceipt = createAsyncThunk(
  "product/sendReceipt",
  async (id, thunkAPI) => {
    try {
      return await cartService.sendReceipt(id);
    } catch (error) {
      console.log("error", error);
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  },
);

// send receipt directly to printer for printing. such as thermal printer
export const printReceipt = createAsyncThunk(
  "product/sendReceiptToPrinterForPrinting",
  async (id, thunkAPI) => {
    try {
      return await cartService.printReceipt(id);
    } catch (error) {
      console.log("error", error);
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const returnedGoods = createAsyncThunk(
  "cart/returnOfGoodsSoldOut",
  async ({ id, formData }, thunkAPI) => {
    try {
      return await cartService.returnedGoods(id, formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const getCustomers = createAsyncThunk(
  "cart/getCustomers",
  async (_, thunkAPI) => {
    try {
      return await cartService.getCustomers();
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const fetchIncompletePayments = createAsyncThunk(
  "cart/cartPayments/fetchIncompletePayments",
  async (params, thunkAPI) => {
    try {
      return await cartService.getIncompletePayments(params);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const updateIncompletePayment = createAsyncThunk(
  "cart/cartPayments/updateIncompletePayment",
  async (formData, thunkAPI) => {
    try {
      return await cartService.updatePayment(formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const updateDeliveryStatus = createAsyncThunk(
  "cart/deliveryStatus/updateDeliveryStatus/byId",
  async (formData, thunkAPI) => {
    try {
      return await cartService.updateDeliveryStatus(formData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      console.log(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    // CRITICAL: Reset all cart state on logout - ensures no data leakage to next user
    RESET_SESSION(state) {
      state.cart = {};
      state.isError = false;
      state.checkouts = [];
      state.allCheckouts = [];
      state.customers = [];
      state.customersLoaded = false;
      state.isSuccess = false;
      state.isCartLoading = false;
      state.message = "";
      state.cartProfitValue = 0;
      state.cartSoldValue = 0;
      state.cartSubTotal = 0;
      state.totalCashCollected = 0;
      state.totalTransferCollected = 0;
      state.totalCollectedOnPOS = 0;
      state.pendingSalesValue = 0;
      state.pendingProfitValue = 0;
      state.cartItems = 0;
      state.incompletePayments = [];
      state.incompletePaymentsPagination = {
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasMore: false,
      };
      state.checkoutsPagination = {
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasMore: false,
      };
      state.allCheckoutsPagination = {
        currentPage: 1,
        totalPages: 1,
        total: 0,
        hasMore: false,
      };
      state.checkoutYears = [];
      state.checkoutsAggregatedStats = {
        totalSales: 0,
        totalProfit: 0,
        totalCash: 0,
        totalTransfer: 0,
        totalPOS: 0,
        totalPending: 0,
        totalPendingProfit: 0,
        totalItems: 0,
      };
      localStorage.removeItem("cartItems");
    },
    forceClearCartLoading(state, action) {
      state.isCartLoading = false;
      if (action.payload?.error) {
        state.isError = true;
        state.message = action.payload.error;
      }
    },
    CALC_CART_SUB_TOTAL(state, action) {
      state.cartSubTotal = computeCartSubTotal(action.payload);
    },
    CALC_CART_ITEMS(state, action) {
      const cart = action.payload;
      if (cart && cart.items) {
        state.cartItems = cart.items.length;
      }
    },
    INCREASE_CART_ITEM(state, action) {
      const { _id, quantity } = action.payload;
      const cart = state.cart;
      const item = cart?.items?.find((entry) => entry._id === _id);
      if (!item) return;
      item.quantity = quantity;
      persistCartState(state, cart);
    },
    SET_CART_QUANTITY(state, action) {
      const { _id, quantity } = action.payload;
      const cart = state.cart;
      const item = cart?.items?.find((entry) => entry._id === _id);
      if (!item) return;
      item.quantity = quantity;
      persistCartState(state, cart);
    },
    SET_CART_PRICE(state, action) {
      const { _id, price } = action.payload;
      const cart = state.cart;
      const item = cart?.items?.find((entry) => entry._id === _id);
      if (!item) return;
      item.price = price;
      persistCartState(state, cart);
    },
    GET_CART(state, action) {
      // state.cart = action.payload;
      // JASON.parse(localStorage.getItem("cartItems"));
      return JSON.parse(localStorage.getItem("cartItems"));
    },
    DECREASE_CART_ITEM(state, action) {
      const { _id, quantity } = action.payload;
      const cart = state.cart;
      const item = cart?.items?.find((entry) => entry._id === _id);
      if (!item) return;
      item.quantity = quantity;
      persistCartState(state, cart);
    },
    REMOVE_CART_ITEM(state, action) {
      const cartItemId = action.payload;
      const updatedItems = state.cart?.items?.filter(
        (item) => item._id !== cartItemId,
      );
      const nextCart = {
        ...state.cart,
        items: updatedItems,
      };
      persistCartState(state, nextCart);
    },
    CALC_PROFIT_VALUE(state, action) {
      const carts = action.payload;
      // console.log("carts", carts)
      const array = [];
      if (carts) {
        carts?.forEach((cart) => {
          const { payment } = cart;
          // console.log(payment.paymentStatus);
          if (
            !payment?.paymentType ||
            (payment && payment.paymentStatus === "completed")
          ) {
            cart.items.forEach((item) => {
              const { price, quantity, cost } = item;
              const cartValue = (price - cost) * quantity;
              array.push(cartValue);
            });
          }
        });
        const totalValue = array.reduce((a, b) => a + b, 0);
        state.cartProfitValue = totalValue;
      }
    },
    CALC_SOLD_VALUE(state, action) {
      const carts = action.payload;
      const array = [];
      if (carts) {
        carts?.forEach((cart) => {
          const { payment } = cart;
          if (
            !payment?.paymentType ||
            (payment && payment.paymentStatus === "completed")
          ) {
            cart.items.forEach((item) => {
              const { price, quantity } = item;
              const cartValue = price * quantity;
              array.push(cartValue);
            });
          }
        });
        const totalValue = array.reduce((a, b) => a + b, 0);
        state.cartSoldValue = totalValue;
      }
    },
    CALC_SALES_BY_CASH(state, action) {
      const carts = action.payload;
      let totalValue = 0;
      carts?.forEach((cart) => {
        const { payment, items } = cart;
        const itemTotal = items?.reduce(
          (sum, item) =>
            sum + Number(item.price || 0) * Number(item.quantity || 0),
          0,
        );

        if (payment) {
          // Prefer explicit paymentAmounts breakdown
          const cashPortion = Number(payment.paymentAmounts?.cash || 0);
          if (cashPortion > 0) {
            totalValue += cashPortion;
            return;
          }

          // Fallback: legacy single-method tagging
          if (payment.paymentType === "cash" && itemTotal) {
            totalValue += itemTotal;
          }
        }
      });

      state.totalCashCollected = totalValue;
    },
    CALC_SALES_BY_TRANSFER(state, action) {
      const carts = action.payload;
      let totalValue = 0;
      carts?.forEach((cart) => {
        const { payment, items } = cart;
        const itemTotal = items?.reduce(
          (sum, item) =>
            sum + Number(item.price || 0) * Number(item.quantity || 0),
          0,
        );

        if (payment) {
          const transferPortion = Number(payment.paymentAmounts?.transfer || 0);
          if (transferPortion > 0) {
            totalValue += transferPortion;
            return;
          }

          if (payment.paymentType === "transfer" && itemTotal) {
            totalValue += itemTotal;
          }
        }
      });

      state.totalTransferCollected = totalValue;
    },
    CALC_SALES_BY_POS(state, action) {
      const carts = action.payload;
      let totalValue = 0;
      carts?.forEach((cart) => {
        const { payment, items } = cart;
        const itemTotal = items?.reduce(
          (sum, item) =>
            sum + Number(item.price || 0) * Number(item.quantity || 0),
          0,
        );

        if (payment) {
          const posPortion = Number(payment.paymentAmounts?.pos || 0);
          if (posPortion > 0) {
            totalValue += posPortion;
            return;
          }

          if (payment.paymentType === "pos" && itemTotal) {
            totalValue += itemTotal;
          }
        }
      });

      state.totalCollectedOnPOS = totalValue;
    },
    CALC_SALES_BY_PART_PENDING(state, action) {
      const carts = action.payload;
      const array = [];
      if (carts) {
        carts?.forEach((cart) => {
          const { payment } = cart;
          if (payment && payment.paymentStatus === "pending") {
            cart.items.forEach((item) => {
              const { price, quantity } = item;
              const cartValue = price * quantity;
              array.push(cartValue);
            });
          }
        });
        const totalValue = array.reduce((a, b) => a + b, 0);
        state.pendingSalesValue = totalValue;
      }
    },
    CALC_PROFIT_BY_PART_PENDING(state, action) {
      const carts = action.payload;
      const array = [];
      if (carts) {
        carts?.forEach((cart) => {
          const { payment } = cart;
          if (payment && payment.paymentStatus === "pending") {
            cart.items.forEach((item) => {
              const { price, quantity, cost } = item;
              const cartValue = (price - cost) * quantity;
              array.push(cartValue);
            });
          }
        });
        const totalValue = array.reduce((a, b) => a + b, 0);
        state.pendingProfitValue = totalValue;
      }
    },
    // Realtime update handler - called by realtimeSlice when cart events are received
    // CRITICAL: Add safety check to prevent cart mixing between users
    handleRealtimeUpdate(state, action) {
      const { eventType, data } = action.payload;

      // Cart updated event - refresh the cart data
      if (
        eventType === "cart.updated" ||
        eventType === "cart.item_added" ||
        eventType === "cart.item_removed"
      ) {
        // Defensive: Only update if we have valid cart data with items array
        if (
          data &&
          typeof data === "object" &&
          (Array.isArray(data.items) || data.items !== undefined)
        ) {
          // CRITICAL SAFETY CHECK: Verify cart belongs to current user/email
          // Only update if current cart is empty OR same user email
          if (
            !state.cart?._id ||
            (state.cart?.user?.email && data?.user?.email &&
              state.cart.user.email === data.user.email)
          ) {
            persistCartState(state, data);
          } else {
            // Security event: Cart update for different user
            console.warn(
              "[CartSlice] Ignoring realtime update - belongs to different user",
              {
                currentUser: state.cart?.user?.email,
                incomingUser: data?.user?.email,
              },
            );
          }
        }
      }

      // Cart cleared event - clear the cart
      if (eventType === "cart.cleared") {
        state.cart = {};
        state.cartItems = 0;
        localStorage.removeItem("cartItems");
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addToCart.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        persistCartState(state, action.payload);
        toast.success("Product has been added to cart successfully!");
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(getCart.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(getCart.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        persistCartState(state, action.payload);
      })
      .addCase(getCart.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        toast.error(action.payload);
      })
      .addCase(setNewPrice.pending, (state) => {
        state.isCartLoading = false;
      })
      .addCase(setNewPrice.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        // Only update if we have valid cart data
        if (action.payload && Array.isArray(action.payload.items)) {
          persistCartState(state, action.payload);
        }
      })
      .addCase(setNewPrice.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "set-price-error",
            duration: 3000,
          });
        }
      })
      .addCase(setQuantity.pending, (state) => {
        state.isCartLoading = false;
      })
      .addCase(setQuantity.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        persistCartState(state, action.payload);
      })
      .addCase(setQuantity.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "set-quantity-error",
            duration: 3000,
          });
        }
      })
      .addCase(increaseCartItems.pending, (state) => {
        state.isCartLoading = false;
      })
      .addCase(increaseCartItems.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        // Only update if we have valid cart data
        if (action.payload && Array.isArray(action.payload.items)) {
          persistCartState(state, action.payload);
        }
      })
      .addCase(increaseCartItems.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "increase-cart-error",
            duration: 3000,
          });
        }
      })
      .addCase(decreaseCartItems.pending, (state) => {
        state.isCartLoading = false;
      })
      .addCase(decreaseCartItems.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        persistCartState(state, action.payload);
      })
      .addCase(decreaseCartItems.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "decrease-cart-error",
            duration: 3000,
          });
        }
      })
      .addCase(deleteCartItem.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(deleteCartItem.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        persistCartState(state, action.payload);
        toast.success("item successfully deleted", {
          id: "delete-cart-item-success",
          duration: 2000,
        });
      })
      .addCase(deleteCartItem.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "delete-cart-item-error",
            duration: 3000,
          });
        }
      })
      .addCase(checkoutCart.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(checkoutCart.fulfilled, (state, action) => {
        persistCartState(state, action.payload.cart);
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Checkout successfully", {
          id: "checkout-success",
          duration: 2000,
        });
        state.isCartLoading = false;
      })
      .addCase(checkoutCart.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "checkout-error",
            duration: 3000,
          });
        }
      })
      .addCase(getCheckouts.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(getCheckouts.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always extract array from response, never store raw payload
        const checkoutsArray = ensureArray(
          action.payload,
          "checkOuts",
          "checkouts",
          "sales",
        );
        state.checkouts = checkoutsArray;

        // Handle paginated response metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          state.checkoutsPagination = {
            currentPage: action.payload.currentPage || 1,
            totalPages:
              action.payload.totalPages ||
              Math.ceil(checkoutsArray.length / 10),
            total: action.payload.total || checkoutsArray.length,
            hasMore: action.payload.hasMore || false,
          };
          // Store aggregated statistics
          if (action.payload.aggregatedStats) {
            state.checkoutsAggregatedStats = action.payload.aggregatedStats;
          }
        } else {
          // Direct array response - compute pagination from array
          state.checkoutsPagination = {
            currentPage: 1,
            totalPages: Math.ceil(checkoutsArray.length / 10),
            total: checkoutsArray.length,
            hasMore: false,
          };
        }
      })
      .addCase(getCheckouts.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        // Don't show toast for background fetch operations
        console.error("Failed to fetch checkouts:", action.payload);
      })
      .addCase(getAllCheckouts.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(getAllCheckouts.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always extract array from response, never store raw payload
        const checkoutsArray = ensureArray(
          action.payload,
          "checkOuts",
          "checkouts",
          "sales",
        );
        state.allCheckouts = checkoutsArray;

        // Handle paginated response metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          state.allCheckoutsPagination = {
            currentPage: action.payload.currentPage || 1,
            totalPages:
              action.payload.totalPages ||
              Math.ceil(checkoutsArray.length / 10),
            total: action.payload.total || checkoutsArray.length,
            hasMore: action.payload.hasMore || false,
          };
          if (action.payload.aggregatedStats) {
            state.checkoutsAggregatedStats = action.payload.aggregatedStats;
          }
        } else {
          state.allCheckoutsPagination = {
            currentPage: 1,
            totalPages: Math.ceil(checkoutsArray.length / 10),
            total: checkoutsArray.length,
            hasMore: false,
          };
        }
      })
      .addCase(getAllCheckouts.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        // Don't show toast for background fetch operations
        console.error("Failed to fetch all checkouts:", action.payload);
      })
      .addCase(getCheckoutYears.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(getCheckoutYears.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.checkoutYears = action.payload.years || [];
      })
      .addCase(getCheckoutYears.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        console.error("Failed to fetch checkout years:", action.payload);
      })
      .addCase(generateReceipt.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(generateReceipt.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Your receipt is ready!", {
          id: "generate-receipt-success",
          duration: 2000,
        });
      })
      .addCase(generateReceipt.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "generate-receipt-error",
            duration: 3000,
          });
        }
      })
      .addCase(sendReceipt.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(sendReceipt.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Receipt sent successfully!", {
          id: "send-receipt-success",
          duration: 2000,
        });
      })
      .addCase(sendReceipt.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "send-receipt-error",
            duration: 3000,
          });
        }
      })
      .addCase(printReceipt.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(printReceipt.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        toast.success("Your receipt is being printed", {
          id: "print-receipt-success",
          duration: 2000,
        });
      })
      .addCase(printReceipt.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "print-receipt-error",
            duration: 3000,
          });
        }
      })
      .addCase(returnedGoods.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(returnedGoods.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        toast.dismiss();
        // CRITICAL: Always extract array from response
        state.checkouts = ensureArray(
          action.payload,
          "checkOuts",
          "checkouts",
          "data",
        );
        toast.success("returned items processed successfully", {
          id: "returned-goods-success",
          duration: 2000,
        });
      })
      .addCase(returnedGoods.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "returned-goods-error",
            duration: 3000,
          });
        }
      })
      .addCase(getCustomers.pending, (state) => {
        state.isCartLoading = false;
      })
      .addCase(getCustomers.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
        // CRITICAL: Always extract array from response
        state.customers = ensureArray(action.payload, "customers", "data");
        state.customersLoaded = true; // Mark customers as loaded for this session
      })
      .addCase(getCustomers.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        // Don't show toast for background fetch operations
        console.error("Failed to fetch customers:", action.payload);
      })
      .addCase(fetchIncompletePayments.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(fetchIncompletePayments.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always extract array from response
        const paymentsArray = ensureArray(
          action.payload,
          "checkouts",
          "incompletePayments",
          "data",
        );
        state.incompletePayments = paymentsArray;

        // Handle pagination metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          state.incompletePaymentsPagination = {
            currentPage: action.payload.currentPage || 1,
            totalPages:
              action.payload.totalPages || Math.ceil(paymentsArray.length / 10),
            total: action.payload.total || paymentsArray.length,
            hasMore: action.payload.hasMore || false,
          };
        } else {
          state.incompletePaymentsPagination = {
            currentPage: 1,
            totalPages: Math.ceil(paymentsArray.length / 10),
            total: paymentsArray.length,
            hasMore: false,
          };
        }
      })
      .addCase(fetchIncompletePayments.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        // Don't show toast for background fetch operations
        console.error("Failed to fetch incomplete payments:", action.payload);
      })
      .addCase(updateIncompletePayment.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(updateIncompletePayment.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;

        // CRITICAL: Always extract array from response
        const paymentsArray = ensureArray(
          action.payload,
          "checkouts",
          "incompletePayments",
          "data",
        );
        state.incompletePayments = paymentsArray;

        // Handle pagination metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          state.incompletePaymentsPagination = {
            currentPage: action.payload.currentPage || 1,
            totalPages:
              action.payload.totalPages || Math.ceil(paymentsArray.length / 10),
            total: action.payload.total || paymentsArray.length,
            hasMore: action.payload.hasMore || false,
          };
        }
      })
      .addCase(updateIncompletePayment.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "update-incomplete-payment-error",
            duration: 3000,
          });
        }
      })
      .addCase(updateDeliveryStatus.pending, (state) => {
        state.isCartLoading = true;
      })
      .addCase(updateDeliveryStatus.fulfilled, (state, action) => {
        state.isCartLoading = false;
        state.isSuccess = true;
        state.isError = false;
      })
      .addCase(updateDeliveryStatus.rejected, (state, action) => {
        state.isCartLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.dismiss();
        if (
          !action.payload?.includes?.("offline") &&
          !action.payload?.includes?.("internet")
        ) {
          toast.error(action.payload, {
            id: "update-delivery-status-error",
            duration: 3000,
          });
        }
      });
  },
});

export const {
  CALC_CART_SUB_TOTAL,
  INCREASE_CART_ITEM,
  SET_CART_QUANTITY,
  SET_CART_PRICE,
  DECREASE_CART_ITEM,
  REMOVE_CART_ITEM,
  GET_CART,
  CALC_PROFIT_VALUE,
  CALC_SOLD_VALUE,
  CALC_CART_ITEMS,
  CALC_SALES_BY_CASH,
  CALC_SALES_BY_TRANSFER,
  CALC_SALES_BY_POS,
  CALC_SALES_BY_PART_PENDING,
  CALC_PROFIT_BY_PART_PENDING,
  handleRealtimeUpdate,
  forceClearCartLoading,
  RESET_SESSION,
} = cartSlice.actions;

export const selectIsCartLoading = (state) => state.cart.isCartLoading;
export const selectCart = (state) => state.cart.cart;
export const selectCartCheckedOut = (state) => state.cart.checkouts;
export const selectCartSubTotal = (state) => state.cart.cartSubTotal;
export const selectCartProfitValue = (state) => state.cart.cartProfitValue;
export const selectCartSoldValue = (state) => state.cart.cartSoldValue;
export const selectCartItemsLength = (state) => state.cart.cartItems;
export const selectIncompletePayments = (state) =>
  state.cart.incompletePayments;
export const selectIncompletePaymentsPagination = (state) =>
  state.cart.incompletePaymentsPagination;
export const selectTotalCash = (state) => state.cart.totalCashCollected;
export const selectTotalTransfer = (state) => state.cart.totalTransferCollected;
export const selectTotalPOS = (state) => state.cart.totalCollectedOnPOS;
export const selectPendingSalesValue = (state) => state.cart.pendingSalesValue;
export const selectPendingProfitValue = (state) =>
  state.cart.pendingProfitValue;
export const selectCustomers = (state) => state.cart.customers;
export const selectCustomersLoaded = (state) => state.cart.customersLoaded;

export default cartSlice.reducer;
