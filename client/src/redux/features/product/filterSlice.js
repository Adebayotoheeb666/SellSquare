import { createSlice } from "@reduxjs/toolkit";
import moment from "moment";

const initialState = {
  filteredProducts: [],
  filteredSales: [],
  filteredNewSales: [],
  filteredProductGroups: [],
  filteredProductsOutOfStock: [],
  filteredProductGroupsOutOfStock: [],
  filteredCustomers: [],
  filteredIncompletePayments: [],
};

const filterSlice = createSlice({
  name: "filter",
  initialState,
  reducers: {
    // Reset filters on logout
    RESET_SESSION(state) {
      return initialState;
    },
    FILTER_PRODUCTS(state, action) {
      const { products, search, filters } = action.payload;

      let tempProducts = products?.filter(
        (product) =>
          product?.name?.toLowerCase().includes(search.toLowerCase()) ||
          product?.category?.toLowerCase().includes(search.toLowerCase()) ||
          product?.sku?.includes(search.toLowerCase())
      );

      // Apply category filter
      if (filters?.category && filters.category.length > 0) {
        tempProducts = tempProducts.filter((product) =>
          filters.category.includes(product.category)
        );
      }

      // Apply warehouse filter
      if (filters?.warehouse && filters.warehouse.length > 0) {
        tempProducts = tempProducts.filter((product) =>
          filters.warehouse.includes(product.warehouse)
        );
      }

      // Apply price range filter
      if (filters?.priceRange && filters.priceRange.length > 0) {
        tempProducts = tempProducts.filter((product) => {
          const price = parseFloat(product.price) || 0;
          return filters.priceRange.some((range) => {
            switch (range) {
              case "0-1000":
                return price >= 0 && price <= 1000;
              case "1000-5000":
                return price > 1000 && price <= 5000;
              case "5000-10000":
                return price > 5000 && price <= 10000;
              case "10000+":
                return price > 10000;
              default:
                return true;
            }
          });
        });
      }

      state.filteredProducts = tempProducts;
    },
    FILTER_SALES(state, action) {
      const { sales, search } = action.payload;

      const tempProducts = sales.filter(
        (sale) =>
          sale.name.toLowerCase().includes(search.toLowerCase()) ||
          sale.category.toLowerCase().includes(search.toLowerCase()) ||
          sale.quantity.includes(search.toLowerCase())
      );

      state.filteredSales = tempProducts;
    },
    FILTER_NEW_SALES(state, action) {
      const { checkouts, search, filters } = action.payload;

      let tempProducts = checkouts.filter(
        (sale) =>
          sale.items.some((item) =>
            item.name.toLowerCase().includes(search.toLowerCase())
          ) ||
          sale.customer.name.toLowerCase().includes(search.toLowerCase()) ||
          sale.orderId?.toLowerCase().includes(search.toLowerCase())
      );

      // Apply category filter if any items match
      if (filters?.category && filters.category.length > 0) {
        tempProducts = tempProducts.filter((sale) =>
          sale.items.some((item) => filters.category.includes(item.category))
        );
      }

      // Apply warehouse filter if any items match
      if (filters?.warehouse && filters.warehouse.length > 0) {
        tempProducts = tempProducts.filter((sale) =>
          sale.items.some((item) => filters.warehouse.includes(item.warehouse))
        );
      }

      // Apply price range filter
      if (filters?.priceRange && filters.priceRange.length > 0) {
        tempProducts = tempProducts.filter((sale) =>
          sale.items.some((item) => {
            const price = parseFloat(item.price) || 0;
            return filters.priceRange.some((range) => {
              switch (range) {
                case "0-1000":
                  return price >= 0 && price <= 1000;
                case "1000-5000":
                  return price > 1000 && price <= 5000;
                case "5000-10000":
                  return price > 5000 && price <= 10000;
                case "10000+":
                  return price > 10000;
                default:
                  return true;
              }
            });
          })
        );
      }

      state.filteredNewSales = tempProducts;
    },
    FILTER_CUSTOMERS(state, action) {
      const { customers, search } = action.payload;

      // console.log("checkouts", customers);
      const tempProducts = customers.filter((customer) =>
        customer.name.toLowerCase().includes(search.toLowerCase())
      );

      state.filteredCustomers = tempProducts;
    },
    FILTER_OUT_OF_STOCK_PRODUCTS(state, action) {
      const { productsOutOfStock, search, filters } = action.payload;

      let tempProducts = productsOutOfStock.filter((productOutOfStock) => {
        return (
          productOutOfStock.name.toLowerCase().includes(search.toLowerCase()) ||
          productOutOfStock.category
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          productOutOfStock.quantity.toString().includes(search.toLowerCase())
        );
      });

      // Apply category filter
      if (filters?.category && filters.category.length > 0) {
        tempProducts = tempProducts.filter((product) =>
          filters.category.includes(product.category)
        );
      }

      // Apply warehouse filter
      if (filters?.warehouse && filters.warehouse.length > 0) {
        tempProducts = tempProducts.filter((product) =>
          filters.warehouse.includes(product.warehouse)
        );
      }

      // Apply price range filter
      if (filters?.priceRange && filters.priceRange.length > 0) {
        tempProducts = tempProducts.filter((product) => {
          const price = parseFloat(product.price) || 0;
          return filters.priceRange.some((range) => {
            switch (range) {
              case "0-1000":
                return price >= 0 && price <= 1000;
              case "1000-5000":
                return price > 1000 && price <= 5000;
              case "5000-10000":
                return price > 5000 && price <= 10000;
              case "10000+":
                return price > 10000;
              default:
                return true;
            }
          });
        });
      }

      state.filteredProductsOutOfStock = tempProducts;
    },
    FILTER_OUT_OF_STOCK_PRODUCT_GROUPS(state, action) {
      const { productGroupOutOfStock, search, filters } = action.payload;

      let tempProducts = productGroupOutOfStock.filter(
        (productGroup) =>
          productGroup.groupName.toLowerCase().includes(search.toLowerCase()) ||
          productGroup.category.toLowerCase().includes(search.toLowerCase())
      );

      // Apply category filter
      if (filters?.category && filters.category.length > 0) {
        tempProducts = tempProducts.filter((product) =>
          filters.category.includes(product.category)
        );
      }

      // Apply warehouse filter
      if (filters?.warehouse && filters.warehouse.length > 0) {
        tempProducts = tempProducts.filter((product) =>
          filters.warehouse.includes(product.warehouse)
        );
      }

      state.filteredProductGroupsOutOfStock = tempProducts;
    },
    FILTER_INCOMPLETE_PAYMENTS(state, action) {
      const { incompletePayments, search, filters } = action.payload;

      let tempProducts = incompletePayments.filter(
        (incomplete) =>
          incomplete.items.some((item) =>
            item.name.toLowerCase().includes(search.toLowerCase())
          ) ||
          incomplete.customer.name
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          incomplete.orderId?.toLowerCase().includes(search.toLowerCase())
      );

      // Apply category filter if any items match
      if (filters?.category && filters.category.length > 0) {
        tempProducts = tempProducts.filter((incomplete) =>
          incomplete.items.some((item) =>
            filters.category.includes(item.category)
          )
        );
      }

      // Apply warehouse filter if any items match
      if (filters?.warehouse && filters.warehouse.length > 0) {
        tempProducts = tempProducts.filter((incomplete) =>
          incomplete.items.some((item) =>
            filters.warehouse.includes(item.warehouse)
          )
        );
      }

      // Apply price range filter
      if (filters?.priceRange && filters.priceRange.length > 0) {
        tempProducts = tempProducts.filter((incomplete) =>
          incomplete.items.some((item) => {
            const price = parseFloat(item.price) || 0;
            return filters.priceRange.some((range) => {
              switch (range) {
                case "0-1000":
                  return price >= 0 && price <= 1000;
                case "1000-5000":
                  return price > 1000 && price <= 5000;
                case "5000-10000":
                  return price > 5000 && price <= 10000;
                case "10000+":
                  return price > 10000;
                default:
                  return true;
              }
            });
          })
        );
      }

      // console.log(tempProducts, " : TempfilteredSales ");
      state.filteredIncompletePayments = tempProducts;
    },
    FILTER_PRODUCT_GROUPS(state, action) {
      const { productGroups, search, filters } = action.payload;

      let tempProducts = productGroups?.filter((productGroup) => {
        const format = "DD-MM-YYYY h:mmA";
        const formattedDate = moment(productGroup.createdAt).format(format);

        return (
          productGroup.groupName.toLowerCase().includes(search.toLowerCase()) ||
          productGroup.category.toLowerCase().includes(search.toLowerCase()) ||
          formattedDate.includes(search)
        );
      });

      // Apply category filter
      if (filters?.category && filters.category.length > 0) {
        tempProducts = tempProducts.filter((product) =>
          filters.category.includes(product.category)
        );
      }

      // Apply warehouse filter
      if (filters?.warehouse && filters.warehouse.length > 0) {
        tempProducts = tempProducts.filter((product) =>
          filters.warehouse.includes(product.warehouse)
        );
      }

      state.filteredProductGroups = tempProducts;
    },
  },
});

export const {
  FILTER_PRODUCTS,
  FILTER_SALES,
  FILTER_NEW_SALES,
  FILTER_OUT_OF_STOCK_PRODUCTS,
  FILTER_OUT_OF_STOCK_PRODUCT_GROUPS,
  FILTER_CUSTOMERS,
  FILTER_INCOMPLETE_PAYMENTS,
  FILTER_PRODUCT_GROUPS,
  RESET_SESSION,
} = filterSlice.actions;

export const selectFilteredPoducts = (state) => state.filter.filteredProducts;
export const selectFilteredSales = (state) => state.filter.filteredSales;
export const selectFilteredNewSales = (state) => state.filter.filteredNewSales;
export const selectFilteredProductsOutOfStock = (state) =>
  state.filter.filteredProductsOutOfStock;
export const selectFilteredProductGroupOutOfStock = (state) =>
  state.filter.filteredProductGroupsOutOfStock;
export const selectFilteredProductGroups = (state) =>
  state.filter.filteredProductGroups;
export const selectFilteredFulfilments = (state) =>
  state.filter.filteredIncompletePayments;
export const selectFilteredCustomers = (state) =>
  state.filter.filteredCustomers;

export default filterSlice.reducer;
