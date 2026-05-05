import React, { useEffect, useState, useMemo, useRef } from "react";
import "../productList/productList.scss";
import { confirmAlert } from "react-confirm-alert";
import { Tooltip } from "antd";
import { useDispatch, useSelector } from "react-redux";
import {
  batchToggleProducts,
  deleteGroupItem,
  batchDeleteProductGroups,
  updateGroupListingOptions,
  selectFilterOptions,
} from "../../../redux/features/product/productSlice";
import ReactPaginate from "react-paginate";
import "react-confirm-alert/src/react-confirm-alert.css";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import deleteIcon from "../../../assets/home/delete-icon.svg";
import editIcon from "../../../assets/home/edit-icon.svg";
import listIcon from "../../../assets/home/checkmark-circle-02.svg";
import xcrossIcon from "../../../assets/home/xcrossIcon.svg";
import InventoryHeader from "../../inventoryHeader/InventoryHeader";
import { selectUser } from "../../../redux/features/auth/authSlice";
import moment from "moment";
import { useStateProductGroupsPagination } from "../../../customHook/useStatePagination";
import { selectAllProductsArray } from "../../../redux/features/product/productCacheSlice";
import {
  invalidateBulkCache,
  fetchBulkProductGroups,
} from "../../../redux/features/dataCache/bulkDataCacheSlice";
import { getCombinedImageCount } from "../../../utils/productImageUtils";
import ListVariantsModal from "./ListVariantsModal";
import { toast } from "sonner";
import { useAsyncButtons } from "../../../customHook/useAsyncButton";

