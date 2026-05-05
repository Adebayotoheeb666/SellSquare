import { useEffect, useState, useRef, useMemo } from "react";
import { SpinnerImg } from "../../loader/Loader";
import "./productList.scss";
import { useDispatch, useSelector } from "react-redux";
import ReactPaginate from "react-paginate";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css";
import {
  deleteProduct,
  selectFilterOptions,
  batchDeleteProducts,
  batchToggleProducts,
} from "../../../redux/features/product/productSlice";
import {
  invalidateProductCache,
  selectDatasetMeta,
} from "../../../redux/features/product/productCacheSlice";
import { addToCart, getCart } from "../../../redux/features/cart/cartSlice";
import { Tooltip } from "antd";
import { Link, useSearchParams } from "react-router-dom";
import deleteIcon from "../../../assets/home/delete-icon.svg";
import editIcon from "../../../assets/home/edit-icon.svg";
import viewIcon from "../../../assets/home/show.svg";
import InventoryHeader from "../../inventoryHeader/InventoryHeader";
import { selectUser } from "../../../redux/features/auth/authSlice";
import xcrossIcon from "../../../assets/home/xcrossIcon.svg";
import { Helmet } from "react-helmet";
import useFormatter from "../../../customHook/useFormatter";
import { useAsyncButtons } from "../../../customHook/useAsyncButton";
import ButtonSpinner from "../../loader/ButtonSpinner";
import { useStateProductPagination } from "../../../customHook/useStatePagination";
import {
  PAGINATED_DATA,
  invalidateCache,
} from "../../../redux/features/dataCache/dataCacheSlice";
import {
  getCombinedImageCount,
  getPrimaryImagePath,
} from "../../../utils/productImageUtils";
import { selectProductGroupsArray } from "../../../redux/features/dataCache/bulkDataCacheSlice";
import ImagePreviewModal from "../../imagePreview/ImagePreviewModal";
import { toast } from "sonner";

