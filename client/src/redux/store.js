import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../redux/features/auth/authSlice";
import buyerAuthReducer from "../redux/features/buyerAuth/buyerAuthSlice";
import productReducer from "../redux/features/product/productSlice";
import productCacheReducer from "../redux/features/product/productCacheSlice";
import activitiesReducer from "../redux/features/activities/activitySlice";
import filterReducer from "../redux/features/product/filterSlice";
import cartReducer from "./features/cart/cartSlice";
import expenseReducer from "./features/expense/expenseSlice";
import realtimeReducer from "./features/realtime/realtimeSlice";
import dataCacheReducer from "./features/dataCache/dataCacheSlice";
import bulkDataCacheReducer from "./features/dataCache/bulkDataCacheSlice";
import adminReducer from "./features/admin/adminSlice";
import discountReducer from "./features/discount/discountSlice";
import integrationReducer from "./features/integration/integrationSlice";
import automationReducer from "./features/automation/automationSlice";
import kycReducer from "./features/kyc/kycSlice";
import buyerOrdersReducer from "./features/buyerOrders/buyerOrdersSlice";
import buyerWalletReducer from "./features/buyerWallet/buyerWalletSlice";



export const store = configureStore({
  reducer: {
    auth: authReducer,
    buyerAuth: buyerAuthReducer,
    product: productReducer,
    productCache: productCacheReducer,
    bulkDataCache: bulkDataCacheReducer,
    sale: productReducer,
    allProductGroups: productReducer,
    productsOutOfStock: productReducer,
    productGroupOutOfStock: productReducer,
    draft: productReducer,
    carts: cartReducer,
    checkouts: cartReducer,
    allCheckouts: cartReducer,
    customers: cartReducer,
    salesByYear: productReducer,
    topProducts: productReducer,
    lowProducts: productReducer,
    activities: activitiesReducer,
    cart: cartReducer,
    sales: productReducer,
    filter: filterReducer,
    expense: expenseReducer,
    discount: discountReducer,
    realtime: realtimeReducer,
    dataCache: dataCacheReducer,
    admin: adminReducer,
    integration: integrationReducer,
    automation: automationReducer,
    kyc: kycReducer,
    buyerOrders: buyerOrdersReducer,
    buyerWallet: buyerWalletReducer,

  },
});
