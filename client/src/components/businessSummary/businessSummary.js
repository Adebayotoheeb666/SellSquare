import React, { useEffect, useMemo, useState } from "react";
import "./businessSummary.scss";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { selectDashboardStats } from "../../redux/features/product/productSlice";
import { selectUser } from "../../redux/features/auth/authSlice";
import dash1 from "../../assets/home/dash1.svg";
import dash2 from "../../assets/home/dash2.svg";
import dash3 from "../../assets/home/dash3.svg";
import dash4 from "../../assets/home/dash4.svg";
import eyeIcon from "../../assets/home/show.svg";
import OurChart from "./Chart";
import useFormatter from "./../../customHook/useFormatter";
import { selectAllProductsArray } from "../../redux/features/product/productCacheSlice";
import {
  fetchBulkExpenses,
  fetchBulkSales,
  selectExpensesArray,
  selectExpensesArrayByYear,
  selectExpensesMetaByYear,
  selectExpensesYearsLoaded,
  selectProductGroupsArray,
  selectSalesArray,
  selectSalesArrayByYear,
  selectSalesMetaByYear,
  selectSalesYearsLoaded,
} from "../../redux/features/dataCache/bulkDataCacheSlice";

// Format Amount
export const formatNumbers = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const BusinessSummary = ({ admin }) => {
  const dispatch = useDispatch();
  const dashboardStats = useSelector(selectDashboardStats);
  const products = useSelector(selectAllProductsArray);
  const sales = useSelector(selectSalesArray);
  const expenses = useSelector(selectExpensesArray);
  const productGroups = useSelector(selectProductGroupsArray);
  const salesYearsLoaded = useSelector(selectSalesYearsLoaded);
  const expensesYearsLoaded = useSelector(selectExpensesYearsLoaded);

  const [isStoreValueVisible, setIsStoreValueVisible] = useState(false);
  const currentUser = useSelector(selectUser);

  const productGroupsById = useMemo(() => {
    const map = {};
    productGroups.forEach((group) => {
      if (group?._id) {
        map[group._id] = group;
      }
    });
    return map;
  }, [productGroups]);

  const topProducts = useMemo(() => {
    const productTotals = new Map();
    const groupTotals = new Map();

    sales.forEach((checkout) => {
      const items = checkout?.items || [];
      items.forEach((item) => {
        const qty = Number(item?.quantity || 0);
        const isGroup =
          Boolean(item?.productIsaGroup) || Boolean(item?.itemGroup);

        if (isGroup) {
          const groupId = item?.itemGroup || item?.groupId;
          if (!groupId) return;
          const existing = groupTotals.get(groupId) || {
            _id: groupId,
            name: "",
            total_sales: 0,
          };
          existing.total_sales += qty;
          groupTotals.set(groupId, existing);
          return;
        }

        const productId = item?.id || item?.productId || item?._id;
        if (!productId) return;
        const existing = productTotals.get(productId) || {
          _id: productId,
          name: item?.name || "",
          total_sales: 0,
        };
        existing.total_sales += qty;
        if (!existing.name && item?.name) {
          existing.name = item.name;
        }
        productTotals.set(productId, existing);
      });
    });

    const topSingles = Array.from(productTotals.values())
      .filter((item) => item?._id)
      .sort((a, b) => b.total_sales - a.total_sales)
      .slice(0, 5);

    const topGroups = Array.from(groupTotals.values())
      .map((item) => {
        const group = productGroupsById[item._id];
        return {
          ...item,
          name: group?.groupName || item.name || "",
        };
      })
      .filter((item) => item?._id)
      .sort((a, b) => b.total_sales - a.total_sales)
      .slice(0, 5);

    return {
      products: topSingles,
      productGroups: topGroups,
    };
  }, [sales, productGroupsById]);

  const lowProducts = useMemo(() => {
    const lowSingles = products
      .filter((product) => !product?.productIsaGroup)
      .map((product) => ({
        _id: product?._id,
        name: product?.name,
        product_quantity: Number(product?.quantity || 0),
      }))
      .filter(
        (product) =>
          product.product_quantity > 0 && product.product_quantity < 5,
      )
      .sort((a, b) => a.product_quantity - b.product_quantity)
      .slice(0, 5);

    const lowGroups = productGroups
      .map((group) => {
        const totalQty = Array.isArray(group?.quantity)
          ? group.quantity.reduce((sum, qty) => sum + Number(qty || 0), 0)
          : 0;
        return {
          _id: group?._id,
          groupName: group?.groupName,
          product_quantity: totalQty,
        };
      })
      .filter(
        (group) => group.product_quantity > 0 && group.product_quantity < 5,
      )
      .sort((a, b) => a.product_quantity - b.product_quantity)
      .slice(0, 5);

    return {
      products: lowSingles,
      productGroups: lowGroups,
    };
  }, [products, productGroups]);

  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const baselineYears = Array.from({ length: 6 }, (_, index) => currentYear - index);
    return Array.from(
      new Set([
        ...baselineYears,
        ...(salesYearsLoaded || []),
        ...(expensesYearsLoaded || []),
      ]),
    ).sort((a, b) => b - a);
  }, [currentYear, salesYearsLoaded, expensesYearsLoaded]);

  const [year, setYear] = useState(() => currentYear);

  const salesForSelectedYear = useSelector(selectSalesArrayByYear(year));
  const expensesForSelectedYear = useSelector(selectExpensesArrayByYear(year));
  const salesMetaForSelectedYear = useSelector(selectSalesMetaByYear(year));
  const expensesMetaForSelectedYear = useSelector(selectExpensesMetaByYear(year));

  // Track whether user has explicitly changed year to avoid auto-fetch on mount.
  // Current-year data is already loaded during bootstrap.
  const userChangedYearRef = React.useRef(false);

  useEffect(() => {
    if (!userChangedYearRef.current) return;

    const selectedYear = Number(year);
    if (!Number.isFinite(selectedYear)) return;

    const hasSalesForYear =
      Number(salesMetaForSelectedYear?.loaded || 0) > 0 ||
      Boolean(salesMetaForSelectedYear?.lastFetchedAt);
    const hasExpensesForYear =
      Number(expensesMetaForSelectedYear?.loaded || 0) > 0 ||
      Boolean(expensesMetaForSelectedYear?.lastFetchedAt);

    if (!salesMetaForSelectedYear?.isLoading && !hasSalesForYear) {
      dispatch(fetchBulkSales({ year: selectedYear }));
    }

    if (!expensesMetaForSelectedYear?.isLoading && !hasExpensesForYear) {
      dispatch(fetchBulkExpenses({ year: selectedYear }));
    }
  }, [
    dispatch,
    year,
    salesMetaForSelectedYear?.isLoading,
    salesMetaForSelectedYear?.loaded,
    salesMetaForSelectedYear?.lastFetchedAt,
    expensesMetaForSelectedYear?.isLoading,
    expensesMetaForSelectedYear?.loaded,
    expensesMetaForSelectedYear?.lastFetchedAt,
  ]);

  useEffect(() => {
    if (!availableYears.includes(Number(year))) {
      setYear(availableYears[0]);
    }
  }, [availableYears, year]);

  const handleYearChange = (e) => {
    userChangedYearRef.current = true;
    setYear(e.target.value);
  };

  const salesByYear = useMemo(() => {
    const selectedYear = Number(year);
    if (!Number.isFinite(selectedYear)) {
      return { data: [] };
    }

    const salesByMonth = new Map();
    salesForSelectedYear.forEach((checkout) => {
      const createdAt = checkout?.createdAt;
      if (!createdAt) return;
      const date = new Date(createdAt);
      if (date.getFullYear() !== selectedYear) return;
      const month = date.getMonth() + 1;

      const entry = salesByMonth.get(month) || {
        totalSales: 0,
        totalProfit: 0,
      };

      (checkout?.items || []).forEach((item) => {
        const qty = Number(item?.quantity || 0);
        const price = Number(item?.price || 0);
        const cost = Number(item?.cost || 0);
        entry.totalSales += qty * price;
        entry.totalProfit += qty * (price - cost);
      });

      salesByMonth.set(month, entry);
    });

    const expensesByMonth = new Map();
    expensesForSelectedYear.forEach((expense) => {
      const dateValue = expense?.date || expense?.createdAt;
      if (!dateValue) return;
      const date = new Date(dateValue);
      if (date.getFullYear() !== selectedYear) return;
      const month = date.getMonth() + 1;
      const current = expensesByMonth.get(month) || 0;
      expensesByMonth.set(month, current + Number(expense?.amount || 0));
    });

    const months = new Set([
      ...Array.from(salesByMonth.keys()),
      ...Array.from(expensesByMonth.keys()),
    ]);

    const mergedData = Array.from(months)
      .map((month) => {
        const salesEntry = salesByMonth.get(month) || {
          totalSales: 0,
          totalProfit: 0,
        };
        const totalExpenses = expensesByMonth.get(month) || 0;
        return {
          _id: { year: selectedYear, month },
          totalSales: salesEntry.totalSales,
          totalProfit: salesEntry.totalProfit,
          totalExpenses,
          grossProfit: salesEntry.totalProfit - totalExpenses,
        };
      })
      .sort((a, b) => a._id.month - b._id.month);

    return { data: mergedData };
  }, [salesForSelectedYear, expensesForSelectedYear, year]);

  const filteredTopProducts = topProducts.products?.filter((pr) => pr._id);
  const filteredProductGroups = topProducts.productGroups?.filter(
    (pr) => pr._id,
  );

  const derivedDashboardStats = useMemo(() => {
    const categories = new Set();
    let totalStoreValueByPrice = 0;
    let totalStoreValueByCost = 0;
    let outOfStockSingle = 0;

    products.forEach((product) => {
      const qty = Number(product?.quantity ?? 0);
      const price = Number(product?.price ?? 0);
      const cost = Number(product?.cost ?? 0);
      if (product?.category) categories.add(product.category);
      totalStoreValueByPrice += price * qty;
      totalStoreValueByCost += cost * qty;
      if (qty <= 0) outOfStockSingle += 1;
    });

    const outOfStockGroup = productGroups.filter((group) => {
      const totalQty = Array.isArray(group?.quantity)
        ? group.quantity.reduce((sum, qty) => sum + Number(qty || 0), 0)
        : 0;
      return totalQty <= 0;
    }).length;

    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + Number(expense?.amount || 0),
      0,
    );

    return {
      totalProducts: products.length,
      totalCategories: categories.size,
      outOfStock: {
        singleProducts: outOfStockSingle,
        groupProducts: outOfStockGroup,
        total: outOfStockSingle + outOfStockGroup,
      },
      storeValue: {
        byPrice: totalStoreValueByPrice,
        byCost: totalStoreValueByCost,
      },
      totalExpenses,
    };
  }, [products, productGroups, expenses]);

  const effectiveDashboardStats = useMemo(() => {
    if (
      products.length > 0 ||
      productGroups.length > 0 ||
      expenses.length > 0
    ) {
      return derivedDashboardStats;
    }
    return dashboardStats;
  }, [
    dashboardStats,
    derivedDashboardStats,
    expenses.length,
    productGroups.length,
    products.length,
  ]);

  const toggleStoreValueVisibility = () => {
    setIsStoreValueVisible((prev) => !prev);
  };

  const { formatter } = useFormatter();

  return (
    <div className="store-summary items">
      <div className="item info_card total_products">
        <img src={dash1} alt="total products" />
        <h3>{effectiveDashboardStats.totalProducts || 0}</h3>
        <p>Total Products</p>
      </div>

      <div className="item info_card total_category">
        <img src={dash2} alt="total category" />
        <h3>{effectiveDashboardStats.totalCategories || 0}</h3>
        <p>Total Categories</p>
      </div>

      <div className="item sales_graph">
        <div className="chart-container-header">
          <h1>Sales & Profit</h1>
          <select onChange={handleYearChange} value={year}>
            {availableYears.map((yr, index) => {
              return (
                <option key={index} value={yr}>
                  {yr}
                </option>
              );
            })}
          </select>
        </div>
        <div className="graph_container">
          {admin || currentUser?.permissions?.seeBusinessFinances ? (
            <OurChart sales={salesByYear} />
          ) : null}
        </div>
      </div>

      <div className="item top_selling">
        <div className="item-header">
          <h3>Top Selling Product</h3>
          <Link to="/dashboard">See All</Link>
        </div>
        <div className="item-body">
          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Name</th>
                <th>Sold Quantity</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="3">
                  <strong>Single Products</strong>
                </td>
              </tr>
              {filteredTopProducts && filteredTopProducts.length > 0 ? (
                filteredTopProducts.map((product, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{product?.name}</td>
                    <td>{product?.total_sales}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3">No top-selling Single Products available</td>
                </tr>
              )}

              <tr>
                <td colSpan="3">
                  <strong>Group Products</strong>
                </td>
              </tr>
              {filteredProductGroups && filteredProductGroups.length > 0 ? (
                filteredProductGroups.map((product, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{product?.name}</td>
                    <td>{product?.total_sales}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3">No top-selling Group Products available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="item info_card out_of_stock">
        <Link to="/inventory/out-of-stock">
          <img src={dash3} alt="stock_out" />
          <p className="card-title">Out of Stock Products</p>
          <div className="out-of-stock-values">
            <div className="value">
              <h3>{effectiveDashboardStats.outOfStock?.singleProducts || 0}</h3>
              <p>Single</p>
            </div>
            <div className="value-divider"></div>
            <div className="value">
              <h3>{effectiveDashboardStats.outOfStock?.groupProducts || 0}</h3>
              <p>Groups</p>
            </div>
          </div>
        </Link>
      </div>

      <div
        className="item info_card store_value"
        onClick={toggleStoreValueVisibility}
      >
        <img src={dash4} alt="total products" />
        <p className="card-title">Total Store Value</p>
        <div className="store-values">
          {admin || currentUser?.permissions?.seeBusinessFinances ? (
            <>
              <div className="value">
                <h3>
                  {isStoreValueVisible ? (
                    `${formatter(effectiveDashboardStats.storeValue?.byPrice || 0)}`
                  ) : (
                    <img src={eyeIcon} alt="show value" className="eye-icon" />
                  )}
                </h3>
                <p>Selling Price</p>
              </div>
              <div className="value-divider"></div>
              <div className="value">
                <h3>
                  {isStoreValueVisible ? (
                    `${formatter(effectiveDashboardStats.storeValue?.byCost || 0)}`
                  ) : (
                    <img src={eyeIcon} alt="show value" className="eye-icon" />
                  )}
                </h3>
                <p>Cost Price</p>
              </div>
            </>
          ) : (
            <h3>Unavailable</h3>
          )}
        </div>
      </div>

      <div className="item low_products">
        <div className="item-header">
          <h3>Low quantity Products</h3>
          <Link to="/dashboard">See All</Link>
        </div>
        <div className="item-body">
          <table>
            <thead>
              <tr>
                <th>product</th>
                <th>Remaining Quantity</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="2">
                  <strong>Single Products</strong>
                </td>
              </tr>
              {lowProducts && lowProducts.products?.length > 0 ? (
                lowProducts.products.map((product, index) => (
                  <tr key={index}>
                    <td>{product.name}</td>
                    <td>{product.product_quantity}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2">No low item(s) for Single Products</td>
                </tr>
              )}

              <tr>
                <td colSpan="2">
                  <strong>Group Products</strong>
                </td>
              </tr>
              {lowProducts && lowProducts.productGroups?.length > 0 ? (
                lowProducts.productGroups.map((product, index) => (
                  <tr key={index}>
                    <td>{product.groupName}</td>
                    <td>{product.product_quantity}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2">No low item(s) for Group Products</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BusinessSummary;
