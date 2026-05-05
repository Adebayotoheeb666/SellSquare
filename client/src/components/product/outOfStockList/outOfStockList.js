import React, { useEffect, useState, useMemo, useCallback } from "react";
import { SpinnerImg } from "../../loader/Loader";
import "../productList/productList.scss";
import { confirmAlert } from "react-confirm-alert";
import { useDispatch, useSelector } from "react-redux";
import {
  deleteProduct,
  selectFilterOptions,
} from "../../../redux/features/product/productSlice";
import ReactPaginate from "react-paginate";
import "react-confirm-alert/src/react-confirm-alert.css";
import { Link, useSearchParams } from "react-router-dom";
import deleteIcon from "../../../assets/home/delete-icon.svg";
import editIcon from "../../../assets/home/edit-icon.svg";
import InventoryHeader from "../../inventoryHeader/InventoryHeader";
import { debounce } from "../../../utils/debounce";
import {
  invalidateBulkCache,
  fetchBulkOutOfStock,
  selectOutOfStockProductsArray,
  selectOutOfStockGroupsArray,
} from "../../../redux/features/dataCache/bulkDataCacheSlice";

const OutOfStockList = ({ admin }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const outOfStockProducts = useSelector(selectOutOfStockProductsArray);
  const outOfStockGroups = useSelector(selectOutOfStockGroupsArray);
  const isOutOfStockLoading = useSelector(
    (state) =>
      state.bulkDataCache.outOfStock.products.meta?.isLoading ||
      state.bulkDataCache.outOfStock.productGroups.meta?.isLoading ||
      false,
  );

  // Initialize from URL params
  const [search, setSearch] = useState(searchParams.get("search") || "");
  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categoryFilter, setCategoryFilter] = useState(
    searchParams.get("category") ? searchParams.get("category").split(",") : [],
  );
  const [priceRangeFilter, setPriceRangeFilter] = useState(
    searchParams.get("priceRange")
      ? searchParams.get("priceRange").split(",")
      : [],
  );
  const [warehouseFilter, setWarehouseFilter] = useState(
    searchParams.get("warehouse")
      ? searchParams.get("warehouse").split(",")
      : [],
  );

  // Memoize filters object to prevent unnecessary re-renders
  const filters = useMemo(
    () => ({
      category: categoryFilter,
      priceRange: priceRangeFilter,
      warehouse: warehouseFilter,
    }),
    [categoryFilter, priceRangeFilter, warehouseFilter],
  );

  const [showProducts, setShowProducts] = useState(true);
  const [showProductGroups, setShowProductGroups] = useState(true);

  const filterOptions = useSelector(selectFilterOptions);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      debouncedSearch ||
      categoryFilter.length > 0 ||
      priceRangeFilter.length > 0 ||
      warehouseFilter.length > 0
    );
  }, [debouncedSearch, categoryFilter, priceRangeFilter, warehouseFilter]);

  const productsOutOfStock = useMemo(
    () => (Array.isArray(outOfStockProducts) ? outOfStockProducts : []),
    [outOfStockProducts],
  );

  const productGroupOutOfStock = useMemo(
    () => (Array.isArray(outOfStockGroups) ? outOfStockGroups : []),
    [outOfStockGroups],
  );

  // Client-side filtering
  const filteredOutOfStock = useMemo(() => {
    if (!hasActiveFilters)
      return showProducts ? productsOutOfStock : productGroupOutOfStock;

    const dataToFilter = showProducts
      ? productsOutOfStock
      : productGroupOutOfStock;
    return dataToFilter.filter((item) => {
      // Search filter
      const matchesSearch =
        !debouncedSearch ||
        item.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        item.category?.toLowerCase().includes(debouncedSearch.toLowerCase());

      // Category filter
      const matchesCategory =
        categoryFilter.length === 0 || categoryFilter.includes(item.category);

      // Warehouse filter
      const matchesWarehouse =
        warehouseFilter.length === 0 ||
        warehouseFilter.includes(item.warehouse);

      return matchesSearch && matchesCategory && matchesWarehouse;
    });
  }, [
    productsOutOfStock,
    productGroupOutOfStock,
    showProducts,
    hasActiveFilters,
    debouncedSearch,
    categoryFilter,
    warehouseFilter,
  ]);

  // Client-side pagination
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOutOfStock.slice(start, start + itemsPerPage);
  }, [filteredOutOfStock, currentPage, itemsPerPage]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filteredOutOfStock.length / itemsPerPage));
  }, [filteredOutOfStock.length, itemsPerPage]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const shortenText = (text = "", n) =>
    String(text).length > n
      ? String(text).substring(0, n).concat("...")
      : String(text);

  // Filter options are loaded during bootstrap (session-scoped data)
  // No component-level fetch needed - they're globally owned by Layout
  // The getFilterOptions thunk has a built-in condition to prevent duplicate fetches

  // Debounce search input
  const debouncedSetSearch = useCallback(
    debounce((val) => setDebouncedSearch(val), 400),
    [],
  );

  useEffect(() => {
    debouncedSetSearch(search);
  }, [search, debouncedSetSearch]);

  // Update URL params only after debounce
  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.category.length > 0)
      params.category = filters.category.join(",");
    if (filters.priceRange.length > 0)
      params.priceRange = filters.priceRange.join(",");
    if (filters.warehouse.length > 0)
      params.warehouse = filters.warehouse.join(",");
    setSearchParams(params, { replace: true });
    setCurrentPage(1);
  }, [debouncedSearch, filters, setSearchParams]);

  // Update URL params when filters change
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (filters.category.length > 0)
      params.category = filters.category.join(",");
    if (filters.priceRange.length > 0)
      params.priceRange = filters.priceRange.join(",");
    if (filters.warehouse.length > 0)
      params.warehouse = filters.warehouse.join(",");
    setSearchParams(params, { replace: true });

    // Reset to first page when filters change
    setCurrentPage(1);
  }, [search, filters, setSearchParams]);

  // State-driven page change - NO backend call
  const handlePageClick = (event) => {
    setCurrentPage(event.selected + 1);
  };

  // Refresh handler
  const handleRefresh = () => {
    dispatch(invalidateBulkCache("outOfStock"));
    dispatch(fetchBulkOutOfStock());
  };

  const delProduct = async (id) => {
    await dispatch(deleteProduct(id));
    // The backend emits a PRODUCT_DELETED event which updates the cache
    // via the realtime handler — no need to refetch.
  };

  const confirmDelete = (id) => {
    confirmAlert({
      title: "Delete Product",
      message: "Are you sure you want to delete this product?",
      buttons: [
        { label: "Delete", onClick: () => delProduct(id) },
        { label: "Cancel" },
      ],
    });
  };

  return (
    <div className="product-list">
      <InventoryHeader
        label="Out of Stock"
        placeholder="Search out of stock items by name or category..."
        search={search}
        handleSearchChange={(e) => setSearch(e.target.value)}
        onRefresh={handleRefresh}
        isRefreshing={isOutOfStockLoading}
        refreshLabel="Refresh"
        filters={filters}
        onFilterChange={(filterType, values) => {
          if (filterType === "category") {
            setCategoryFilter(values);
          } else if (filterType === "priceRange") {
            setPriceRangeFilter(values);
          } else if (filterType === "warehouse") {
            setWarehouseFilter(values);
          }
        }}
        categories={filterOptions?.categories || []}
        warehouses={filterOptions?.warehouses || []}
      />

      <div className="table">
        {isOutOfStockLoading && (
          <p className="no-products-p">Loading out of stock items...</p>
        )}

        <h2
          onClick={() => setShowProducts(!showProducts)}
          style={{ cursor: "pointer" }}
        >
          {showProducts ? "▼" : "►"} Out of Stock Products
        </h2>
        {showProducts && (
          <>
            {productsOutOfStock.length === 0 ? (
              <p className="no-products-p">-- Out of stock list --</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showProducts &&
                      currentItems.map((productOutOfStock, index) => {
                        const { _id, name, category } = productOutOfStock;
                        return (
                          <tr key={_id}>
                            <td>
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td>{shortenText(name, 16)}</td>
                            <td>{category}</td>
                            <td className="icons">
                              <div>
                                {admin && (
                                  <Link to={`/edit-product/${_id}`}>
                                    <span>
                                      <img src={editIcon} alt="edit" />
                                    </span>
                                  </Link>
                                )}
                                {admin && (
                                  <span>
                                    <img
                                      onClick={() => confirmDelete(_id)}
                                      src={deleteIcon}
                                      alt="delete"
                                    />
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Out of Stock Product Groups Section */}
        <h2
          onClick={() => setShowProductGroups(!showProductGroups)}
          style={{ cursor: "pointer" }}
        >
          {showProductGroups ? "▼" : "►"} Out of Stock Product Groups
        </h2>
        {showProductGroups && (
          <>
            {productGroupOutOfStock.length === 0 ? (
              <p className="no-products-p">
                -- Out of stock product groups list --
              </p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Group Name</th>
                      <th>Category</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!showProducts &&
                      currentItems.map((productGroup, index) => {
                        const { _id, groupName, category } = productGroup;
                        return (
                          <tr key={_id}>
                            <td>
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td>{shortenText(groupName, 16)}</td>
                            <td>{category}</td>
                            <td className="icons">
                              <div>
                                {admin && (
                                  <Link to={`/edit-product/group/${_id}`}>
                                    <span>
                                      <img src={editIcon} alt="edit" />
                                    </span>
                                  </Link>
                                )}
                                {admin && (
                                  <span>
                                    <img
                                      onClick={() => confirmDelete(_id)}
                                      src={deleteIcon}
                                      alt="delete"
                                    />
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <ReactPaginate
          breakLabel="..."
          nextLabel=">"
          onPageChange={handlePageClick}
          pageRangeDisplayed={3}
          pageCount={pageCount}
          previousLabel="<"
          containerClassName="pagination"
          pageLinkClassName="page-num"
          previousLinkClassName="page-num"
          nextLinkClassName="page-num"
          activeLinkClassName="activePageClass"
        />
      </div>
    </div>
  );
};

export default OutOfStockList;