const ProductGroupList = ({ admin }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const { isLoading: buttonLoading, execute } = useAsyncButtons();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedGroups, setSelectedGroups] = useState([]);

  // Initialize from URL params
  const [search, setSearch] = useState(searchParams.get('search') || "");
  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceTimeout = useRef();
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(debounceTimeout.current);
  }, [search]);
  const [categoryFilter, setCategoryFilter] = useState(
    searchParams.get('category') ? searchParams.get('category').split(',') : []
  );
  const [priceRangeFilter, setPriceRangeFilter] = useState(
    searchParams.get('priceRange') ? searchParams.get('priceRange').split(',') : []
  );
  const [warehouseFilter, setWarehouseFilter] = useState(
    searchParams.get('warehouse') ? searchParams.get('warehouse').split(',') : []
  );

  // Memoize filters object to prevent unnecessary re-renders
  const filters = useMemo(
    () => ({
      category: categoryFilter,
      priceRange: priceRangeFilter,
      warehouse: warehouseFilter,
    }),
    [categoryFilter, priceRangeFilter, warehouseFilter]
  );

  // Use state-driven pagination from bulk-loaded cache
  const {
    items: currentItems,
    totalPages: totalPagesFromHook,
    isLoading: isProductGroupsLoading,
  } = useStateProductGroupsPagination({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
    filters: filters,
    sortField: 'createdAt',
    sortDirection: 'desc'
  });

  // pageCount comes directly from hook's totalPages
  const pageCount = totalPagesFromHook || 1;

  const handleRefresh = () => {
    dispatch(invalidateBulkCache("productGroups"));
    dispatch(fetchBulkProductGroups({ force: true }));
  };

  const navigate = useNavigate();
  const filterOptions = useSelector(selectFilterOptions);
  const currentUser = useSelector(selectUser);
  const allProducts = useSelector(selectAllProductsArray);

  const groupVariantsById = useMemo(() => {
    const map = {};
    if (!Array.isArray(allProducts)) return map;

    allProducts.forEach((product) => {
      if (!product?.itemGroup) return;
      const key = String(product.itemGroup);
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(product);
    });

    return map;
  }, [allProducts]);

  // Filter options are loaded during bootstrap (session-scoped data)
  // No component-level fetch needed - they're globally owned by Layout
  // The getFilterOptions thunk has a built-in condition to prevent duplicate fetches

  const shortenText = (text, n) => {
    if (text.length > n) {
      const shortenedText = text.substring(0, n).concat("...");
      return shortenedText;
    }
    return text;
  };

  // State-driven page change - NO backend call
  const handlePageClick = (event) => {
    setCurrentPage(event.selected + 1);
  };

  const delProduct = async (id) => {
    await dispatch(deleteGroupItem(id));
    // Realtime updates will refresh the cached product groups
  };

  // Calculate variant counts for selected groups
  const calculateVariantCounts = (groupIds) => {
    let totalVariants = 0;
    groupIds.forEach((groupId) => {
      const variants = groupVariantsById[String(groupId)] || [];
      totalVariants += variants.length;
    });
    return totalVariants;
  };

  // Selection handlers
  const currentPageGroupIds = currentItems.map((g) => g._id);
  const allCurrentPageSelected = useMemo(() => {
    return currentPageGroupIds.length > 0 &&
      currentPageGroupIds.every((id) => selectedGroups.includes(id));
  }, [currentItems, selectedGroups]);

  const handleSelectAllOnPage = () => {
    if (allCurrentPageSelected) {
      setSelectedGroups((prev) =>
        prev.filter((id) => !currentPageGroupIds.includes(id)),
      );
    } else {
      setSelectedGroups((prev) => {
        const newSelected = [...prev];
        currentPageGroupIds.forEach((id) => {
          if (!newSelected.includes(id)) {
            newSelected.push(id);
          }
        });
        return newSelected;
      });
    }
  };

  const handleSelectGroup = (groupId) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const handleClearSelection = () => {
    setSelectedGroups([]);
  };

  // Batch delete handler
  const handleBatchDelete = () => {
    if (selectedGroups.length === 0) return;
    console.log("Clicked");

    const variantCount = calculateVariantCounts(selectedGroups);

    confirmAlert({
      title: "Delete Product Groups",
      message: `Are you sure you want to delete ${selectedGroups.length} group(s) and ${variantCount} variant(s)? This action cannot be undone.`,
      buttons: [
        {
          label: "Delete",
          onClick: async () => {
            try {
              await execute("batch-delete-groups", async () => {
                console.log("Deleting groups:", selectedGroups);
                const result = await dispatch(batchDeleteProductGroups(selectedGroups));
                console.log("Batch delete result:", result);
                // WebSocket events will automatically update the cache
                setSelectedGroups([]);
              });
            } catch (error) {
              console.error("Batch delete error:", error);
              toast.error(error?.message || "Failed to delete groups");
            }
          },
        },
        {
          label: "Cancel",
        },
      ],
    });
  };

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

  const confirmDelete = (id) => {
    confirmAlert({
      title: "Delete Product",
      message: "Are you sure you want to delete this product.",
      buttons: [
        {
          label: "Delete",
          onClick: () => delProduct(id),
        },
        {
          label: "Cancel",
          // onClick: () => alert('Click No')
        },
      ],
    });
  };

  const handleListGroup = (group) => {
    const groupVariants = groupVariantsById[String(group._id)] || [];
    
    // Fallback: check combinations array if no variants in allProducts yet
    const hasCombinations = Array.isArray(group?.combinations) && group.combinations.length > 0;
    
    if (groupVariants.length === 0 && !hasCombinations) {
      toast.error("No variants found for this group.");
      return;
    }
    
    // If combinations exist but no products, inform user to wait
    if (groupVariants.length === 0 && hasCombinations) {
      toast.info("Product variants are being created. Please try again in a moment.");
      return;
    }

    const listingData = groupVariants.map((variant) => {
      const combinedCount = getCombinedImageCount(
        variant?.images,
        group?.images,
      );

      return {
        ...variant,
        combinedCount,
        listable: combinedCount >= 2,
      };
    });

    const listedVariantIds = groupVariants
      .filter((variant) => variant?.listProduct)
      .map((variant) => variant._id);

    confirmAlert({
      overlayClassName: "list-variants-overlay",
      customUI: ({ onClose }) => (
        <ListVariantsModal
          groupName={group.groupName || "this group"}
          group={group}
          variants={listingData}
          initialSelectedIds={listedVariantIds}
          onClose={onClose}
          onConfirm={async ({ selectedIds, publishedOptions }) => {
            const listableVariants = listingData.filter(
              (variant) => variant.listable,
            );
            const selectedSet = new Set(selectedIds);

            const toList = listableVariants
              .filter(
                (variant) =>
                  selectedSet.has(variant._id) && !variant.listProduct,
              )
              .map((variant) => variant._id);

            const toUnlist = listableVariants
              .filter(
                (variant) =>
                  !selectedSet.has(variant._id) && variant.listProduct,
              )
              .map((variant) => variant._id);

            if (toList.length > 0) {
              await dispatch(
                batchToggleProducts({ productIds: toList, listProduct: true }),
              );
            }

            if (toUnlist.length > 0) {
              await dispatch(
                batchToggleProducts({ productIds: toUnlist, listProduct: false }),
              );
            }

            await dispatch(
              updateGroupListingOptions({
                id: group._id,
                listingOptions: publishedOptions,
              }),
            );

            toast.success("Listing updated successfully.");
            onClose();
          }}
        />
      ),
    });
  };

  return (
    <div className="product-list">
      <InventoryHeader
        label="Groups"
        placeholder="Search groups by name, category, or date..."
        search={search}
        handleSearchChange={(e) => setSearch(e.target.value)}
        onRefresh={handleRefresh}
        isRefreshing={isProductGroupsLoading}
        refreshLabel="Refresh"
        filters={filters}
        onFilterChange={(filterType, values) => {
          if (filterType === 'category') {
            setCategoryFilter(values);
          } else if (filterType === 'priceRange') {
            setPriceRangeFilter(values);
          } else if (filterType === 'warehouse') {
            setWarehouseFilter(values);
          }
        }}
        categories={filterOptions?.categories || []}
        warehouses={filterOptions?.warehouses || []}
      />
      {isProductGroupsLoading && <p className="no-products-p">Loading product groups...</p>}

      {/* Bulk Actions Bar */}
      {selectedGroups.length > 0 && (
        <div className="bulk-actions-bar bulk-actions-bar--groups">
          <span className="selection-info">
            {selectedGroups.length} group(s) selected
            {calculateVariantCounts(selectedGroups) > 0 && (
              <span> + {calculateVariantCounts(selectedGroups)} variant(s)</span>
            )}
          </span>
          <div className="action-buttons">
            <Tooltip title="Delete Selected Groups">
              <button
                onClick={handleBatchDelete}
                className="icon-btn btn-delete"
                disabled={buttonLoading("batch-delete-groups")}
              >
                <img src={deleteIcon} alt="delete" />
              </button>
            </Tooltip>
            <Tooltip title="Clear Selection">
              <button
                onClick={handleClearSelection}
                className="icon-btn btn-cancel"
              >
                <img src={xcrossIcon} alt="clear" />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="table product-group-list">
        {!isProductGroupsLoading && currentItems.length === 0 ? (
          <p className="no-products-p">
            {" "}
            -- No product group found, please add a product group{" "}
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={handleSelectAllOnPage}
                      title="Select all on this page"
                    />
                  </th>
                  <th>S/N</th>
                  <th>Date Created</th>
                  <th>Name</th>
                  <th>Category</th>

                  <th>quantity</th>

                  <th>Description</th>
                  <th>Listed</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {currentItems.map((productGroup, index) => {
                  const {
                    _id,
                    price,
                    groupName,
                    category,
                    description,
                    createdAt,
                    combinations,
                    isProductUnique,
                  } = productGroup;
                  const groupVariants =
                    groupVariantsById[String(_id)] || [];
                  const listedCount = groupVariants.filter(
                    (variant) => variant?.listProduct,
                  ).length;
                  const format = "DD-MM-YYYY h:mmA";
                  const formattedDate = moment(createdAt).format(format);
                  return (
                    <tr className="group-header" key={_id}>
                      <td className="checkbox-column">
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(_id)}
                          onChange={() => handleSelectGroup(_id)}
                        />
                      </td>
                      <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td
                        onClick={() =>
                          navigate(`/inventory/product-group/${_id}`)
                        }
                      >
                        <div className="item_d">{formattedDate}</div>
                      </td>
                      <td
                        onClick={() =>
                          navigate(`/inventory/product-group/${_id}`)
                        }
                      >
                        <div className="item_name">
                          {groupName && (
                            <Tooltip title={groupName}>
                              {shortenText(groupName, 12)}
                            </Tooltip>
                          )}
                        </div>
                      </td>
                      <td
                        onClick={() =>
                          navigate(`/inventory/product-group/${_id}`)
                        }
                      >
                        <div className="item_name">
                          <Tooltip title={category}>
                            {shortenText(category, 16)}
                          </Tooltip>
                        </div>
                      </td>

                      <td
                        onClick={() =>
                          navigate(`/inventory/product-group/${_id}`)
                        }
                      >
                        {isProductUnique ? combinations.length : ""}
                      </td>

                      <td
                        onClick={() =>
                          navigate(`/inventory/product-group/${_id}`)
                        }
                      >
                        <div className="item_name">
                          <Tooltip title={description}>
                            {shortenText(description, 14)}
                          </Tooltip>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`listing-pill ${
                            listedCount > 0
                              ? "listing-pill--on"
                              : "listing-pill--off"
                          }`}
                        >
                          {listedCount > 0
                            ? `${listedCount} listed`
                            : "Unlisted"}
                        </span>
                      </td>

                      <td className="icons actions">
                        <div className="group-action-wrap">
                          <Link
                            to={`/inventory/product-group/${_id}`}
                            className="group-action-link edit-group"
                            aria-label="Edit product group"
                          >
                            <img src={editIcon} alt="edit" />
                          </Link>

                          {admin || currentUser?.permissions?.editproducts ? (
                            <Tooltip title="List/Unlist items">
                              <button
                                type="button"
                                className="group-action-btn"
                                aria-label="List or unlist items"
                                onClick={() => handleListGroup(productGroup)}
                              >
                                <img src={listIcon} alt="list/unlist" />
                              </button>
                            </Tooltip>
                          ) : null}

                          {admin || currentUser?.permissions?.deleteProducts ? (
                            <button
                              type="button"
                              className="group-action-btn group-action-btn--danger"
                              aria-label="Delete product group"
                              onClick={() => confirmDelete(_id)}
                            >
                              <img src={deleteIcon} alt="delete" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ReactPaginate
        breakLabel="..."
        nextLabel=">"
        onPageChange={handlePageClick}
        pageRangeDisplayed={3}
        pageCount={pageCount}
        previousLabel="<"
        renderOnZeroPageCount={null}
        containerClassName={`pagination ${isProductGroupsLoading ? 'pagination-disabled' : ''}`}
        pageLinkClassName="page-num"
        previousLinkClassName="page-num"
        nextLinkClassName="page-num"
        activeLinkClassName="activePageClass"
        forcePage={currentPage - 1}
      />
    </div>
  );
};

export default ProductGroupList;
