import React, { useEffect, useMemo, useState } from "react";
import "./groupItem.css";
import editIcon from "../../../assets/home/edit-icon.svg";
import deleteIcon from "../../../assets/home/delete-icon.svg";
import editIcon2 from "../../../assets/home/pencil-2.svg";
import xcrossIcon from "../../../assets/home/xcrossIcon.svg";
import arrowLeft from "../../../assets/home/arrow-left.svg";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  batchToggleProducts,
  deleteGroupItem,
  updateGroupListingOptions,
} from "../../../redux/features/product/productSlice";
import { selectProductGroupsArray } from "../../../redux/features/dataCache/bulkDataCacheSlice";
import { selectAllProductsArray } from "../../../redux/features/product/productCacheSlice";
import {
  selectIsLoggedIn,
  selectUser,
  selectLoggedInBusinessOwner,
} from "../../../redux/features/auth/authSlice";
import { confirmAlert } from "react-confirm-alert";
import { toast } from "sonner";
import { Tooltip } from "antd";
import moment from "moment";
import useFormatter from "../../../customHook/useFormatter";
import {
  getCombinedImageCount,
  getPrimaryImagePath,
} from "../../../utils/productImageUtils";
import ImagePreviewModal from "../../imagePreview/ImagePreviewModal";
import ListVariantsModal from "./ListVariantsModal";

