import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useSelector } from "react-redux";
import "./Marketplace.scss";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import infoIcon from "../../../assets/homepageicons/info-icon.svg";
import sortIcon from "../../../assets/homepageicons/sort-icon.svg";
import searchIcon from "../../../assets/homepageicons/search-icon.svg";
import categoryImg from "../../../assets/homepageicons/category-placeholder.svg";
import categorySideImg from "../../../assets/homepageicons/category-side-img.svg";
import bannerLeftImg from "../../../assets/homepageicons/banner-left.svg";
import bannerRightImg from "../../../assets/homepageicons/banner-right.svg";
import productImg from "../../../assets/homepageicons/product-placeholder.jpg";
import joinImg from "../../../assets/homepageicons/joinImg.svg";
import buyerMarketplaceService from "../../../services/buyerMarketplaceService";
import { selectBuyer } from "../../../redux/features/buyerAuth/buyerAuthSlice";
import { toast } from "sonner";

const Marketplace = () => {
    const navigate = useNavigate();
    const { storeToken } = useParams();
    const buyer = useSelector(selectBuyer);
    const [showFilter, setShowFilter] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState({
        priceRange: "",
        category: "",
        rating: "",
        availability: ""
    });
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categorySearch, setCategorySearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const productsPerPage = 6;

    // Fetch products from backend
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                // Pass storeToken as query param if available (for store-filtered views)
                const response = await buyerMarketplaceService.getListings({
                    storeToken: storeToken || undefined,
                });
                const productsData = response.data.data || response.data;

                // Extract unique categories from products
                const uniqueCategories = [...new Set(
                    productsData.map(p => p.category || 'Uncategorized')
                )].map((categoryName, index) => ({
                    id: index + 1,
                    name: categoryName,
                    image: categoryImg
                }));

                setProducts(productsData);
                setCategories(uniqueCategories);
                setError(null);
            } catch (err) {
                console.error('Error fetching products:', err);
                toast.error('Failed to load marketplace products');
                setError('Failed to load products');
                setProducts([]);
                setCategories([]);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [storeToken]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (storeToken) params.set("storeToken", storeToken);

        const isDevelopment =
            process.env.NODE_ENV === "development" &&
            window.location.hostname === "localhost";

        const streamUrl = isDevelopment
            ? `http://localhost:4000/api/buyer/marketplace/products/stream${params.toString() ? `?${params.toString()}` : ""}`
            : `/api/buyer/marketplace/products/stream${params.toString() ? `?${params.toString()}` : ""}`;

        const eventSource = new EventSource(streamUrl);

        const onInventoryUpdate = (event) => {
            try {
                const payload = JSON.parse(event.data || "{}");
                if (!payload.productId) return;

                setProducts((prev) =>
                    prev.map((product) =>
                        String(product._id) === String(payload.productId)
                            ? {
                                ...product,
                                availableQty: Number(payload.availableQty || 0),
                                inStock: Number(payload.availableQty || 0) > 0,
                            }
                            : product,
                    ),
                );
            } catch (parseError) {
                console.error("Failed to parse inventory stream event", parseError);
            }
        };

        eventSource.addEventListener("inventory.hold_updated", onInventoryUpdate);
        eventSource.onerror = () => {
            // Browser EventSource handles reconnection automatically.
        };

        return () => {
            eventSource.removeEventListener("inventory.hold_updated", onInventoryUpdate);
            eventSource.close();
        };
    }, [storeToken]);

    // Star Rating Component
    const StarRating = ({ rating }) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                // Full star
                stars.push(
                    <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z" fill="#FF9E48" />
                    </svg>
                );
            } else if (i === fullStars && hasHalfStar) {
                // Half star
                stars.push(
                    <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id={`half-${i}`}>
                                <stop offset="50%" stopColor="#FF9E48" />
                                <stop offset="50%" stopColor="#E5E7EB" />
                            </linearGradient>
                        </defs>
                        <path d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z" fill={`url(#half-${i})`} />
                    </svg>
                );
            } else {
                // Empty star
                stars.push(
                    <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z" fill="#E5E7EB" />
                    </svg>
                );
            }
        }

        return <div className="star-rating">{stars}</div>;
    };

    // Use fetched categories and products from state

    // Filter categories based on search
    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(categorySearch.toLowerCase())
    );

    // Filter products based on all criteria
    const filteredProducts = products.filter(product => {
        // Category filter
        if (selectedCategory && product.category !== selectedCategory) {
            return false;
        }

        // Price range filter
        if (selectedFilters.priceRange) {
            const price = product.price || 0;
            if (selectedFilters.priceRange === "0-10000" && price > 10000) return false;
            if (selectedFilters.priceRange === "10000-50000" && (price < 10000 || price > 50000)) return false;
            if (selectedFilters.priceRange === "50000+" && price < 50000) return false;
        }

        // Rating filter
        if (selectedFilters.rating) {
            const minRating = parseFloat(selectedFilters.rating);
            if ((product.rating || 0) < minRating) return false;
        }

        // Availability filter
        if (selectedFilters.availability) {
            const inStock = Number(product.availableQty || 0) > 0;
            if (selectedFilters.availability === "in-stock" && !inStock) return false;
            if (selectedFilters.availability === "out-of-stock" && inStock) return false;
        }

        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
    const startIndex = (currentPage - 1) * productsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + productsPerPage);

    // Reset to page 1 when filters change
    const handleFilterChange = (filterType, value) => {
        setSelectedFilters({ ...selectedFilters, [filterType]: value });
        setCurrentPage(1);
    };

    const handleCategorySelect = (categoryName) => {
        setSelectedCategory(categoryName === selectedCategory ? null : categoryName);
        setCurrentPage(1);
    };

    return (
        <main className="marketplace-root">
            <Helmet>
                <title>Sell Square Marketplace - Buy & Sell Products Locally Online</title>
                <meta
                    name="description"
                    content="Discover and shop from local trusted businesses on Sell Square Marketplace. Browse electronics, fashion, home goods, and more. Support local sellers and track your orders with ease."
                />
                <meta
                    name="keywords"
                    content="local marketplace Nigeria, buy products online, sell products locally, online shopping Nigeria, local businesses, trusted sellers, product marketplace, buy local, African marketplace, ecommerce Nigeria"
                />
                <meta name="author" content="Sell Square" />
                <meta name="robots" content="index, follow" />
                <meta property="og:title" content="Sell Square Marketplace - Shop Local Products Online" />
                <meta
                    property="og:description"
                    content="Shop from local trusted businesses. Discover quality products, support local sellers, and enjoy seamless order tracking."
                />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://www.sellsquarehub.com/marketplace" />
                <meta property="og:site_name" content="Sell Square" />
                <meta
                    property="og:image"
                    content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
                />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Sell Square Marketplace" />
                <meta
                    name="twitter:description"
                    content="Shop local products from trusted businesses across Nigeria."
                />
                <meta
                    name="twitter:image"
                    content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
                />
                <link rel="canonical" href="https://www.sellsquarehub.com/marketplace" />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "WebPage",
                        "name": "Sell Square Marketplace",
                        "description":
                            "Local marketplace for buying and selling products online. Shop from trusted local businesses.",
                        "url": "https://www.sellsquarehub.com/marketplace"
                    })}
                </script>
            </Helmet>
            <div className="marketplace-top-hero">
                <SiteNav />
            </div>

            <section className="marketplace-content-section">
                <div className="marketplace-content-inner">
                    {/* Top Header */}
                    <div className="marketplace-header">
                        <div className="welcome-section">
                            <h2 className="welcome-text">
                                {buyer ? (
                                    <>
                                        Welcome back, <strong>{buyer.firstName || buyer.email}</strong> 👋
                                    </>
                                ) : (
                                    <>
                                        Welcome to <strong>Sell Square Marketplace</strong> 👋
                                    </>
                                )}
                            </h2>
                            <img src={infoIcon} alt="Info" className="m-info-icon" />
                        </div>

                        <div className="filter-section">
                            <button
                                className="filter-btn"
                                onClick={() => setShowFilter(!showFilter)}
                            >
                                <img src={sortIcon} alt="Filter" />
                                <span>Filter</span>
                            </button>

                            {showFilter && (
                                <div className="filter-dropdown">
                                    <div className="filter-group">
                                        <label>Price Range</label>
                                        <select
                                            value={selectedFilters.priceRange}
                                            onChange={(e) => handleFilterChange('priceRange', e.target.value)}
                                        >
                                            <option value="">All Prices</option>
                                            <option value="0-10000">₦0 - ₦10,000</option>
                                            <option value="10000-50000">₦10,000 - ₦50,000</option>
                                            <option value="50000+">₦50,000+</option>
                                        </select>
                                    </div>
                                    <div className="filter-group">
                                        <label>Rating</label>
                                        <select
                                            value={selectedFilters.rating}
                                            onChange={(e) => handleFilterChange('rating', e.target.value)}
                                        >
                                            <option value="">All Ratings</option>
                                            <option value="4+">4+ Stars</option>
                                            <option value="3+">3+ Stars</option>
                                        </select>
                                    </div>
                                    <div className="filter-group">
                                        <label>Availability</label>
                                        <select
                                            value={selectedFilters.availability}
                                            onChange={(e) => handleFilterChange('availability', e.target.value)}
                                        >
                                            <option value="">All Products</option>
                                            <option value="in-stock">In Stock</option>
                                            <option value="out-of-stock">Out of Stock</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="marketplace-main">
                        {/* Categories Sidebar */}
                        <aside className="categories-sidebar">
                            <h3 className="sidebar-header">Categories</h3>

                            <div className="category-search">
                                <img src={searchIcon} alt="Search" className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search categories..."
                                    className="category-search-input"
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                />
                            </div>

                            <div className="category-divider"></div>

                            <div className="category-list">
                                {filteredCategories.map(cat => (
                                    <div
                                        key={cat.id}
                                        className={`category-item ${selectedCategory === cat.name ? 'active' : ''}`}
                                        onClick={() => handleCategorySelect(cat.name)}
                                    >
                                        <img src={cat.image} alt={cat.name} className="category-icon" />
                                        <span className="category-name">{cat.name}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="category-bottom">
                                <span className="category-bottom-text">We got it all ready for you at Temmy Ventures</span>
                                <img src={categorySideImg} alt="Category promo" className="category-bottom-img" />
                            </div>
                        </aside>

                        {/* Products Section */}
                        <div className="products-section">
                            {/* Banner */}
                            <div className="marketplace-banner">
                                <img src={bannerLeftImg} alt="" className="banner-img banner-left" />
                                <div className="banner-content">
                                    <h2 className="banner-title">{selectedCategory || "All Products"}</h2>
                                    <p className="banner-subtitle">
                                        {selectedCategory
                                            ? `Discover the latest ${selectedCategory.toLowerCase()} products`
                                            : "Discover the latest products from trusted sellers"}
                                    </p>
                                </div>
                                <img src={bannerRightImg} alt="" className="banner-img banner-right" />
                            </div>

                            {/* Products Grid */}
                            <div className="products-grid">
                                {loading ? (
                                    <div className="products-loading">Loading products...</div>
                                ) : error ? (
                                    <div className="products-error">{error}</div>
                                ) : paginatedProducts.length === 0 ? (
                                    <div className="products-empty">No products found</div>
                                ) : (
                                    paginatedProducts.map(product => {
                                        const isGroup = product.listingType === "group";
                                        const displayName = isGroup ? product.groupName : product.name;
                                        const listingId = product.listingId;
                                        const displayPrice = isGroup 
                                            ? (product.variants?.length > 0 ? Math.min(...product.variants.map(v => v.price?.effective || v.price || 0)) : 0)
                                            : (product.price?.effective || product.price || 0);
                                        const hasStock = isGroup ? product.stock?.hasStock : (product.availableQty > 0 || product.stock?.quantity > 0);

                                        return (
                                            <div
                                                key={listingId}
                                                className="product-card"
                                                onClick={() => {
                                                    if (storeToken) {
                                                        navigate(`/marketplace/store/${storeToken}/product/${listingId}`);
                                                    } else {
                                                        navigate(`/marketplace/product/${listingId}`);
                                                    }
                                                }}
                                            >
                                                <div className="product-image-container">
                                                    <img
                                                        src={
                                                            (product.images?.[0]?.filePath || product.images?.[0] || product.image?.filePath || product.image || productImg)
                                                        }
                                                        alt={displayName}
                                                        className="product-image"
                                                    />
                                                    {isGroup && <div className="product-tag">Group</div>}
                                                    <button className="product-more">⋯</button>
                                                </div>
                                                <div className="product-details">
                                                    <h4 className="product-name">{displayName}</h4>
                                                    <div className="product-price">
                                                        {isGroup && <span className="price-from">From </span>}
                                                        ₦{Number(displayPrice || 0).toLocaleString()}
                                                    </div>
                                                    {product.price?.discount?.amount > 0 && (
                                                        <div className="product-slashed-price">
                                                            ₦{Number(product.price.base || 0).toLocaleString()}
                                                        </div>
                                                    )}
                                                    <div className="product-rating">
                                                        <StarRating rating={product.rating || 4} />
                                                        <span className="rating-text">
                                                            {(product.rating || 4).toFixed(1)} ({product.reviews || 0})
                                                        </span>
                                                    </div>
                                                    <div className="rating-text" style={{ marginTop: 4 }}>
                                                        {hasStock ? (isGroup ? "Available" : "In Stock") : "Out of stock"}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="pagination-bar marketplace">
                                    {/* Previous Button */}
                                    <button
                                        className="pagination-nav"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        &lt;
                                    </button>

                                    {/* Page Numbers */}
                                    {(() => {
                                        const pageNumbers = [];
                                        const maxVisible = 6;

                                        if (totalPages <= maxVisible) {
                                            // Show all pages if total is less than or equal to maxVisible
                                            for (let i = 1; i <= totalPages; i++) {
                                                pageNumbers.push(
                                                    <button
                                                        key={i}
                                                        className={`pagination-btn ${currentPage === i ? 'active' : ''}`}
                                                        onClick={() => setCurrentPage(i)}
                                                    >
                                                        {i}
                                                    </button>
                                                );
                                            }
                                        } else {
                                            // Always show first page
                                            pageNumbers.push(
                                                <button
                                                    key={1}
                                                    className={`pagination-btn ${currentPage === 1 ? 'active' : ''}`}
                                                    onClick={() => setCurrentPage(1)}
                                                >
                                                    1
                                                </button>
                                            );

                                            // Calculate range around current page
                                            let startPage = Math.max(2, currentPage - 1);
                                            let endPage = Math.min(totalPages - 1, currentPage + 1);

                                            // Adjust if we're near the start
                                            if (currentPage <= 3) {
                                                endPage = Math.min(maxVisible - 1, totalPages - 1);
                                            }

                                            // Adjust if we're near the end
                                            if (currentPage >= totalPages - 2) {
                                                startPage = Math.max(2, totalPages - (maxVisible - 2));
                                            }

                                            // Add ellipsis before if needed
                                            if (startPage > 2) {
                                                pageNumbers.push(
                                                    <span key="ellipsis-start" className="pagination-ellipsis">
                                                        ...
                                                    </span>
                                                );
                                            }

                                            // Add middle pages
                                            for (let i = startPage; i <= endPage; i++) {
                                                pageNumbers.push(
                                                    <button
                                                        key={i}
                                                        className={`pagination-btn ${currentPage === i ? 'active' : ''}`}
                                                        onClick={() => setCurrentPage(i)}
                                                    >
                                                        {i}
                                                    </button>
                                                );
                                            }

                                            // Add ellipsis after if needed
                                            if (endPage < totalPages - 1) {
                                                pageNumbers.push(
                                                    <span key="ellipsis-end" className="pagination-ellipsis">
                                                        ...
                                                    </span>
                                                );
                                            }

                                            // Always show last page
                                            pageNumbers.push(
                                                <button
                                                    key={totalPages}
                                                    className={`pagination-btn ${currentPage === totalPages ? 'active' : ''}`}
                                                    onClick={() => setCurrentPage(totalPages)}
                                                >
                                                    {totalPages}
                                                </button>
                                            );
                                        }

                                        return pageNumbers;
                                    })()}

                                    {/* Next Button */}
                                    <button
                                        className="pagination-nav"
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        &gt;
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>


            <section className="join-sellers-section">
                <div className="join-sellers-inner">
                    <div className="join-sellers-box">
                        <div className="join-media">
                            <img src={joinImg} alt="sellers growing" />
                        </div>
                        <div className="join-content">
                            <h3 className="join-title">
                                Join The Train of Sellers Who Are Growing Their Businesses with <span className="join-brand">SellSquare</span>
                            </h3>
                            <div className="join-ctas">
                                <a className="btn create-store" href="/register">Create My Free Store</a>
                                <a className="btn explore-market" href="/marketplace">Explore the Marketplace</a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Site footer component */}
            <Footer />
        </main>
    );
};

export default Marketplace;
