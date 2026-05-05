import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import expenseService from "../../../services/expenseService";
import { toast } from "sonner";

/**
 * Safely extract array from any backend payload.
 * CRITICAL: This ensures Redux state ALWAYS contains arrays, never objects.
 */
const ensureArray = (payload, ...fieldNames) => {
  if (Array.isArray(payload)) return payload;
  if (payload == null) return [];
  if (typeof payload !== "object") return [];

  for (const field of fieldNames) {
    if (Array.isArray(payload[field])) return payload[field];
  }

  const commonFields = ["items", "data", "results", "records"];
  for (const field of commonFields) {
    if (Array.isArray(payload[field])) return payload[field];
  }

  return [];
};

const initialState = {
  expenses: [],
  expense: null,
  expenseStats: {
    totalExpenses: 0,
    expenseCount: 0,
    byCategory: [],
  },
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
  // Pagination metadata
  expensesPagination: {
    currentPage: 1,
    totalPages: 1,
    total: 0,
    totalAmount: 0,
    hasMore: false,
  },
};

// Add expense
export const addExpense = createAsyncThunk(
  "expense/add",
  async (formData, thunkAPI) => {
    try {
      return await expenseService.addExpense(formData);
    } catch (error) {
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

// Get all expenses
export const getExpenses = createAsyncThunk(
  "expense/getAll",
  async ({ page, limit, filters }, thunkAPI) => {
    try {
      return await expenseService.getExpenses(page, limit, filters);
    } catch (error) {
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

// Get single expense
export const getExpense = createAsyncThunk(
  "expense/getOne",
  async (id, thunkAPI) => {
    try {
      return await expenseService.getExpense(id);
    } catch (error) {
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

// Update expense
export const updateExpense = createAsyncThunk(
  "expense/update",
  async ({ id, formData }, thunkAPI) => {
    try {
      return await expenseService.updateExpense(id, formData);
    } catch (error) {
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

// Delete expense
export const deleteExpense = createAsyncThunk(
  "expense/delete",
  async (id, thunkAPI) => {
    try {
      return await expenseService.deleteExpense(id);
    } catch (error) {
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

// Get expense statistics
export const getExpenseStats = createAsyncThunk(
  "expense/getStats",
  async (filters, thunkAPI) => {
    try {
      return await expenseService.getExpenseStats(filters);
    } catch (error) {
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

const expenseSlice = createSlice({
  name: "expense",
  initialState,
  reducers: {
    RESET_EXPENSE(state) {
      state.isError = false;
      state.isSuccess = false;
      state.isLoading = false;
      state.message = "";
    },
    // Realtime update reducers - called by realtimeSlice event handlers
    addExpenseToList(state, action) {
      // Add new expense from realtime event
      const newExpense = action.payload;
      if (!newExpense || !newExpense._id) return;

      // Check if already exists
      const exists = state.expenses.some((exp) => exp._id === newExpense._id);
      if (!exists) {
        state.expenses = [newExpense, ...state.expenses];
        state.expensesPagination.total += 1;
      }
    },
    updateExpenseInList(state, action) {
      // Update existing expense from realtime event
      const updatedExpense = action.payload;
      if (!updatedExpense || !updatedExpense._id) return;

      const index = state.expenses.findIndex(
        (exp) => exp._id === updatedExpense._id,
      );
      if (index !== -1) {
        state.expenses[index] = { ...state.expenses[index], ...updatedExpense };
      }
    },
    removeExpenseFromList(state, action) {
      // Remove deleted expense from realtime event
      const expenseId = action.payload;
      if (!expenseId) return;

      const oldLength = state.expenses.length;
      state.expenses = state.expenses.filter((exp) => exp._id !== expenseId);

      if (state.expenses.length < oldLength) {
        state.expensesPagination.total = Math.max(
          0,
          state.expensesPagination.total - 1,
        );
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Add expense
      .addCase(addExpense.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(addExpense.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.expenses = [action.payload, ...state.expenses];
        toast.success("Expense added successfully");
      })
      .addCase(addExpense.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.error(action.payload);
      })
      // Get all expenses
      .addCase(getExpenses.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getExpenses.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;

        // CRITICAL: Always extract array from response
        const expensesArray = ensureArray(action.payload, "expenses", "data");
        state.expenses = expensesArray;

        // Handle pagination metadata if present
        if (
          action.payload &&
          typeof action.payload === "object" &&
          !Array.isArray(action.payload)
        ) {
          state.expensesPagination = {
            currentPage: action.payload.currentPage || 1,
            totalPages:
              action.payload.totalPages || Math.ceil(expensesArray.length / 10),
            total: action.payload.total || expensesArray.length,
            totalAmount: action.payload.totalAmount || 0,
            hasMore:
              (action.payload.currentPage || 1) <
              (action.payload.totalPages || 1),
          };
        } else {
          state.expensesPagination = {
            currentPage: 1,
            totalPages: Math.ceil(expensesArray.length / 10),
            total: expensesArray.length,
            totalAmount: 0,
            hasMore: false,
          };
        }
      })
      .addCase(getExpenses.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.error(action.payload);
      })
      // Get single expense
      .addCase(getExpense.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getExpense.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.expense = action.payload;
      })
      .addCase(getExpense.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.error(action.payload);
      })
      // Update expense
      .addCase(updateExpense.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateExpense.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        const index = state.expenses.findIndex(
          (exp) => exp._id === action.payload._id,
        );
        if (index !== -1) {
          state.expenses[index] = action.payload;
        }
        toast.success("Expense updated successfully");
      })
      .addCase(updateExpense.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.error(action.payload);
      })
      // Delete expense
      .addCase(deleteExpense.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteExpense.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        toast.success("Expense deleted successfully");
      })
      .addCase(deleteExpense.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        toast.error(action.payload);
      })
      // Get expense statistics
      .addCase(getExpenseStats.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getExpenseStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.expenseStats = action.payload;
      })
      .addCase(getExpenseStats.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const {
  RESET_EXPENSE,
  addExpenseToList,
  updateExpenseInList,
  removeExpenseFromList,
} = expenseSlice.actions;

export const selectExpenses = (state) => state.expense.expenses;
export const selectExpense = (state) => state.expense.expense;
export const selectExpenseStats = (state) => state.expense.expenseStats;
export const selectExpensesPagination = (state) =>
  state.expense.expensesPagination;

export default expenseSlice.reducer;