export default function GroupItem() {
  const dispatch = useDispatch();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const admin = useSelector(selectLoggedInBusinessOwner);
  const allProductGroups = useSelector(selectProductGroupsArray);
  const [filteredGroup, setFilteredGroup] = useState([]);
  const [attributesArrays, setAttributesArrays] = useState([]);
  const [activeRoute, setActiveRoute] = useState("");
  const [showProductItems, setShowProductItems] = useState(true);
  const [products, setProducts] = useState([]);
  const currentUser = useSelector(selectUser);
  const [showProductImage, setShowProductImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [previewImagePath, setPreviewImagePath] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;
  const groupHistory = filteredGroup?.[0]?.history ?? [];
  const allProducts = useSelector(selectAllProductsArray);

  const { id } = useParams();

  const linkArrays = (keys, ...arrays) => {
    const safeArrays = arrays.map((arr) => (Array.isArray(arr) ? arr : []));
    const length = safeArrays[0]?.length || 0;
    if (!safeArrays.every((arr) => arr.length === length)) {
      toast.error("Arrays must be of equal length");
      return [];
    }
    return Array.from({ length }, (_, index) => {
      return safeArrays.reduce((obj, arr, i) => {
        obj[keys[i]] = arr[index];
        return obj;
      }, {});
    });
  };

  const linkArrayAndObject = (array, object) => {
    const safeArray = Array.isArray(array) ? array : [];
    const safeObject = object && typeof object === "object" ? object : {};
    const length = safeArray.length;

    if (Object.keys(safeObject).length !== length) {
      return [];
    }

    return safeArray.map((key, index) => ({
      [key]: { ...(safeObject[index] || {}) },
    }));
  };

  useEffect(() => {
    const filtered = allProductGroups.filter((prg) => prg._id === id);
    setFilteredGroup(filtered);
    if (filtered.length > 0) {
      const group = filtered[0] || {};
      setAttributesArrays(
        linkArrayAndObject(group.attributes, group.options)
      );
      setProducts(
        linkArrays(
          ["itemName", "sku", "cost", "price", "warehouse", "quantity"],
          group.combinations,
          group.sku,
          group.cost,
          group.price,
          group.warehouse,
          group.quantity
        )
      );
    } else {
      setAttributesArrays([]);
      setProducts([]);
    }
  }, [allProductGroups, id]);

  const groupVariants = useMemo(() => {
    return Array.isArray(allProducts)
      ? allProducts.filter(
          (product) => String(product?.itemGroup) === String(id),
        )
      : [];
  }, [allProducts, id]);

  const listedVariantIds = useMemo(() => {
    return groupVariants
      .filter((variant) => variant?.listProduct)
      .map((variant) => variant._id);
  }, [groupVariants]);

  const variantPricingBySignature = useMemo(() => {
    const map = new Map();

    groupVariants.forEach((variant) => {
      const pricing = variant?.discountPricing;
      if (!pricing) return;

      const nameKey = String(variant?.name || "").trim().toLowerCase();
      const skuKey = String(variant?.sku || "").trim().toLowerCase();

      if (nameKey) {
        map.set(`name:${nameKey}`, pricing);
      }

      if (skuKey) {
        map.set(`sku:${skuKey}`, pricing);
      }
    });

    return map;
  }, [groupVariants]);

  const groupListingData = useMemo(() => {
    const group = filteredGroup?.[0];
    return groupVariants.map((variant) => {
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
  }, [filteredGroup, groupVariants]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyStartDate, historyEndDate, id]);

  useEffect(() => {
    setHistorySearch("");
    setHistoryStartDate("");
    setHistoryEndDate("");
    setHistoryPage(1);
  }, [id]);

  const filteredHistory = useMemo(() => {
    const parsedStartDate = historyStartDate
      ? moment(historyStartDate).startOf("day")
      : null;
    const parsedEndDate = historyEndDate ? moment(historyEndDate).endOf("day") : null;

    return groupHistory.filter((entry) => {
      const entryDate = entry?.date ? moment(entry.date) : null;

      if (parsedStartDate || parsedEndDate) {
        if (!entryDate) return false;
        if (parsedStartDate && entryDate.isBefore(parsedStartDate)) return false;
        if (parsedEndDate && entryDate.isAfter(parsedEndDate)) return false;
      }

      const term = historySearch.trim().toLowerCase();
      if (term) {
        const haystack = `${entry.type || ""} ${entry.performedBy || ""} ${entry.note || ""} ${entry.itemName || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [groupHistory, historyEndDate, historySearch, historyStartDate]);

  const filteredMetrics = useMemo(
    () =>
      filteredHistory.reduce(
        (acc, entry) => {
          const qty = Math.abs(entry?.quantityChange ?? 0);

          if (entry?.type === "sale") {
            const unitAmount = typeof entry?.amount === "number" ? entry.amount : 0;
            acc.totalSold += qty;
            acc.totalRevenue += qty * unitAmount;
          }

          if (entry?.type === "stock-in") {
            acc.totalStocked += qty;
          }

          return acc;
        },
        { totalSold: 0, totalRevenue: 0, totalStocked: 0 }
      ),
    [filteredHistory]
  );

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const historySliceStart = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const paginatedHistory = filteredHistory.slice(
    historySliceStart,
    historySliceStart + HISTORY_PAGE_SIZE
  );

  // Smart pagination with ellipsis
  const getPageNumbers = useMemo(() => {
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalHistoryPages; i++) {
      if (i === 1 || i === totalHistoryPages || (i >= safeHistoryPage - delta && i <= safeHistoryPage + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }, [totalHistoryPages, safeHistoryPage]);

  useEffect(() => {
    setHistoryPage((prev) => Math.min(prev, totalHistoryPages));
  }, [totalHistoryPages]);

  const { formatter } = useFormatter();

  const shortenText = (text, n) => {
    if (text.length > n) {
      const shortenedText = text.substring(0, n).concat("...");
      return shortenedText;
    }
    return text;
  };

  const delProduct = async (id) => {
    await dispatch(deleteGroupItem(id));
    // Realtime updates will refresh the cached product groups
  };

  const handleListGroup = () => {
    const group = filteredGroup?.[0];
    if (!group) {
      toast.error("Product group not found.");
      return;
    }

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

    confirmAlert({
      overlayClassName: "list-variants-overlay",
      customUI: ({ onClose }) => (
        <ListVariantsModal
          groupName={group.groupName || "this group"}
          group={group}
          variants={groupListingData}
          initialSelectedIds={listedVariantIds}
          onClose={onClose}
          onConfirm={async ({ selectedIds, publishedOptions }) => {
            const listableVariants = groupListingData.filter(
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
                batchToggleProducts({
                  productIds: toList,
                  listProduct: true,
                }),
              );
            }

            if (toUnlist.length > 0) {
              await dispatch(
                batchToggleProducts({
                  productIds: toUnlist,
                  listProduct: false,
                }),
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

  const handleShowProductImage = (imagePath) => {
    setPreviewImagePath(imagePath);
    setIsImagePreviewOpen(true);
  };

  const closeProductImage = () => {
    setIsImagePreviewOpen(false);
    setPreviewImagePath(null);
  };

  return (
    <>
      <div className="group-items-container">
      <div className="items-list">
        <h1>Item groups</h1>
        <div className="group-items">
          {allProductGroups.map((productGroup, index) => {
            if (!productGroup) return null;
            const combinationsCount = Array.isArray(productGroup.combinations)
              ? productGroup.combinations.length
              : 0;
            return (
              <Link
                key={productGroup._id || index}
                to={`/inventory/product-group/${productGroup._id}`}
              >
                <div
                  className={
                    productGroup._id === id
                      ? "group-item active-group-item"
                      : "group-item"
                  }
                  onClick={() => setShowProductItems(!showProductItems)}
                >
                  <div className="item-dot"></div>
                  <h3>
                    {productGroup.groupName}{" "}
                    <span>({combinationsCount} items)</span>
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div
        className={
          showProductItems ? "item-details show_details" : "item-details"
        }
      >
        <div className="">
          <div className="details-header">
            <div className="details-header__close">
              <img
                onClick={() => setShowProductItems(!showProductItems)}
                src={showProductItems ? arrowLeft : xcrossIcon}
                alt={showProductItems ? "back" : "close"}
                title={showProductItems ? "Back" : "Close"}
              />
            </div>
            <div className="actions">
              {admin || currentUser?.permissions?.editproducts ? (
                <Link to={`/edit-product/group/${id}`} className="action-icon-btn" title="Edit Group">
                  <img src={editIcon2} alt="edit" />
                </Link>
              ) : null}
              {admin || currentUser?.permissions?.editproducts ? (
                <Link to={`/edit-product/group/${id}`} className="action-btn">
                  Add Item
                </Link>
              ) : null}
              {admin || currentUser?.permissions?.editproducts ? (
                <div className="group-listing-actions">
                  <button
                    type="button"
                    className="action-btn"
                    onClick={handleListGroup}
                  >
                    Listing
                  </button>
                  <span className="group-listing-count">
                    {listedVariantIds.length}
                  </span>
                </div>
              ) : (
                <span className="group-listing-count">
                  {listedVariantIds.length}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="details-body">
          {filteredGroup?.map((filtered, index) => {
            // log
            const format = "DD-MM-YYYY h:mmA";
            const createdAt = moment(filtered.createdAt).format(format);
            const updatedAt = moment(filtered.updatedAt).format(format);
            const combinationsCount = Array.isArray(filtered?.combinations)
              ? filtered.combinations.length
              : 0;
            const primaryImagePath = getPrimaryImagePath(
              filtered?.images,
              filtered?.image,
            );
            return (
              <div key={index}>
                <div className="details_body_header">
                  <h3>{filtered.groupName}</h3>
                  <h5>{combinationsCount} item(s)</h5>
                  <div className="dates">
                    <h6>Created: {createdAt}</h6>
                    <h6>Updated: {updatedAt}</h6>
                  </div>
                </div>

                {primaryImagePath && (
                  <div className="product_group_image">
                    <img
                      onClick={() => handleShowProductImage(primaryImagePath)}
                      src={primaryImagePath}
                      loading="lazy"
                      alt="Product group image"
                      style={{ cursor: "pointer" }}
                    />
                  </div>
                )}

                <table>
                  <tbody>
                    {attributesArrays.map((attributesArray, index) => {
                      const [key, value] = Object.entries(attributesArray)[0];

                      return (
                        <tr key={index}>
                          <td>{key}</td>
                          <td>
                            {value.attr.map((val, i) => {
                              return val.value !== "" ? (
                                <span key={i}>{val.value}</span>
                              ) : null;
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="details-body-items">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>SKU</th>
                  <th>Quantity</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Warehouse</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => {
                  const nameSignature = String(product?.itemName || "")
                    .trim()
                    .toLowerCase();
                  const skuSignature = String(product?.sku || "")
                    .trim()
                    .toLowerCase();

                  const pricing =
                    variantPricingBySignature.get(`name:${nameSignature}`) ||
                    variantPricingBySignature.get(`sku:${skuSignature}`) ||
                    null;

                  const hasDiscount = Boolean(pricing?.hasDiscount);
                  const originalPrice = Number(pricing?.originalPrice || product.price || 0);
                  const effectivePrice = hasDiscount
                    ? Number(pricing?.discountedPrice || originalPrice)
                    : Number(product.price || 0);

                  return (
                    <tr key={index}>
                      <td>
                        {/* <Tooltip title={product.itemName}> */}
                        {/* {shortenText(product.itemName, 16)} */}
                        {/* </Tooltip> */}
                        {product.itemName}
                      </td>
                      <td>
                        <Tooltip title={product?.sku}>
                          {shortenText(product?.sku, 16)}
                        </Tooltip>
                      </td>
                      <td>{product.quantity}</td>
                      <td>
                        {admin || currentUser?.permissions?.seeBusinessFinances
                          ? formatter(product.cost)
                          : "unautorized"}
                      </td>
                      <td>
                        {hasDiscount ? (
                          <span className="group-discount-price">
                            <span className="group-discount-price-old">{formatter(originalPrice)}</span>
                            <span className="group-discount-price-new">{formatter(effectivePrice)}</span>
                          </span>
                        ) : (
                          formatter(effectivePrice)
                        )}
                      </td>
                      <td>{product.warehouse}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Group Details Section */}
        {filteredGroup?.map((groupDetail, index) => {
          const showingFrom = filteredHistory.length === 0 ? 0 : historySliceStart + 1;
          const showingTo = Math.min(
            historySliceStart + paginatedHistory.length,
            filteredHistory.length
          );

          return (
            <div key={index} className="product-group-details">
              <div className="details-section">
                <h4 className="section-title">Group Summary</h4>
                <div className="summary-pills">
                  <div className="pill pill--meta">
                    <p>Total Sold</p>
                    <strong>{filteredMetrics.totalSold}</strong>
                  </div>
                  <div className="pill pill--meta">
                    <p>Total Revenue</p>
                    <strong>{formatter(filteredMetrics.totalRevenue)}</strong>
                  </div>
                  <div className="pill pill--meta">
                    <p>Total Stocked In</p>
                    <strong>{filteredMetrics.totalStocked}</strong>
                  </div>
                </div>
              </div>

              <div className="details-section history-section">
                <div className="section-header">
                  <h4 className="section-title">Group History</h4>
                  {filteredHistory && filteredHistory.length > 0 && (
                    <span className="history-count-badge">{filteredHistory.length} entries</span>
                  )}
                </div>

                <div className="history-controls">
                  <div className="history-filters">
                    <input
                      type="search"
                      className="history-search"
                      placeholder="Search by type, item, note, or actor"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                    />
                    <div className="history-date-range">
                      <label>
                        <span>From</span>
                        <input
                          type="date"
                          value={historyStartDate}
                          onChange={(e) => setHistoryStartDate(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>To</span>
                        <input
                          type="date"
                          value={historyEndDate}
                          onChange={(e) => setHistoryEndDate(e.target.value)}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="ghost-btn history-reset"
                      onClick={() => {
                        setHistorySearch("");
                        setHistoryStartDate("");
                        setHistoryEndDate("");
                      }}
                      disabled={!historySearch && !historyStartDate && !historyEndDate}
                    >
                      Clear filters
                    </button>
                  </div>
                  <div className="history-meta">
                    <span className="history-count">
                      Showing {showingFrom}-{showingTo} of {filteredHistory.length} entries
                    </span>
                  </div>
                </div>

                {groupHistory && groupHistory.length > 0 ? (
                  <>
                    <div className="history-table-container">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>Date & Time</th>
                            <th>Type</th>
                            <th>Item Name</th>
                            <th>Qty Change</th>
                            <th>Balance</th>
                            <th>Performed By</th>
                            <th>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedHistory.map((entry, idx) => {
                            const date = entry?.date
                              ? moment(entry.date).format("DD-MM-YYYY h:mmA")
                              : "";
                            const type = entry?.type || "";
                            const itemName = entry?.itemName || "";
                            const change = entry?.quantityChange ?? 0;
                            const balance = entry?.balance ?? "";
                            const actor = entry?.performedBy || "System";
                            const note = entry?.note || "—";

                            const isNegativeChange = change < 0;

                            return (
                              <tr key={idx} className={`history-row ${type}`}>
                                <td className="date-cell">
                                  <span className="date-value">{date}</span>
                                </td>
                                <td className="type-cell">
                                  <span className={`type-badge type-${type}`}>
                                    {type === "sale" ? (
                                      <svg className="type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14" />
                                      </svg>
                                    ) : type === "stock-in" ? (
                                      <svg className="type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 5v14M5 12h14" />
                                      </svg>
                                    ) : (
                                      <svg className="type-icon" viewBox="0 0 24 24" fill="currentColor">
                                        <circle cx="12" cy="12" r="1" />
                                        <circle cx="19" cy="12" r="1" />
                                        <circle cx="5" cy="12" r="1" />
                                      </svg>
                                    )}
                                    {type === "sale"
                                      ? "Sale"
                                      : type === "stock-in"
                                        ? "Stock In"
                                        : type}
                                  </span>
                                </td>
                                <td className="item-name-cell">
                                  <span className="item-name">{itemName}</span>
                                </td>
                                <td className="qty-change-cell">
                                  <span className={`qty-badge ${isNegativeChange ? "negative" : "positive"}`}>
                                    {isNegativeChange ? "−" : "+"}{Math.abs(change)}
                                  </span>
                                </td>
                                <td className="balance-cell">
                                  <strong>{balance}</strong>
                                </td>
                                <td className="actor-cell">
                                  <span className="actor-name">{actor}</span>
                                </td>
                                <td className="note-cell">
                                  <span className="note-text">{note}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {filteredHistory.length > 0 && (
                      <div className="history-pagination-bar">
                        <button
                          type="button"
                          className="ghost-btn icon-btn"
                          onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                          disabled={safeHistoryPage === 1}
                          aria-label="Previous page"
                        >
                          &lt;
                        </button>
                        <div className="history-pages">
                          {getPageNumbers.map((pageNum, idx) => (
                            pageNum === '...' ? (
                              <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
                            ) : (
                              <button
                                key={pageNum}
                                type="button"
                                className={`ghost-btn page-btn ${pageNum === safeHistoryPage ? "active" : ""}`}
                                onClick={() => setHistoryPage(pageNum)}
                                aria-label={`Go to page ${pageNum}`}
                              >
                                {pageNum}
                              </button>
                            )
                          ))}
                        </div>
                        <button
                          type="button"
                          className="ghost-btn icon-btn"
                          onClick={() =>
                            setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))
                          }
                          disabled={safeHistoryPage === totalHistoryPages}
                          aria-label="Next page"
                        >
                          &gt;
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-history-state">
                    <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11H3v2h6v-2zm0-4H3v2h6V7zm6 0v2h6V7h-6zm0 4v2h6v-2h-6zM9 3H3v2h6V3zm6 0v2h6V3h-6z" />
                    </svg>
                    <h5>No History Yet</h5>
                    <p>History will list stock-ins, sales, quantity adjustments, who made them, and when.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="delete_product_group_button">
          {admin || currentUser?.permissions?.deleteproducts ? (
            <button onClick={() => confirmDelete(id)} className="btn_delete">
              <img src={deleteIcon} alt="" />
              Delete Item Group
            </button>
          ) : null}
        </div>
      </div>
    </div>

    <ImagePreviewModal
      isOpen={isImagePreviewOpen}
      imageSrc={previewImagePath}
      alt="Product group image"
      onClose={closeProductImage}
    />
  </>
);
}

