import React from "react";
import { useSelector } from "react-redux";
import ProductList from "../../../components/product/productList/ProductList";
import {
  selectIsLoggedIn,
  selectLoggedInBusinessOwner,
} from "../../../redux/features/auth/authSlice";
// import SalesList from "../../../components/product/salesList/salesList";
import OutOfStockList from "../../../components/product/outOfStockList/outOfStockList";
import Sales from "../../../components/product/salesList/Sales";
import { useParams } from "react-router-dom";
import ProductGroupList from "../../../components/product/productGroupList/ProductGroupList";

const Inventory = () => {
  const admin = useSelector(selectLoggedInBusinessOwner);

  const { id } = useParams();

  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { products, isLoading } = useSelector(
    (state) => state.product
  );

  const { isCartLoading } = useSelector((state) => state.checkouts);

  // Note: Data fetching is handled by individual child components
  // Each component uses state-driven pagination from bulk-loaded cache

  return (
    <div>
      {id && (
        <div>
          {id === "sales" ? (
            <Sales
              admin={admin}
            />
          ) : (
            ""
          )}
        </div>
      )}
      {id && (
        <div>
          {id === "out-of-stock" ? (
            <OutOfStockList
              admin={admin}
            />
          ) : (
            ""
          )}
        </div>
      )}
      {id && (
        <div>
          {id === "product-groups" ? (
            <ProductGroupList
              admin={admin}
            />
          ) : (
            ""
          )}
        </div>
      )}
      {!id || id === undefined ? (
        <ProductList
          products={products}
          isLoading={isLoading || isCartLoading}
          admin={admin}
          activeRoute={true}
        />
      ) : (
        ""
      )}
    </div>
  );
};

export default Inventory;
