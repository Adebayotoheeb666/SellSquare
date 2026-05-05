import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ProductDetail.scss";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import productImg from "../../../assets/homepageicons/product-placeholder.jpg";
import joinImg from "../../../assets/homepageicons/joinImg.svg";
import buyerMarketplaceService from "../../../services/buyerMarketplaceService";
import { toast } from "sonner";

const ProductDetail = () => {
    const { productId, storeToken } = useParams();
    const navigate = useNavigate();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
    const [showZoom, setShowZoom] = useState(false);
    const [selectedAttributes, setSelectedAttributes] = useState({});
    const [product, setProduct] = useState(null); // This will hold the Group or Single product
    const [activeVariant, setActiveVariant] = useState(null); // Resolved variant for groups
    const [similarProducts, setSimilarProducts] = useState([]);
    const [sellerProducts, setSellerProducts] = useState([]);
    const [customerReviews, setCustomerReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const similarProductsRef = useRef(null);
    const sellerProductsRef = useRef(null);

    // Fetch product details from API
    useEffect(() => {
        const fetchProductDetails = async () => {
            try {
                setLoading(true);
                const response = await buyerMarketplaceService.getProductDetail(productId);
                const productData = response.data.data || response.data;

                setProduct(productData);

                // Initial attribute selection for groups
                if (productData.listingType === "group" && productData.listingOptions?.length > 0) {
                    const initialAttrs = {};
                    productData.listingOptions.forEach(opt => {
                        if (opt.options?.length > 0) {
                            initialAttrs[opt.attribute.toLowerCase()] = opt.options[0];
                        }
                    });
                    setSelectedAttributes(initialAttrs);
                }

                // Fetch other listings for "similar products" and "seller products"
                const listingsResponse = await buyerMarketplaceService.getListings({ limit: 10 });
                const allProducts = listingsResponse.data.data || listingsResponse.data;

                // Similar products
                const similar = allProducts
                    .filter(p => p.listingId !== productId && p.category === productData.category)
                    .slice(0, 5);
                setSimilarProducts(similar);

                // Seller products
                const fromSeller = allProducts
                    .filter(p =>
                        p.listingId !== productId &&
                        (storeToken
                            ? true
                            : p.businessId === productData.businessId)
                    )
                    .slice(0, 5);
                setSellerProducts(fromSeller.length > 0 ? fromSeller : similar);

                setCustomerReviews([]);
                setError(null);
            } catch (err) {
                console.error('Error fetching product details:', err);
                toast.error('Failed to load product details');
                setError('Failed to load product details');
                setProduct(null);
            } finally {
                setLoading(false);
            }
        };

        if (productId) {
            fetchProductDetails();
        }
    }, [productId, storeToken]);

    // Resolve active variant whenever attributes change
    useEffect(() => {
        if (product?.listingType === "group" && product.variants?.length > 0) {
            const selectedKeys = Object.values(selectedAttributes).map(v => String(v).toLowerCase());
            
            const match = product.variants.find(variant => {
                const variantName = variant.name.toLowerCase();
                return selectedKeys.every(key => variantName.includes(key));
            });

            setActiveVariant(match || product.variants[0]);
        } else {
            setActiveVariant(null);
        }
    }, [selectedAttributes, product]);

    const handlePrevImage = () => {
        const images = getImages();
        setCurrentImageIndex((prev) =>
            prev === 0 ? images.length - 1 : prev - 1
        );
    };

    const handleNextImage = () => {
        const images = getImages();
        setCurrentImageIndex((prev) =>
            prev === images.length - 1 ? 0 : prev + 1
        );
    };

    const getImages = () => {
        if (activeVariant?.images?.length > 0) return activeVariant.images.map(img => img.filePath || img);
        if (activeVariant?.image) return [activeVariant.image.filePath || activeVariant.image];
        if (product?.images?.length > 0) return product.images.map(img => img.filePath || img);
        if (product?.image) return [product.image.filePath || product.image];
        return [productImg];
    };

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setZoomPosition({ x, y });
    };

    const handleAttributeSelect = (attributeName, option) => {
        setSelectedAttributes((prev) => ({
            ...prev,
            [attributeName.toLowerCase()]: option,
        }));
        setCurrentImageIndex(0); // Reset image when changing variant
    };

    const handleScroll = (ref, direction) => {
        if (ref.current) {
            const scrollAmount = 260; // card width + gap
            ref.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    const handleSeeAll = () => {
        const name = product.listingType === "group" ? product.groupName : product.name;
        if (storeToken) {
            navigate(`/marketplace/store/${storeToken}`, {
                state: {
                    filterByCategory: product.category,
                    searchQuery: name.split(' ')[0]
                }
            });
        } else {
            navigate('/marketplace', {
                state: {
                    filterByCategory: product.category,
                    searchQuery: name.split(' ')[0]
                }
            });
        }
    };

    const handleAddToCart = async () => {
        const targetId = activeVariant ? activeVariant.variantId : product.productId;
        if (!targetId) return;

        try {
            await buyerMarketplaceService.createOrUpdateHold({
                productId: targetId,
                quantity: 1,
            });
            toast.success("Added to cart");
            if (storeToken) {
                navigate(`/marketplace/store/${storeToken}/cart`);
            } else {
                navigate("/marketplace/cart");
            }
        } catch (err) {
            toast.error(
                err?.response?.data?.message || "Unable to add to cart. Please try again."
            );
        }
    };

    const handleBuyNow = () => {
        const targetId = activeVariant ? activeVariant.variantId : product.productId;
        if (storeToken) {
            navigate(`/marketplace/store/${storeToken}/cart`);
        } else {
            navigate(`/marketplace/cart/${targetId}`);
        }
    };

    // Star Rating Component
    const StarRating = ({ rating }) => {
        const stars = [];
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars.push(
                    <svg
                        key={i}
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z"
                            fill="#FF9E48"
                        />
                    </svg>
                );
            } else if (i === fullStars && hasHalfStar) {
                stars.push(
                    <svg
                        key={i}
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <linearGradient id={`half-${i}`}>
                                <stop offset="50%" stopColor="#FF9E48" />
                                <stop offset="50%" stopColor="#E5E7EB" />
                            </linearGradient>
                        </defs>
                        <path
                            d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z"
                            fill={`url(#half-${i})`}
                        />
                    </svg>
                );
            } else {
                stars.push(
                    <svg
                        key={i}
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M6 0.5L7.34708 4.72746L11.7063 4.72746L8.17963 7.29508L9.52671 11.5225L6 8.95492L2.47329 11.5225L3.82037 7.29508L0.293661 4.72746L4.65292 4.72746L6 0.5Z"
                            fill="#E5E7EB"
                        />
                    </svg>
                );
            }
        }
        return <div className="star-rating">{stars}</div>;
    };

    return (
        <main className="product-detail-root">
            <div className="product-detail-top-hero">
                <SiteNav />
            </div>

            <section className="product-detail-section">
                {loading ? (
                    <div className="product-loading">Loading product details...</div>
                ) : error ? (
                    <div className="product-error">{error}</div>
                ) : !product ? (
                    <div className="product-not-found">Product not found</div>
                ) : (
                    <>
                        <div className="product-detail-container">
                            {/* Image Section */}
                            <div className="product-image-section">
                                <div className="main-image-container">
                                    <button
                                        className="image-nav-btn prev"
                                        onClick={handlePrevImage}
                                        aria-label="Previous image"
                                        disabled={getImages().length <= 1}
                                    >
                                        &lt;
                                    </button>

                                    <div
                                        className="main-image-wrapper"
                                        onMouseMove={handleMouseMove}
                                        onMouseEnter={() => setShowZoom(true)}
                                        onMouseLeave={() => setShowZoom(false)}
                                    >
                                        <img
                                            src={getImages()[currentImageIndex]}
                                            alt={product.listingType === "group" ? product.groupName : product.name}
                                            className="main-product-image"
                                        />

                                        {showZoom && (
                                            <div className="zoom-overlay">
                                                <div
                                                    className="zoomed-image"
                                                    style={{
                                                        backgroundImage: `url(${getImages()[currentImageIndex]})`,
                                                        backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        className="image-nav-btn next"
                                        onClick={handleNextImage}
                                        aria-label="Next image"
                                        disabled={getImages().length <= 1}
                                    >
                                        &gt;
                                    </button>
                                </div>
                            </div>

                            {/* Details Section */}
                            <div className="product-info-section">
                                <h1 className="product-detail-name">
                                    {activeVariant ? activeVariant.name : (product.listingType === "group" ? product.groupName : product.name)}
                                </h1>

                                <div className="price-section">
                                    <div className="current-price">
                                        ₦{(activeVariant ? (activeVariant.price?.effective || activeVariant.price) : (product.price?.effective || product.price || 0)).toLocaleString()}
                                    </div>
                                    {(activeVariant?.price?.discount?.amount > 0 || product.price?.discount?.amount > 0) && (
                                        <div className="slashed-price">
                                            ₦{(activeVariant ? activeVariant.price.base : product.price.base).toLocaleString()}
                                        </div>
                                    )}
                                </div>

                                <div className="action-buttons">
                                    <button 
                                        className="btn-add-cart" 
                                        onClick={handleAddToCart}
                                        disabled={activeVariant ? activeVariant.stock?.quantity <= 0 : product.stock?.quantity <= 0}
                                    >
                                        {activeVariant ? (activeVariant.stock?.quantity > 0 ? "Add to Cart" : "Out of Stock") : (product.stock?.hasStock || product.stock?.quantity > 0 ? "Add to Cart" : "Out of Stock")}
                                    </button>
                                    <button className="btn-buy-now" onClick={handleBuyNow}>Buy Now</button>
                                </div>

                                <div className="thumbnail-gallery">
                                    {getImages().map((image, index) => (
                                        <div
                                            key={index}
                                            className={`thumbnail ${index === currentImageIndex ? "active" : ""
                                                }`}
                                            onClick={() => setCurrentImageIndex(index)}
                                        >
                                            <img src={image} alt={`Thumbnail ${index + 1}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Product Attributes (for groups) */}
                        {product.listingType === "group" && product.listingOptions?.length > 0 && (
                            <div className="product-attributes">
                                {product.listingOptions.map((attr, index) => (
                                    <div key={index} className="attribute-group">
                                        <h4 className="attribute-name">{attr.attribute}</h4>
                                        <div className="attribute-options">
                                            {attr.options.map((option, optIndex) => (
                                                <button
                                                    key={optIndex}
                                                    className={`attribute-option ${selectedAttributes[attr.attribute.toLowerCase()] === option
                                                        ? "active"
                                                        : ""
                                                        }`}
                                                    onClick={() =>
                                                        handleAttributeSelect(attr.attribute, option)
                                                    }
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="product-description">
                            <h3>Product Specification</h3>
                            <div className="product-description-divider"></div>
                            <p>{product.description || 'No description available'}</p>
                        </div>
                    </>
                )}

                        {!loading && !error && product && (
                            <>
                                {/* Similar Products Section */}
                                <div className="product-recommendations">
                                    <div className="recommendations-header">
                                        <h3>Other Similar Products</h3>
                                        <button className="see-all-btn" onClick={handleSeeAll}>
                                            See All
                                        </button>
                                    </div>
                                    <div className="recommendations-carousel">
                                        <button
                                            className="carousel-nav-btn prev"
                                            onClick={() => handleScroll(similarProductsRef, "left")}
                                        >
                                            &lt;
                                        </button>
                                        <div className="recommendations-list" ref={similarProductsRef}>
                                            {similarProducts.map((prod) => (
                                                <div
                                                    key={prod._id}
                                                    className="recommendation-card"
                                                    onClick={() => {
                                                        if (storeToken) {
                                                            navigate(`/marketplace/store/${storeToken}/product/${prod._id}`);
                                                        } else {
                                                            navigate(`/marketplace/product/${prod._id}`);
                                                        }
                                                    }}
                                                >
                                                    <div className="recommendation-image-container">
                                                        <img
                                                            src={prod.images?.[0] || prod.image || productImg}
                                                            alt={prod.name}
                                                            className="recommendation-image"
                                                        />
                                                    </div>
                                                    <div className="recommendation-details">
                                                        <h4 className="recommendation-name">{prod.name}</h4>
                                                        <div className="recommendation-price">
                                                            ₦{(prod.price || 0).toLocaleString()}
                                                        </div>
                                                        {prod.originalPrice && (
                                                            <div className="recommendation-slashed-price">
                                                                ₦{prod.originalPrice.toLocaleString()}
                                                            </div>
                                                        )}
                                                        <div className="recommendation-rating">
                                                            <StarRating rating={prod.rating || 4} />
                                                            <span className="recommendation-rating-text">
                                                                {(prod.rating || 4).toFixed(1)} ({prod.reviews || 0})
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            className="carousel-nav-btn next"
                                            onClick={() => handleScroll(similarProductsRef, "right")}
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                </div>

                                {/* Seller Products Section */}
                                <div className="product-recommendations">
                                    <div className="recommendations-header">
                                        <h3>Other Products from this Seller</h3>
                                        <button className="see-all-btn" onClick={handleSeeAll}>
                                            See All
                                        </button>
                                    </div>
                                    <div className="recommendations-carousel">
                                        <button
                                            className="carousel-nav-btn prev"
                                            onClick={() => handleScroll(sellerProductsRef, "left")}
                                        >
                                            &lt;
                                        </button>
                                        <div className="recommendations-list" ref={sellerProductsRef}>
                                            {sellerProducts.map((prod) => (
                                                <div
                                                    key={prod._id}
                                                    className="recommendation-card"
                                                    onClick={() => {
                                                        if (storeToken) {
                                                            navigate(`/marketplace/store/${storeToken}/product/${prod._id}`);
                                                        } else {
                                                            navigate(`/marketplace/product/${prod._id}`);
                                                        }
                                                    }}
                                                >
                                                    <div className="recommendation-image-container">
                                                        <img
                                                            src={prod.images?.[0] || prod.image || productImg}
                                                            alt={prod.name}
                                                            className="recommendation-image"
                                                        />
                                                    </div>
                                                    <div className="recommendation-details">
                                                        <h4 className="recommendation-name">{prod.name}</h4>
                                                        <div className="recommendation-price">
                                                            ₦{(prod.price || 0).toLocaleString()}
                                                        </div>
                                                        {prod.originalPrice && (
                                                            <div className="recommendation-slashed-price">
                                                                ₦{prod.originalPrice.toLocaleString()}
                                                            </div>
                                                        )}
                                                        <div className="recommendation-rating">
                                                            <StarRating rating={prod.rating || 4} />
                                                            <span className="recommendation-rating-text">
                                                                {(prod.rating || 4).toFixed(1)} ({prod.reviews || 0})
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            className="carousel-nav-btn next"
                                            onClick={() => handleScroll(sellerProductsRef, "right")}
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                </div>

                                {/* Customer Reviews Section */}
                                <div className="product-reviews">
                                    <div className="reviews-header">
                                        <div className="reviews-header-left">
                                            <h3>Reviews from other customers</h3>
                                            <div className="reviews-overall-rating">
                                                <StarRating rating={product.rating || 4} />
                                                <span className="reviews-rating-text">
                                                    {(product.rating || 4).toFixed(1)} ({product.reviews || 0} reviews)
                                                </span>
                                            </div>
                                        </div>
                                        <button className="see-all-btn">See All</button>
                                    </div>
                                    <div className="reviews-divider"></div>
                                    <div className="reviews-list">
                                        {customerReviews.length > 0 ? (
                                            customerReviews.map((review) => (
                                                <div key={review.id} className="review-item">
                                                    <div className="review-content">
                                                        <p className="review-text">{review.review}</p>
                                                        <span className="review-name">{review.name}</span>
                                                    </div>
                                                    <div className="review-meta">
                                                        <StarRating rating={review.rating} />
                                                        <span className="review-date">{review.date}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p>No reviews yet</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
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
                                <a className="btn create-store" href="/signup">Create My Free Store</a>
                                <a className="btn explore-market" href="/marketplace">Explore the Marketplace</a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
};

export default ProductDetail;
