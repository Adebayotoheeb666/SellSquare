import React, { useState, useEffect, useRef, useMemo } from "react";
import { Helmet } from "react-helmet";
import "./Blog.scss";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import searchIcon from "../../../assets/homepageicons/search-icon.svg";
import messageIcon from "../../../assets/homepageicons/message-icon.svg";
import smsStarIcon from "../../../assets/homepageicons/sms-star.svg";
import blogImg1 from "../../../assets/homepageicons/blog-img-1.jpg";
import blogImg2 from "../../../assets/homepageicons/blog-img-2.jpg";
import blogImg3 from "../../../assets/homepageicons/blog-img-3.jpg";
import blogService from "../../../services/blogService";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUser } from "../../../redux/features/auth/authSlice";
import { getLoginStatus } from "../../../services/authService";
import editIcon from "../../../assets/home/edit-icon.svg";
import deleteIcon from "../../../assets/home/delete-icon.svg";
import { toast } from "sonner";

const Blog = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [posts, setPosts] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ show: false, postId: null, title: "" });
    const [newPost, setNewPost] = useState({
        title: "",
        subtitle: "",
        tags: "",
        body: "",
    });
    const [coverFile, setCoverFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(null);
    const [imageChanged, setImageChanged] = useState(false);
    const fileInputRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const postsPerPage = 6;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [totalPages, setTotalPages] = useState(1);
    const user = useSelector(selectUser);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Check if user is logged in
    useEffect(() => {
        let mounted = true;
        async function checkLogin() {
            const status = await getLoginStatus();
            if (mounted) setIsLoggedIn(status);
        }
        checkLogin();
        return () => (mounted = false);
    }, []);

    // Check if user is authorized to edit/delete
    const isAuthorized =
        isLoggedIn &&
        user &&
        user.businessEmail &&
        (user.businessEmail === "yemijoshua18@gmail.com" ||
            user.businessEmail === "yemijoshua18@gmail.com");

    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1); // Reset to first page on new search
    };

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const data = await blogService.getPosts(
                    currentPage,
                    postsPerPage,
                    searchQuery
                );
                if (mounted && data) {
                    setPosts(data.blogPosts || []);
                    setTotalPages(data.totalPages || 1);
                }
            } catch (err) {
                console.error("Failed to load posts", err);
            }
        }
        load();
        return () => (mounted = false);
    }, [currentPage, searchQuery]);

    // Handle edit query parameter
    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId && posts.length > 0 && isAuthorized) {
            const postToEdit = posts.find(p => p._id === editId);
            if (postToEdit) {
                setEditingPost(postToEdit);
                setNewPost({
                    title: postToEdit.title || "",
                    subtitle: postToEdit.subtitle || "",
                    tags: postToEdit.tags ? postToEdit.tags.join(", ") : "",
                    body: postToEdit.content || "",
                });
                setCoverPreview(postToEdit.coverImage || null);
                setCoverFile(null);
                setImageChanged(false);
                if (fileInputRef.current) fileInputRef.current.value = null;
                setShowAdd(true);
                // Clear the query parameter
                navigate('/blog', { replace: true });
            } else {
                // Post not found, try to fetch it
                async function fetchPost() {
                    try {
                        const data = await blogService.getPost(editId);
                        if (data) {
                            setEditingPost(data);
                            setNewPost({
                                title: data.title || "",
                                subtitle: data.subtitle || "",
                                tags: data.tags ? data.tags.join(", ") : "",
                                body: data.content || "",
                            });
                            setCoverPreview(data.coverImage || null);
                            setCoverFile(null);
                            setImageChanged(false);
                            if (fileInputRef.current) fileInputRef.current.value = null;
                            setShowAdd(true);
                            navigate('/blog', { replace: true });
                        }
                    } catch (err) {
                        console.error("Failed to load post for editing", err);
                    }
                }
                fetchPost();
            }
        }
    }, [searchParams, posts, isAuthorized, navigate]);

    const paginatedPosts = posts;

    const openAdd = () => {
        setEditingPost(null);
        setNewPost({ title: "", subtitle: "", tags: "", body: "" });
        setCoverFile(null);
        setCoverPreview(null);
        setImageChanged(false);
        if (fileInputRef.current) fileInputRef.current.value = null;
        setShowAdd(true);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCoverFile(file);
            setImageChanged(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();

        if (!newPost.title.trim()) {
            toast.error("Please enter a title for your post");
            return;
        }

        if (!newPost.body.trim()) {
            toast.error("Please enter content for your post");
            return;
        }

        try {
            const fd = new FormData();
            fd.append("title", newPost.title);
            fd.append("subtitle", newPost.subtitle);
            fd.append(
                "tags",
                JSON.stringify(newPost.tags.split(",").map((t) => t.trim()).filter(t => t))
            );
            fd.append("content", newPost.body); // markdown string
            fd.append("readTime", calculatReadTime(newPost.body));
            fd.append("published", "true");

            // Only append the image if it's a new post or if the image was changed during edit
            if (editingPost) {
                fd.append("imageChanged", imageChanged.toString());
                if (imageChanged && coverFile) {
                    fd.append("coverImage", coverFile);
                }
            } else {
                // For new posts, always include the image if provided
                if (coverFile) fd.append("coverImage", coverFile);
            }

            if (editingPost) {
                // Update existing post
                const result = await blogService.updatePost(editingPost._id, fd);
                console.log("Update result:", result);
                toast.success("Post updated successfully!");
            } else {
                // Create new post
                const result = await blogService.createPost(fd);
                console.log("Create result:", result);
                toast.success("Post created successfully!");
            }

            // Reload posts after creation/update
            const data = await blogService.getPosts(1, postsPerPage, searchQuery);
            setPosts(data.blogPosts || []);
            setCurrentPage(1);
            setShowAdd(false);
            setEditingPost(null);
            setNewPost({ title: "", subtitle: "", tags: "", body: "" });
            setCoverFile(null);
            setCoverPreview(null);
            setImageChanged(false);
            if (fileInputRef.current) fileInputRef.current.value = null;
        } catch (err) {
            console.error("Failed to save post", err);
            console.error("Error details:", err.response?.data);
            const errorMessage = err.response?.data?.message || err.message || "Failed to save post";
            toast.error(`Error: ${errorMessage}. Please make sure you are logged in and authorized.`);
        }
    };

    const calculatReadTime = (text) => {
        const time = Math.ceil(text.split(" ").length / 200); // assuming 200 wpm
        return time + " min read";
    };

    const handleDelete = (e, postId) => {
        e.stopPropagation(); // Prevent navigation to post detail
        const post = posts.find(p => p._id === postId);
        setDeleteModal({ show: true, postId, title: post?.title || "this post" });
    };

    const confirmDelete = async () => {
        try {
            const result = await blogService.deletePost(deleteModal.postId);
            console.log("Delete result:", result);
            toast.success("Post deleted successfully!");
            // Reload posts after deletion
            const data = await blogService.getPosts(
                currentPage,
                postsPerPage,
                searchQuery
            );
            setPosts(data.blogPosts || []);
            setTotalPages(data.totalPages || 1);
            setDeleteModal({ show: false, postId: null, title: "" });
        } catch (err) {
            console.error("Failed to delete post", err);
            console.error("Error details:", err.response?.data);
            const errorMessage = err.response?.data?.message || err.message || "Failed to delete post";
            toast.error(`Error: ${errorMessage}. Please try again.`);
            setDeleteModal({ show: false, postId: null, title: "" });
        }
    };

    const handleEdit = (e, postId) => {
        e.stopPropagation(); // Prevent navigation to post detail
        const postToEdit = posts.find(p => p._id === postId);
        if (postToEdit) {
            setEditingPost(postToEdit);
            setNewPost({
                title: postToEdit.title || "",
                subtitle: postToEdit.subtitle || "",
                tags: postToEdit.tags ? postToEdit.tags.join(", ") : "",
                body: postToEdit.content || "",
            });
            setCoverPreview(postToEdit.coverImage || null);
            setCoverFile(null);
            setImageChanged(false);
            if (fileInputRef.current) fileInputRef.current.value = null;
            setShowAdd(true);
        }
    };

    const [newsletterEmail, setNewsletterEmail] = useState("");

    const handleNewsletterSubmit = (e) => {
        e.preventDefault();
        if (newsletterEmail.trim()) {
            console.log("Newsletter signup:", newsletterEmail);
            // TODO: implement newsletter signup
            setNewsletterEmail("");
        }
    };

    return (
        <main className="blog-root">
            <Helmet>
                <title>Sell Square Blog - Inventory Management Tips & eCommerce Strategies</title>
                <meta
                    name="description"
                    content="Insights to help you sell and grow smarter. Explore expert articles on inventory management, eCommerce strategies, buyer behavior, sales optimization, and practical advice for scaling your product business."
                />
                <meta
                    name="keywords"
                    content="inventory management blog, ecommerce tips, business growth strategies, sales optimization, retail management advice, SME business tips, inventory best practices, online selling strategies, business insights"
                />
                <meta name="author" content="Sell Square" />
                <meta name="robots" content="index, follow" />
                <meta property="og:title" content="Sell Square Blog - Business Growth Insights" />
                <meta
                    property="og:description"
                    content="Expert articles on inventory management, eCommerce, and business growth strategies for SMEs and retailers."
                />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://www.sellsquarehub.com/blog" />
                <meta property="og:site_name" content="Sell Square" />
                <meta
                    property="og:image"
                    content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
                />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Sell Square Blog - Business Insights" />
                <meta
                    name="twitter:description"
                    content="Expert tips on inventory management, eCommerce, and growing your business."
                />
                <meta
                    name="twitter:image"
                    content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
                />
                <link rel="canonical" href="https://www.sellsquarehub.com/blog" />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Blog",
                        "name": "Sell Square Blog",
                        "description":
                            "Expert insights on inventory management, eCommerce strategies, and business growth for SMEs.",
                        "url": "https://www.sellsquarehub.com/blog",
                        "publisher": {
                            "@type": "Organization",
                            "name": "Sell Square",
                            "logo": {
                                "@type": "ImageObject",
                                "url": "https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
                            }
                        }
                    })}
                </script>
            </Helmet>
            <div className="blog-top-hero">
                {/* Site nav component */}
                <SiteNav />

                <header className="blog-hero">
                    <div className="blog-hero-inner">
                        <div className="blog-hero-content">
                            <h1 className="blog-hero-title">
                                Insights to Help You Sell and Grow Smarter
                            </h1>
                            <p className="blog-hero-subtitle">
                                Explore articles on inventory management, eCommerce strategies,
                                buyer behavior, and practical advice for scaling your product
                                business.
                            </p>

                            <form className="blog-search-form" onSubmit={handleSearch}>
                                <div className="search-input-wrap">
                                    <span className="search-input-icon">
                                        <img src={searchIcon} alt="Search" />
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search topics like inventory, selling online, customer loyalty…"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        className="search-btn"
                                        aria-label="Search"
                                    >
                                        Search
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </header>
            </div>

            <section className="blog-posts-section">
                <div className="blog-posts-inner">
                    <div className="posts-header">
                        <h2>Latest Articles</h2>
                        {isAuthorized && (
                            <div className="posts-actions">
                                <button className="btn add-post" onClick={openAdd}>
                                    Add Post
                                </button>
                            </div>
                        )}
                    </div>

                    {paginatedPosts.length === 0 ? (
                        <div className="blog-posts-placeholder">
                            <p>No posts found.</p>
                        </div>
                    ) : (
                        <>
                            <div className="posts-list">
                                {paginatedPosts.map((p) => (
                                    <article
                                        key={p._id || p.id}
                                        className="post-card"
                                        onClick={() => navigate(`/blog/${p._id || p.id}`)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <div className="post-card-image-wrapper">
                                            {p.coverImage && (
                                                <img
                                                    className="post-cover"
                                                    src={p.coverImage}
                                                    alt={p.title}
                                                />
                                            )}
                                            {isAuthorized && (
                                                <div className="post-card-actions">
                                                    <button
                                                        className="post-action-btn edit-btn"
                                                        onClick={(e) => handleEdit(e, p._id)}
                                                        title="Edit post"
                                                    >
                                                        <img src={editIcon} alt="Edit" />
                                                    </button>
                                                    <button
                                                        className="post-action-btn delete-btn"
                                                        onClick={(e) => handleDelete(e, p._id)}
                                                        title="Delete post"
                                                    >
                                                        <img src={deleteIcon} alt="Delete" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="post-body">
                                            <h3 className="post-title">{p.title}</h3>
                                            <p className="post-sub">{p.subtitle}</p>
                                        </div>
                                        <div className="read-time">
                                            <div className="dot"></div>
                                            <span className="read-time-text">
                                                {calculatReadTime(p.content)}
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                            <div className="pagination-bar">
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <button
                                        key={i + 1}
                                        className={`pagination-btn${currentPage === i + 1 ? " active" : ""
                                            }`}
                                        onClick={() => setCurrentPage(i + 1)}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {showAdd && (
                        <div className="add-post-modal">
                            <div className="add-post-panel">
                                <header className="panel-header">
                                    <h3>{editingPost ? "Edit Blog Post" : "Create Blog Post"}</h3>
                                    <button className="close" onClick={() => setShowAdd(false)}>
                                        ✕
                                    </button>
                                </header>
                                <form className="create-post-form" onSubmit={handleCreate}>
                                    <label>
                                        <span className="label-text">Cover image</span>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="file-input"
                                        />
                                        {coverPreview && (
                                            <div className="image-preview">
                                                <img src={coverPreview} alt="Cover preview" />
                                            </div>
                                        )}
                                    </label>

                                    <label>
                                        <span className="label-text">Title</span>
                                        <input
                                            type="text"
                                            value={newPost.title}
                                            onChange={(e) =>
                                                setNewPost({ ...newPost, title: e.target.value })
                                            }
                                            required
                                        />
                                    </label>

                                    <label>
                                        <span className="label-text">Subtitle</span>
                                        <input
                                            type="text"
                                            value={newPost.subtitle}
                                            onChange={(e) =>
                                                setNewPost({ ...newPost, subtitle: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label>
                                        <span className="label-text">Tags (comma separated)</span>
                                        <input
                                            type="text"
                                            value={newPost.tags}
                                            onChange={(e) =>
                                                setNewPost({ ...newPost, tags: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label>
                                        <span className="label-text">Body (Markdown)</span>
                                        <textarea
                                            rows={10}
                                            value={newPost.body}
                                            onChange={(e) =>
                                                setNewPost({ ...newPost, body: e.target.value })
                                            }
                                            placeholder="Write markdown here. Use ![alt](url) to include images in the markdown."
                                        />
                                    </label>

                                    <div className="panel-actions">
                                        <button
                                            type="button"
                                            className="btn ghost"
                                            onClick={() => setShowAdd(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button type="submit" className="btn primary publish-btn">
                                            {editingPost ? "Update" : "Publish"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section className="newsletter-section">
                <div className="newsletter-inner">
                    <div className="newsletter-content">
                        <h2 className="newsletter-title">
                            Want Tips Like These in Your Inbox?
                        </h2>
                        <p className="newsletter-subtitle">
                            Get actionable insights, product updates, and growth hacks every
                            week. Boost your knowledge with tips from Sell Square.
                        </p>
                        <form className="newsletter-form" onSubmit={handleNewsletterSubmit}>
                            <div className="newsletter-input-wrap">
                                <span className="newsletter-input-icon">
                                    <img src={messageIcon} alt="Email" />
                                </span>
                                <input
                                    type="email"
                                    className="newsletter-input"
                                    placeholder="Enter your email address"
                                    value={newsletterEmail}
                                    onChange={(e) => setNewsletterEmail(e.target.value)}
                                    required
                                />
                                <button
                                    type="submit"
                                    className="newsletter-btn"
                                    aria-label="Subscribe"
                                >
                                    Subscribe
                                </button>
                            </div>
                        </form>
                    </div>
                    <img src={smsStarIcon} alt="" className="newsletter-decoration" />
                </div>
            </section>

            {/* Site footer component */}
            <Footer />

            {/* Delete Confirmation Modal */}
            {deleteModal.show && (
                <div className="delete-modal-overlay" onClick={() => setDeleteModal({ show: false, postId: null, title: "" })}>
                    <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="delete-modal-icon">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="24" cy="24" r="24" fill="#FEE2E2" />
                                <path d="M24 16V26M24 32H24.02M40 24C40 32.8366 32.8366 40 24 40C15.1634 40 8 32.8366 8 24C8 15.1634 15.1634 8 24 8C32.8366 8 40 15.1634 40 24Z" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h3 className="delete-modal-title">Delete Blog Post?</h3>
                        <p className="delete-modal-text">
                            Are you sure you want to delete <strong>"{deleteModal.title}"</strong>? This action cannot be undone.
                        </p>
                        <div className="delete-modal-actions">
                            <button
                                className="btn delete-modal-cancel"
                                onClick={() => setDeleteModal({ show: false, postId: null, title: "" })}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn delete-modal-confirm"
                                onClick={confirmDelete}
                            >
                                Delete Post
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Blog;

/*
TODO: 
We need to add three things
1. Make the searchbar work to search the post
2. Add pagination to the post as < 1 2 3 > where they all have borders and the active has the brand color 
3. Each post needs to be clickable and when users click on it, design the page where they get to read the post in full, let it have the navbar, the title, subtitle, the image and the body of the post which should be a markdown


*/