const ProductList = ({ products, isLoading, admin, activeRoute }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoading: buttonLoading, execute } = useAsyncButtons();

  const datasetMeta = useSelector(selectDatasetMeta);
  const productGroups = useSelector(selectProductGroupsArray);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [previewImagePath, setPreviewImagePath] = useState(null);
  
  // Selection state - persists across pages/searches
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isToggleOn, setIsToggleOn] = useState(false); // Toggle state for on/off

  // Initialize from URL params
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceTimeout = useRef();
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
  const [listStatusFilter, setListStatusFilter] = useState(
    searchParams.get("listStatus")
      ? searchParams.get("listStatus").split(",")
      : [],
  );

  // Memoize filters object to prevent unnecessary re-renders
  const filters = useMemo(
    () => ({
      category: categoryFilter,
      priceRange: priceRangeFilter,
      warehouse: warehouseFilter,
      listStatus: listStatusFilter,
    }),
    [categoryFilter, priceRangeFilter, warehouseFilter, listStatusFilter],
  );

  const filterOptions = useSelector(selectFilterOptions);
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const canManageListing = admin || currentUser?.permissions?.editproducts;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);


  const statePagination = useStateProductPagination({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
    filters,
  });

  const productGroupsById = useMemo(() => {
    return productGroups.reduce((acc, group) => {
      if (group?._id) {
        acc[String(group._id)] = group;
      }
      return acc;
    }, {});
  }, [productGroups]);

  const getProductCombinedImageCount = (product) => {
    const group = product?.itemGroup
      ? productGroupsById[String(product.itemGroup)]
      : null;
    return getCombinedImageCount(product?.images, group?.images);
  };

  console.log({ statePagination });

  const isStatePaginationActive = statePagination.canPaginateLocally;
  const currentItems = isStatePaginationActive
    ? statePagination.items
    : Array.isArray(products)
      ? products
      : [];
  const pageCount = isStatePaginationActive
    ? statePagination.totalPages
    : Math.max(
        1,
        Math.ceil(
          (Array.isArray(products) ? products.length : 0) / itemsPerPage,
        ),
      );
  const aggregatedStats = isStatePaginationActive
    ? statePagination.aggregatedStats
    : null;
  const isProductLoading = isLoading || statePagination.isLoading;

  // Filter options are loaded during bootstrap (session-scoped data)
  // No component-level fetch needed - they're globally owned by Layout
  // The getFilterOptions thunk has a built-in condition to prevent duplicate fetches

  const handleShowModal = async (product) => {
    await execute(`addCart-${product._id}`, async () => {
      if (product.quantity === 1 || product.quantity === "1") {
        const formData = {
          product: {
            ...product,
            quantity: "1",
          },
          user: currentUser,
        };

        const id = product._id;
        await dispatch(addToCart({ id, formData }));
        // Real-time update via WebSocket/Change Stream will handle cart refresh
      } else {
        setSelectedProduct(product);
        setProductQuantity(1);
        setIsModalVisible(true);
      }
    });
  };

  const handleModalOk = async () => {
    if (selectedProduct) {
      await execute(`addCartModal-${selectedProduct._id}`, async () => {
        const formData = {
          product: {
            ...selectedProduct,
            quantity: String(productQuantity),
          },
          user: currentUser,
        };

        const id = selectedProduct._id;
        await dispatch(addToCart({ id, formData }));
        // Real-time update via WebSocket/Change Stream will handle cart refresh
        setIsModalVisible(false);
      });
    } else {
      setIsModalVisible(false);
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  const handleQuantityChange = (value) => {
    // Allow clearing the input; clamp only when there's a numeric value
    if (value === "") {
      setProductQuantity("");
      return;
    }
    const maxQty = selectedProduct?.quantity || 1;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setProductQuantity("");
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), maxQty);
    setProductQuantity(clamped);
  };

  const shortenText = (text, n) => {
    if (text.length > n) {
      const shortenedText = text.substring(0, n).concat("...");
      return shortenedText;
    }
    return text;
  };

  const delProduct = async (id) => {
    await execute(`delete-${id}`, async () => {
      await dispatch(deleteProduct(id));
      // WebSocket events will automatically update the cache
      // No manual invalidation needed with event-driven architecture
    });
  };

  const [showProductImage, setShowProductImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Debounce search and update debounced value and URL param only after debounce
  useEffect(() => {
    if (debounceTimeout?.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
      // Update URL params after debounce
      const params = {};
      if (search) params.search = search;
      if (filters.category.length > 0)
        params.category = filters.category.join(",");
      if (filters.priceRange.length > 0)
        params.priceRange = filters.priceRange.join(",");
      if (filters.warehouse.length > 0)
        params.warehouse = filters.warehouse.join(",");
      if (filters.listStatus.length > 0)
        params.listStatus = filters.listStatus.join(",");
      setSearchParams(params, { replace: true });
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(debounceTimeout.current);
  }, [search, filters, setSearchParams]);

  // Handle page click - pure state update, NO backend call
  const handlePageClick = (event) => {
    // State-driven pagination: instant page change, no loading state needed
    setCurrentPage(event.selected + 1);
  };

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
        },
      ],
    });
  };

  // Ensure currentPage never exceeds pageCount
  useEffect(() => {
    if (currentPage > pageCount && pageCount > 0) {
      setCurrentPage(Math.max(1, pageCount));
    }
  }, [pageCount, currentPage]);

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
    if (filters.listStatus.length > 0)
      params.listStatus = filters.listStatus.join(",");
    setSearchParams(params, { replace: true });

    // Reset to first page when filters change
    setCurrentPage(1);
  }, [search, filters, setSearchParams]);

  // Get unique categories and warehouses from Redux filter options (all products, not just current page)
  const categories = filterOptions?.categories || [];
  const warehouses = filterOptions?.warehouses || [];

  const handleFilterChange = (filterType, values) => {
    if (filterType === "category") {
      setCategoryFilter(values);
    } else if (filterType === "priceRange") {
      setPriceRangeFilter(values);
    } else if (filterType === "warehouse") {
      setWarehouseFilter(values);
    } else if (filterType === "listStatus") {
      setListStatusFilter(values);
    }
  };

  const handleToggleSingleProduct = async (product) => {
    const nextListState = !product.listProduct;

    if (nextListState) {
      const totalImages = getProductCombinedImageCount(product);
      if (totalImages < 2) {
        toast.error("Add at least 2 combined images to list this product");
        return;
      }
    }

    await execute(`toggle-list-${product._id}`, async () => {
      await dispatch(
        batchToggleProducts({
          productIds: [product._id],
          listProduct: nextListState,
        }),
      );
      toast.success(
        nextListState ? "Product listed successfully" : "Product unlisted successfully",
      );
    });
  };

  const handleShowProductImage = (imagePath) => {
    setPreviewImagePath(imagePath);
    setIsImagePreviewOpen(true);
  };

  const closeProductImage = () => {
    setIsImagePreviewOpen(false);
    setPreviewImagePath(null);
  };

  // Check if all current page items are selected
  const areAllCurrentItemsSelected = useMemo(() => {
    if (currentItems.length === 0) return false;
    return currentItems.every((product) => selectedProducts.includes(product._id));
  }, [currentItems, selectedProducts]);

  // Selection handlers
  const handleSelectProduct = (productId) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (areAllCurrentItemsSelected) {
      // Deselect all current page items
      const currentPageIds = currentItems.map((product) => product._id);
      setSelectedProducts((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      // Select all current page items (add to existing selection)
      const currentPageIds = currentItems.map((product) => product._id);
      setSelectedProducts((prev) => {
        const newSelection = [...prev];
        currentPageIds.forEach((id) => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedProducts([]);
  };

  // Batch delete handler
  const handleBatchDelete = () => {
    if (selectedProducts.length === 0) return;

    confirmAlert({
      title: "Delete Products",
      message: `Are you sure you want to delete ${selectedProducts.length} product(s)?`,
      buttons: [
        {
          label: "Delete",
          onClick: async () => {
            await execute("batch-delete", async () => {
              await dispatch(batchDeleteProducts(selectedProducts));
              // Invalidate both paginated and bulk caches
              // WebSocket events will automatically update Redux cache
              // No manual refresh needed - realtime listener handles updates
              dispatch(invalidateCache(PAGINATED_DATA.PRODUCTS));
              dispatch(invalidateProductCache());
              setSelectedProducts([]);
            });
          },
        },
        {
          label: "Cancel",
        },
      ],
    });
  };

  // Batch toggle handler
  const handleBatchToggle = async () => {
    if (selectedProducts.length === 0) return;

    const listProduct = isToggleOn;

    // If turning on, validate image requirements
    if (listProduct === true) {
      // Need to get all selected products, not just current page
      const allProducts = statePagination.canPaginateLocally 
        ? statePagination.allItems 
        : products;
      
      const selectedProductsData = Array.isArray(allProducts)
        ? allProducts.filter((p) => selectedProducts.includes(p._id))
        : [];
      
      const invalidProducts = selectedProductsData.filter((product) => {
        const totalImages = getProductCombinedImageCount(product);
        return totalImages < 2;
      });

      if (invalidProducts.length > 0) {
        toast.error(
          `Cannot turn on ${invalidProducts.length} product(s) with less than 2 images`
        );
        return;
      }
    }

    await execute("batch-toggle", async () => {
      await dispatch(
        batchToggleProducts({ productIds: selectedProducts, listProduct })
      );
      dispatch(invalidateCache(PAGINATED_DATA.PRODUCTS));
      dispatch(invalidateProductCache());
      statePagination.refresh();
      setSelectedProducts([]);
      setIsToggleOn(false);
    });
  };

  const { formatter } = useFormatter();

  const handleRefresh = () => {
    dispatch(invalidateCache(PAGINATED_DATA.PRODUCTS));
    dispatch(invalidateProductCache());
    statePagination.refresh();
  };

  const getPricingView = (product) => {
    const basePrice = Number(product?.price || 0);
    const pricing = product?.discountPricing;
    const hasDiscount = Boolean(pricing?.hasDiscount);
    const discountedPrice = hasDiscount
      ? Number(pricing?.discountedPrice || basePrice)
      : basePrice;

    return {
      hasDiscount,
      basePrice,
      effectivePrice: discountedPrice,
    };
  };


  return (
    <>
      <Helmet>
        <title>
          Inventory Management | Sell Square - Real-Time Stock Tracking
        </title>
        <meta
          name="description"
          content="Comprehensive inventory management system. Track stock levels across multiple warehouses in real-time, manage product variants, monitor low stock alerts, bulk operations, automated valuations, and sync digital inventory with physical stock."
        />
        <meta
          name="keywords"
          content="inventory management, stock tracking, warehouse management, real-time inventory, product management, stock control, inventory system, multi-warehouse, stock valuation, inventory software, SKU management, product variants"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta
          property="og:title"
          content="Inventory Management | Sell Square - Multi-Warehouse Stock Control"
        />
        <meta
          property="og:description"
          content="Real-time inventory tracking across multiple locations. Manage products, variants, stock levels, and get low stock alerts automatically."
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://www.sellsquarehub.com/inventory"
        />
        <meta property="og:site_name" content="Sell Square" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Inventory Management | Sell Square"
        />
        <meta
          name="twitter:description"
          content="Real-time stock tracking, multiple warehouses, automated valuations, and low stock alerts."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/inventory" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Sell Square Inventory Management",
            applicationCategory: "BusinessApplication",
            description:
              "Real-time inventory management system for SMEs. Track stock across multiple warehouses, manage variants, and prevent stockouts.",
            url: "https://www.sellsquarehub.com/inventory",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
          })}
        </script>
      </Helmet>
      <div className="product-list">
        <InventoryHeader
          label="Products"
          placeholder="Search products by name, category, or SKU..."
          search={search}
          handleSearchChange={(e) => setSearch(e.target.value)}
          onRefresh={handleRefresh}
          isRefreshing={isProductLoading}
          refreshLabel="Refresh"
          filters={filters}
          onFilterChange={handleFilterChange}
          categories={categories}
          warehouses={warehouses}
          listStatuses={["listed", "unlisted"]}
        />

        {/* Batch Action Buttons */}
        {selectedProducts.length > 0 && (
          <div className="batch-actions">
            <div className="batch-actions-left">
              <span className="selected-count">
                {selectedProducts.length} selected
              </span>
              <button
                className="batch-clear-btn"
                onClick={handleClearSelection}
                title="Clear selection"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="batch-actions-right">
              <button
                className="batch-btn batch-delete-btn"
                onClick={handleBatchDelete}
                disabled={buttonLoading("batch-delete")}
                title="Delete selected products"
              >
                {buttonLoading("batch-delete") ? (
                  <ButtonSpinner />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
              </button>

              <div className="batch-toggle-container">
                <span className="toggle-label">List Product(s)</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isToggleOn}
                    onChange={(e) => setIsToggleOn(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <button
                className="batch-btn batch-apply-btn"
                onClick={handleBatchToggle}
                disabled={buttonLoading("batch-toggle")}
                title="Apply toggle to selected products"
              >
                {buttonLoading("batch-toggle") ? (
                  <ButtonSpinner />
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Apply</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="table">
          {isProductLoading && (
            <p className="no-products-p">Loading products...</p>
          )}

          <div className="table-scroll">
            <div className="table">
              {!isProductLoading && currentItems.length === 0 ? (
                <p className="no-products-p">
                  -- No product found, please add a product...
                </p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={areAllCurrentItemsSelected}
                          onChange={handleSelectAll}
                          className="product-checkbox"
                        />
                      </th>
                      <th>s/n</th>
                      <th>Image</th>
                      <th className="name-column">Name</th>
                      <th>Category</th>
                      <th>Warehouse</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Total Value</th>
                      <th>Listed</th>
                      <th className="action-header">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentItems.map((product, index) => {
                      const {
                        _id,
                        name,
                        category,
                        price,
                        quantity,
                        cost,
                        warehouse,
                        description,
                        sku,
                        productIsaGroup,
                        itemGroup,
                        image,
                        images,
                      } = product;
                      const isGroupProduct = Boolean(productIsaGroup);
                      const primaryImagePath = getPrimaryImagePath(images, image);
                      const groupImagePath =
                        isGroupProduct && itemGroup
                          ? getPrimaryImagePath(
                              productGroupsById[String(itemGroup)]?.images,
                              productGroupsById[String(itemGroup)]?.image,
                            )
                          : "";
                      const displayImagePath = primaryImagePath || groupImagePath;
                      const pricingView = getPricingView(product);
                      return (
                        <tr key={_id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(_id)}
                              className="product-checkbox"
                              onChange={() => handleSelectProduct(_id)}
                            />
                          </td>
                          <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                          <td>
                            {displayImagePath && (
                              <img
                                onClick={() =>
                                  handleShowProductImage(displayImagePath)
                                }
                                className="product_img"
                                src={displayImagePath}
                                loading="lazy"
                                alt="product image"
                              />
                            )}
                          </td>
                          <td className="name-column">
                            <Tooltip title={name}>
                              <div className="item_name item_name--product">
                                {name}
                              </div>
                            </Tooltip>
                          </td>
                          <td>
                            <div className="item_name">
                              <Tooltip title={category}>
                                {shortenText(category, 16)}
                              </Tooltip>
                            </div>
                          </td>
                          <td>
                            <div className="item_name">
                              {warehouse && (
                                <Tooltip title={warehouse}>
                                  {shortenText(warehouse, 16)}
                                </Tooltip>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="product-price-cell">
                              {pricingView.hasDiscount ? (
                                <>
                                  <span className="product-price-old">{formatter(pricingView.basePrice)}</span>
                                  <span className="product-price-new">{formatter(pricingView.effectivePrice)}</span>
                                </>
                              ) : (
                                <span>{formatter(pricingView.basePrice)}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="item_q">
                              <Tooltip title={quantity}>
                                {shortenText(quantity, 16)}
                              </Tooltip>
                            </div>
                          </td>
                          <td>{formatter(pricingView.effectivePrice * quantity)}</td>
                          <td>
                            <div className="listing-cell">
                              <span
                                className={`listing-pill ${product.listProduct ? "listing-pill--on" : "listing-pill--off"}`}
                                onClick={() => handleToggleSingleProduct(product)}
                              >
                                {product.listProduct ? "Listed" : "Unlisted"}
                              </span>
                              {/* {canManageListing ? (
                                <label className="toggle-switch">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(product.listProduct)}
                                    onChange={() => handleToggleSingleProduct(product)}
                                    disabled={buttonLoading(`toggle-list-${product._id}`)}
                                  />
                                  <span className="toggle-slider"></span>
                                </label>
                              ) : null} */}
                            </div>
                          </td>
                          <td className="icons action-cell">
                            <div>
                              {admin || currentUser?.permissions?.sellProducts ? (
                                <div>
                                  {Number(quantity) !== 0 ||
                                  Number(quantity) > 0 ? (
                                    <span>
                                      <button
                                        type="button"
                                        className="td-sell-btn"
                                        onClick={() => handleShowModal(product)}
                                      >
                                        Add
                                      </button>
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}

                              {!isGroupProduct && (
                                <Link
                                  to={`/inventory/product/${_id}`}
                                  title="View Product Details"
                                >
                                  <img
                                    src={viewIcon}
                                    alt="view details"
                                    className="view-icon"
                                  />
                                </Link>
                              )}
                              {isGroupProduct && product.itemGroup && (
                                <Link
                                  to={`/inventory/product-group/${product.itemGroup}`}
                                  title="View Product Details"
                                >
                                  <img
                                    src={viewIcon}
                                    alt="view details"
                                    className="view-icon"
                                  />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {isModalVisible && (
            <>
              <div
                className="payment_tooltip_overlay"
                onClick={handleModalCancel}
              />
              <div
                className="payment_tooltip quantity_tooltip"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="payment_tooltip_header">
                  <span>{`Add ${
                    selectedProduct?.name || "item"
                  } to Cart`}</span>
                  <button
                    className="tooltip_close_btn"
                    onClick={handleModalCancel}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 1L13 13M1 13L13 1"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="payment_tooltip_body">
                  <p className="quantity_hint">
                    Select quantity (Available: {selectedProduct?.quantity || 1}
                    )
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={selectedProduct?.quantity || 1}
                    value={productQuantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="quantity_input"
                  />

                  <div className="tooltip_actions">
                    <button
                      className="tooltip_action_btn cancel"
                      onClick={handleModalCancel}
                      disabled={buttonLoading(
                        `addCartModal-${selectedProduct?._id}`,
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      className="tooltip_action_btn confirm"
                      onClick={handleModalOk}
                      disabled={
                        buttonLoading(`addCartModal-${selectedProduct?._id}`) ||
                        productQuantity === "" ||
                        !productQuantity ||
                        Number(productQuantity) < 1
                      }
                    >
                      {buttonLoading(`addCartModal-${selectedProduct?._id}`)
                        ? "Adding..."
                        : "Add to Cart"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          <ReactPaginate
            breakLabel="..."
            nextLabel=">"
            onPageChange={handlePageClick}
            pageRangeDisplayed={3}
            pageCount={pageCount}
            previousLabel="<"
            renderOnZeroPageCount={null}
            containerClassName={`pagination ${
              isProductLoading ? "pagination-disabled" : ""
            }`}
            pageLinkClassName="page-num"
            previousLinkClassName="page-num"
            nextLinkClassName="page-num"
            activeLinkClassName="activePageClass"
          />
        </div>
      </div>

      <ImagePreviewModal
        isOpen={isImagePreviewOpen}
        imageSrc={previewImagePath}
        alt="Product image"
        onClose={closeProductImage}
      />
    </>
  );
};

export default ProductList;
