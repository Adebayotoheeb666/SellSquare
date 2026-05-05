import { LOGOUT } from "./features/auth/authSlice";
import { RESET_SESSION as resetCart } from "./features/cart/cartSlice";
import { RESET_SESSION as resetDataCache } from "./features/dataCache/dataCacheSlice";
import { RESET_SESSION as resetBulkDataCache } from "./features/dataCache/bulkDataCacheSlice";
import { RESET_SESSION as resetFilters } from "./features/product/filterSlice";
import { resetProductCache } from "./features/product/productCacheSlice";
import {
  clearAccessToken,
  clearLegacyPersistedCache,
} from "../utils/authSession";

export const resetSessionState = async (dispatch) => {
  dispatch(LOGOUT());
  dispatch(resetCart());
  dispatch(resetDataCache());
  dispatch(resetBulkDataCache());
  dispatch(resetFilters());
  dispatch(resetProductCache());

  localStorage.removeItem("cartItems");
  localStorage.removeItem("productCache");
  localStorage.removeItem("businessData");
  clearAccessToken();
  clearLegacyPersistedCache();
};
