# Redux Data Architecture

## Overview

This document describes the data flow architecture in the inventory application's Redux store. Following these patterns ensures that `items.forEach is not a function` errors never occur and that data flows correctly from backend to UI.

## Core Principles

### 1. Redux State Always Contains Raw Arrays

**CRITICAL**: Every collection in Redux state MUST be a raw array, never:

- A paginated response object (`{ items: [], pagination: {} }`)
- A backend envelope (`{ data: [], meta: {} }`)
- A websocket payload structure
- Any other object shape

```javascript
// ✅ CORRECT: State contains raw arrays
state.products = [{ _id: '1', name: 'Product A' }, ...]
state.checkouts = [{ _id: '1', items: [...] }, ...]
state.customers = [{ _id: '1', name: 'John' }, ...]

// ❌ WRONG: State contains objects
state.products = { products: [...], pagination: {...} }
state.checkouts = { checkOuts: [...], total: 123 }
```

### 2. Reducers Extract Arrays from Payloads

Every reducer that handles async thunk responses MUST use the `ensureArray()` helper to extract arrays from backend responses:

```javascript
.addCase(getProducts.fulfilled, (state, action) => {
  // CRITICAL: Always extract array, never store raw payload
  const productsArray = ensureArray(action.payload, 'products', 'items');
  state.products = productsArray;

  // Pagination metadata is stored SEPARATELY
  if (action.payload && typeof action.payload === 'object') {
    state.productsPagination = {
      currentPage: action.payload.currentPage || 1,
      // ...
    };
  }
})
```

### 3. Hooks Read from State, Never Normalize

The `useStatePagination` hooks read from Redux state and apply client-side pagination. They include a defensive `ensureArray()` check, but this should NEVER need to extract data from objects:

```javascript
// In hooks - defensive check only
const safeItems = ensureArray(productsArray, "state.product.products");

// If the warning fires, a REDUCER is broken, not the hook
// Fix the reducer at the source, don't patch in the hook
```

### 4. Backend Calls Only on Bootstrap or Mutations

**Architecture**: Navigation NEVER triggers backend requests. Data flows as:

1. **Bootstrap** (once per session): Load all bulk data
2. **Redux Storage**: Keep all data in normalized state
3. **Client-side Pagination**: Hooks slice arrays for UI display
4. **Mutations**: Create/Update/Delete operations refresh affected data
5. **Realtime**: WebSocket events update individual items in-place

## Data Sources

| Collection      | Redux Location                   | Bootstrap Action            |
| --------------- | -------------------------------- | --------------------------- |
| Products        | `state.product.products`         | `fetchAllProductsForSearch` |
| Product Groups  | `state.product.allProductGroups` | `fetchBulkProductGroups`    |
| Sales/Checkouts | `state.cart.checkouts`           | `fetchBulkSales`            |
| Customers       | `state.cart.customers`           | `fetchBulkCustomers`        |
| Expenses        | `state.expense.expenses`         | `fetchBulkExpenses`         |
| Activities      | `state.activities.activities`    | `fetchBulkActivities`       |
| Fulfilments     | `state.cart.incompletePayments`  | `fetchBulkFulfilments`      |

## The `ensureArray` Helper

Every slice that stores collections has an `ensureArray` helper that:

1. Returns input unchanged if already an array
2. Extracts from common envelope patterns if input is an object
3. Returns empty array for null/undefined
4. Logs warnings for unexpected shapes

```javascript
const ensureArray = (payload, ...fieldNames) => {
  if (Array.isArray(payload)) return payload;
  if (payload == null) return [];
  if (typeof payload !== "object") return [];

  // Try specified field names
  for (const field of fieldNames) {
    if (Array.isArray(payload[field])) return payload[field];
  }

  // Try common patterns
  const commonFields = ["items", "data", "results", "records"];
  for (const field of commonFields) {
    if (Array.isArray(payload[field])) return payload[field];
  }

  console.warn("Could not extract array from payload:", Object.keys(payload));
  return [];
};
```

## Debugging Data Flow Issues

If you see `items.forEach is not a function`:

1. **Check the console** - The hooks log warnings when they detect objects instead of arrays
2. **Find the source** - The warning includes the state path (e.g., `state.cart.checkouts`)
3. **Fix the reducer** - The reducer handling the async thunk for that data is storing wrong shape
4. **Verify backend response** - Ensure backend returns expected envelope format

## Realtime Updates

WebSocket/SSE events update Redux safely:

1. Events contain single items (not full arrays)
2. Reducers use array methods to merge (`unshift`, `findIndex`, `filter`)
3. Safety checks prevent operating on non-arrays
4. Cache invalidation flags trigger re-fetch only when needed

```javascript
// Safe realtime update pattern
addProduct(state, action) {
  // Safety check
  if (!Array.isArray(state.products)) {
    console.error('BUG: state.products is not an array');
    state.products = [];
  }

  const newProduct = action.payload;
  if (newProduct?._id) {
    const exists = state.products.some(p => p._id === newProduct._id);
    if (!exists) {
      state.products.unshift(newProduct);
    }
  }
}
```

## Common Mistakes to Avoid

### ❌ Don't Store Raw Payload

```javascript
// WRONG
.addCase(getData.fulfilled, (state, action) => {
  state.items = action.payload; // Could be { items: [], meta: {} }
})
```

### ❌ Don't Normalize in Hooks

```javascript
// WRONG - Hook shouldn't need to do this
const items = useSelector((state) =>
  Array.isArray(state.data.items)
    ? state.data.items
    : state.data.items?.data || []
);
```

### ❌ Don't Fetch on Navigation

```javascript
// WRONG - useEffect fetching on mount
useEffect(() => {
  dispatch(getData()); // Runs on every navigation to this page
}, []);
```

### ✅ Do Use Cached Data

```javascript
// RIGHT - Check cache before fetching
useEffect(() => {
  if (hasFetchedRef.current) return;
  if (data?.length > 0) return; // Already have data

  hasFetchedRef.current = true;
  dispatch(getData());
}, [data, dispatch]);
```

## Testing Data Flow

To verify the architecture is working:

1. Login to the app
2. Open browser DevTools Console
3. Navigate between pages
4. You should see:
   - `[DataBootstrap] Starting session bootstrap...` once
   - `[BulkCache] Loaded X/Y items` for each data type
   - NO repeated fetch logs on navigation
   - NO `BUG DETECTED` warnings from hooks

If you see warnings, check the reducer for the affected state path.
