import React, { useEffect, useMemo, useState } from "react";
import "./productDetail.css";
import editIcon2 from "../../../assets/home/pencil-2.svg";
import deleteIcon from "../../../assets/home/delete-icon.svg";
import xcrossIcon from "../../../assets/home/xcrossIcon.svg";
import backArrowIcon from "../../../assets/home/arrow-left.svg";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { batchToggleProducts, deleteProduct } from "../../../redux/features/product/productSlice";
import { selectUser, selectLoggedInBusinessOwner } from "../../../redux/features/auth/authSlice";
import { selectAllProductsArray } from "../../../redux/features/product/productCacheSlice";
import { selectProductGroupsArray } from "../../../redux/features/dataCache/bulkDataCacheSlice";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css";
import { toast } from "sonner";
import moment from "moment";
import useFormatter from "../../../customHook/useFormatter";
import { useAsyncButtons } from "../../../customHook/useAsyncButton";
import ButtonSpinner from "../../../components/loader/ButtonSpinner";
import { getPrimaryImagePath } from "../../../utils/productImageUtils";

export default function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const currentUser = useSelector(selectUser);
    const admin = useSelector(selectLoggedInBusinessOwner);
    const products = useSelector(selectAllProductsArray);
    const productGroups = useSelector(selectProductGroupsArray);
    const { isLoading: buttonLoading, execute } = useAsyncButtons();

    const [showProductImage, setShowProductImage] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [historySearch, setHistorySearch] = useState("");
    const [historyStartDate, setHistoryStartDate] = useState("");
    const [historyEndDate, setHistoryEndDate] = useState("");
    const [historyPage, setHistoryPage] = useState(1);
    const { formatter } = useFormatter();
    const HISTORY_PAGE_SIZE = 10;

    /**
     * EVENT-DRIVEN ARCHITECTURE:
     * Products are bulk-loaded during bootstrap (useDataBootstrap in Layout).
     * This component NEVER fetches data - it only reads from Redux cache.
     * Updates come via WebSocket events which update the productCache directly.
     * 
     * If a product is not found, it means:
     * 1. Bootstrap hasn't completed yet (show loading)
     * 2. Product was deleted (show error)
     * 3. Invalid ID from URL (show error)
     */
    const product = useMemo(() => {
        return products?.find((p) => p._id === id) || null;
    }, [products, id]);

    const history = product?.history ?? [];
    const priceForHistory = product?.price ?? 0;

    const productGroup = useMemo(() => {
        if (!product?.itemGroup) return null;
        return productGroups?.find((group) => group?._id === product.itemGroup) || null;
    }, [productGroups, product]);

    const getImageIdentity = (image) => {
        if (!image || typeof image !== "object") return "";
        return image.filePath || image.fileName || JSON.stringify(image);
    };

    const getCombinedImageCount = (selectedProduct, group) => {
        const productImages = Array.isArray(selectedProduct?.images) ? selectedProduct.images : [];
        const groupImages = Array.isArray(group?.images) ? group.images : [];
        const combined = [...productImages, ...groupImages];
        const seen = new Set();

        combined.forEach((image) => {
            const key = getImageIdentity(image);
            if (key) {
                seen.add(key);
            }
        });

        return seen.size;
    };

    const delProduct = async (productId) => {
        await execute(`delete-${productId}`, async () => {
            await dispatch(deleteProduct(productId));
            toast.success("Product deleted successfully");
            // Redirect back to products list
            setTimeout(() => {
                navigate("/inventory");
            }, 1000);
        });
    };

    const confirmDelete = () => {
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

    const handleShowProductImage = (imagePath) => {
        setSelectedImage(imagePath);
        setShowProductImage(true);
    };

    const closeProductImage = () => {
        setShowProductImage(false);
        setSelectedImage(null);
    };

    const handleToggleListProduct = async () => {
        if (!product) return;
        const nextListState = !product.listProduct;

        if (nextListState) {
            const totalImages = getCombinedImageCount(product, productGroup);
            if (totalImages < 2) {
                toast.error("Add at least 2 combined images to list this product");
                return;
            }
        }

        await execute(`list-${product._id}`, async () => {
            await dispatch(
                batchToggleProducts({ productIds: [product._id], listProduct: nextListState })
            );
            toast.success(nextListState ? "Product listed successfully" : "Product unlisted successfully");
        });
    };

    useEffect(() => {
        setHistoryPage(1);
    }, [historySearch, historyStartDate, historyEndDate, id]);

    const parsedStartDate = historyStartDate
        ? moment(historyStartDate).startOf("day")
        : null;
    const parsedEndDate = historyEndDate ? moment(historyEndDate).endOf("day") : null;

    const filteredHistory = useMemo(
        () =>
            history.filter((entry) => {
                const entryDate = entry?.date ? moment(entry.date) : null;

                if (parsedStartDate || parsedEndDate) {
                    if (!entryDate) return false;
                    if (parsedStartDate && entryDate.isBefore(parsedStartDate)) return false;
                    if (parsedEndDate && entryDate.isAfter(parsedEndDate)) return false;
                }

                const term = historySearch.trim().toLowerCase();
                if (term) {
                    const haystack = `${entry.type || ""} ${entry.performedBy || ""} ${entry.note || ""}`.toLowerCase();
                    if (!haystack.includes(term)) return false;
                }

                return true;
            }),
        [history, historyEndDate, historySearch, historyStartDate, parsedEndDate, parsedStartDate]
    );

    const filteredMetrics = useMemo(
        () =>
            filteredHistory.reduce(
                (acc, entry) => {
                    const qty = Math.abs(entry?.quantityChange ?? 0);

                    if (entry?.type === "sale") {
                        const unitAmount = typeof entry?.amount === "number" ? entry.amount : priceForHistory;
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
        [filteredHistory, priceForHistory]
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

    if (!product) {
        return (
            <div className="product-detail-container">
                <div className="product-detail-loading">
                    <p>Product not found. It may have been deleted or the ID is invalid.</p>
                    <Link to="/inventory" className="ghost-btn">
                        ← Back to Inventory
                    </Link>
                </div>
            </div>
        );
    }

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
        image,
        images,
        createdAt,
        updatedAt,
    } = product;
    const primaryImagePath = getPrimaryImagePath(images, image);

    const discountPricing = product?.discountPricing || {};
    const hasRecordedSalesDiscount = Boolean(discountPricing?.hasDiscount);
    const originalPrice = Number(discountPricing?.originalPrice || price || 0);
    const effectivePrice = hasRecordedSalesDiscount
        ? Number(discountPricing?.discountedPrice || originalPrice)
        : Number(price || 0);

    const totalValuePrice = effectivePrice * (quantity || 0);
    const totalValueCost = (cost || 0) * (quantity || 0);

    const format = "DD-MM-YYYY h:mmA";
    const formattedCreatedAt = moment(createdAt).format(format);
    const formattedUpdatedAt = moment(updatedAt).format(format);

    const showingFrom = filteredHistory.length === 0 ? 0 : historySliceStart + 1;
    const showingTo = Math.min(historySliceStart + paginatedHistory.length, filteredHistory.length);

    return (
        <div className="product-detail-wrapper">
            {/* Hero Section */}
            <div className="product-hero">
                <div className="product-hero__title">
                    <div className="product-hero__content">
                        <div className="hero-top">
                            <Link to="/inventory" className="hero-back" title="Back to Inventory">
                                <img src={backArrowIcon} alt="back" />
                                Back
                            </Link>
                            <p className="product-hero__eyebrow">Inventory / Product detail</p>
                        </div>
                        <h1>{name}</h1>
                        <div className="pill-row">
                            <span className="pill pill--muted">SKU: {sku || "N/A"}</span>
                            <span className={`pill ${Number(quantity) === 0 ? "pill--danger" : "pill--success"}`}>
                                {Number(quantity) === 0 ? "Out of stock" : "In stock"}
                            </span>
                        </div>
                    </div>
                    <div className="hero-actions">
                        {admin || currentUser?.permissions?.editproducts ? (
                            <Link className="ghost-btn" to={`/edit-product/${_id}`} title="Edit Product">
                                <img src={editIcon2} alt="edit" />
                                <span>Edit</span>
                            </Link>
                        ) : null}
                        {admin || currentUser?.permissions?.editproducts ? (
                            <button
                                onClick={handleToggleListProduct}
                                title={product?.listProduct ? "Unlist Product" : "List Product"}
                                className={`ghost-btn ghost-btn--listing ${product?.listProduct ? "is-on" : "is-off"}`}
                                disabled={buttonLoading(`list-${_id}`)}
                            >
                                {buttonLoading(`list-${_id}`) ? (
                                    <ButtonSpinner />
                                ) : (
                                    <>
                                        <span className="btn-text">Listing</span>
                                        <span className="btn-state">{product?.listProduct ? "On" : "Off"}</span>
                                    </>
                                )}
                            </button>
                        ) : null}
                        {admin || currentUser?.permissions?.deleteProducts ? (
                            <button
                                onClick={confirmDelete}
                                title="Delete Product"
                                className="ghost-btn ghost-btn--danger"
                                disabled={buttonLoading(`delete-${_id}`)}
                            >
                                {buttonLoading(`delete-${_id}`) ? <ButtonSpinner /> : <img src={deleteIcon} alt="delete" />}
                                <span>Delete</span>
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Quick Info Pills */}
            <div className="meta-pills-wrapper">
                <div className="meta-pills">
                    <div className="pill pill--meta">
                        <p>Category</p>
                        <strong>{category || "Uncategorized"}</strong>
                    </div>
                    <div className="pill pill--meta">
                        <p>Warehouse</p>
                        <strong>{warehouse || "Not specified"}</strong>
                    </div>
                    <div className="pill pill--meta pill--date">
                        <p>Created</p>
                        <strong>{formattedCreatedAt}</strong>
                    </div>
                    <div className="pill pill--meta pill--date">
                        <p>Last updated</p>
                        <strong>{formattedUpdatedAt}</strong>
                    </div>
                    <div className="pill pill--meta">
                        <p>Quantity In Stock</p>
                        <strong className={Number(quantity) === 0 ? "text-danger" : "text-success"}>{quantity}</strong>
                    </div>
                    <div className="pill pill--meta">
                        <p>Selling Price</p>
                        {hasRecordedSalesDiscount ? (
                            <div className="discount-price-inline">
                                <span className="discount-price-old">{formatter(originalPrice)}</span>
                                <strong className="discount-price-new">{formatter(effectivePrice)}</strong>
                            </div>
                        ) : (
                            <strong>{formatter(effectivePrice)}</strong>
                        )}
                    </div>
                    {admin || currentUser?.permissions?.seeBusinessFinances ? (
                        <>
                            <div className="pill pill--meta">
                                <p>Cost Price</p>
                                <strong>{formatter(cost)}</strong>
                            </div>
                            <div className="pill pill--meta">
                                <p>Total Value (Cost)</p>
                                <strong>{formatter(totalValueCost)}</strong>
                            </div>
                            <div className="pill pill--meta">
                                <p>Total Value (Price)</p>
                                <strong>{formatter(totalValuePrice)}</strong>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="product-shell">
                {/* Media Section */}
                <div className="product-media">
                    {primaryImagePath ? (
                        <div className="media-card" onClick={() => handleShowProductImage(primaryImagePath)}>
                            <img src={primaryImagePath} alt={name} loading="lazy" />
                            <div className="media-overlay">Click to enlarge</div>
                        </div>
                    ) : (
                        <div className="media-card media-card--empty">
                            <p>No image available</p>
                        </div>
                    )}
                </div>

                {/* Details Section */}
                <div className="product-main">
                    <div className="info-panels">
                        {/* Description */}
                        <div className="panel">
                            <div className="panel-header">
                                <h4>Description</h4>
                            </div>
                            <p className="description-body">{description || "No description provided."}</p>
                        </div>

                        {/* Product History */}
                        <div className="panel">
                            <div className="panel-header">
                                <h4>Product history</h4>
                            </div>

                            {/* History Summary */}
                            <div className="history-summary">
                                <div className="pill pill--meta">
                                    <p>Total sold</p>
                                    <strong>{filteredMetrics.totalSold}</strong>
                                </div>
                                <div className="pill pill--meta">
                                    <p>Total revenue</p>
                                    <strong>{formatter(filteredMetrics.totalRevenue)}</strong>
                                </div>
                                <div className="pill pill--meta">
                                    <p>Total stocked in</p>
                                    <strong>{filteredMetrics.totalStocked}</strong>
                                </div>
                            </div>

                            <div className="history-controls">
                                <div className="history-filters">
                                    <input
                                        type="search"
                                        className="history-search"
                                        placeholder="Search by type, note, or actor"
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

                            {/* History Table */}
                            <div className="history-table-wrapper">
                                <div className="history-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Type</th>
                                                <th>Qty change</th>
                                                <th>Balance</th>
                                                <th>Performed by</th>
                                                <th>Note</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedHistory && paginatedHistory.length > 0 ? (
                                                paginatedHistory.map((entry, idx) => {
                                                    const date = entry?.date ? moment(entry.date).format(format) : "";
                                                    const type = entry?.type || "";
                                                    const change = entry?.quantityChange ?? 0;
                                                    const balance = entry?.balance ?? "";
                                                    const actor = entry?.performedBy || "";
                                                    const note = entry?.note || "";
                                                    return (
                                                        <tr key={idx}>
                                                            <td>{date}</td>
                                                            <td className={type === "sale" ? "text-danger" : ""}>
                                                                {type === "sale" ? "Sale" : type === "stock-in" ? "Stock in" : type}
                                                            </td>
                                                            <td className={change < 0 ? "text-danger" : "text-success"}>{change}</td>
                                                            <td>{balance}</td>
                                                            <td>{actor}</td>
                                                            <td>{note || "—"}</td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="muted">
                                                        History will list stock-ins, sales, quantity adjustments, who made
                                                        them, and when. No entries yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
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
                                        onClick={() => setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))}
                                        disabled={safeHistoryPage === totalHistoryPages}
                                        aria-label="Next page"
                                    >
                                        &gt;
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Preview Modal */}
            {showProductImage && (
                <div className="show_product_image" onClick={closeProductImage}>
                    <div className="close_btn" onClick={closeProductImage}>
                        <img src={xcrossIcon} alt="close" />
                    </div>
                    <div className="product_image_preview">
                        <img loading="lazy" src={selectedImage} alt="enlarged product" />
                    </div>
                </div>
            )}
        </div>
    );
}
