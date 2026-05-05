import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import discountService from "../../../services/discountService";

const initialState = {
  discounts: [],
  discount: null,
  productsForDiscount: [],
  groupsForDiscount: [],
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
};

// Create discount
export const createDiscount = createAsyncThunk(
  "discount/create",
  async (discountData, thunkAPI) => {
    try {
      const response = await discountService.createDiscount(discountData);
      return response?.data || response;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get all discounts
export const getDiscounts = createAsyncThunk(
  "discount/getAll",
  async (filters = {}, thunkAPI) => {
    try {
      const response = await discountService.getDiscounts(filters);
      return response?.data || [];
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get single discount
export const getDiscount = createAsyncThunk(
  "discount/getOne",
  async (id, thunkAPI) => {
    try {
      const response = await discountService.getDiscount(id);
      return response?.data || response;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Update discount
export const updateDiscount = createAsyncThunk(
  "discount/update",
  async ({ id, discountData }, thunkAPI) => {
    try {
      const response = await discountService.updateDiscount(id, discountData);
      return response?.data || response;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Delete discount
export const deleteDiscount = createAsyncThunk(
  "discount/delete",
  async (id, thunkAPI) => {
    try {
      await discountService.deleteDiscount(id);
      return id;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get products for discount
export const getProductsForDiscount = createAsyncThunk(
  "discount/getProducts",
  async (_, thunkAPI) => {
    try {
      const response = await discountService.getProductsForDiscount();
      return response?.data || [];
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get product groups for discount
export const getGroupsForDiscount = createAsyncThunk(
  "discount/getGroups",
  async (_, thunkAPI) => {
    try {
      const response = await discountService.getGroupsForDiscount();
      return response?.data || [];
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const discountSlice = createSlice({
  name: "discount",
  initialState,
  reducers: {
    resetDiscountState: (state) => {
      state.isError = false;
      state.isSuccess = false;
      state.isLoading = false;
      state.message = "";
    },
  },
  extraReducers: (builder) => {
    // Create discount
    builder
      .addCase(createDiscount.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
      })
      .addCase(createDiscount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.discounts.unshift(action.payload);
        state.message = "Discount created successfully";
      })
      .addCase(createDiscount.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });

    // Get all discounts
    builder
      .addCase(getDiscounts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getDiscounts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.discounts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(getDiscounts.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });

    // Get single discount
    builder
      .addCase(getDiscount.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getDiscount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.discount = action.payload;
      })
      .addCase(getDiscount.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });

    // Update discount
    builder
      .addCase(updateDiscount.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateDiscount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        const index = state.discounts.findIndex((d) => d._id === action.payload._id);
        if (index !== -1) {
          state.discounts[index] = action.payload;
        }
        state.discount = action.payload;
        state.message = "Discount updated successfully";
      })
      .addCase(updateDiscount.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });

    // Delete discount
    builder
      .addCase(deleteDiscount.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteDiscount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.discounts = state.discounts.filter((d) => d._id !== action.payload);
        state.message = "Discount deleted successfully";
      })
      .addCase(deleteDiscount.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });

    // Get products
    builder
      .addCase(getProductsForDiscount.fulfilled, (state, action) => {
        state.productsForDiscount = Array.isArray(action.payload)
          ? action.payload
          : [];
      });

    // Get groups
    builder
      .addCase(getGroupsForDiscount.fulfilled, (state, action) => {
        state.groupsForDiscount = Array.isArray(action.payload)
          ? action.payload
          : [];
      });
  },
});

export const selectAllDiscounts = (state) => state.discount.discounts;
export const selectDiscount = (state) => state.discount.discount;
export const selectDiscountLoading = (state) => state.discount.isLoading;
export const selectDiscountError = (state) => state.discount.isError;
export const selectDiscountMessage = (state) => state.discount.message;
export const selectProductsForDiscount = (state) =>
  state.discount.productsForDiscount;
export const selectGroupsForDiscount = (state) =>
  state.discount.groupsForDiscount;

export const { resetDiscountState } = discountSlice.actions;

export default discountSlice.reducer;
