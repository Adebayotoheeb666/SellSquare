import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import blogService from "../../../services/blogService";
import DOMPurify from "dompurify";
import { marked } from "marked";
import "./Blog.scss";
import blogImg1 from "../../../assets/homepageicons/blog-img-1.jpg";
import messageIcon from "../../../assets/homepageicons/message-icon.svg";
import smsStarIcon from "../../../assets/homepageicons/sms-star.svg";
import { useSelector } from "react-redux";
import { selectUser } from "../../../redux/features/auth/authSlice";
import { getLoginStatus } from "../../../services/authService";
import editIcon from "../../../assets/home/edit-icon.svg";
import deleteIcon from "../../../assets/home/delete-icon.svg";
import { toast } from "sonner";

const BlogPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const user = useSelector(selectUser);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ show: false, postId: null, title: "" });

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
    (user.businessEmail === "yemijoshua80@gmail.com" ||
      user.businessEmail === "yemijoshua18@gmail.com");

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    // Handle newsletter subscription logic here
    console.log("Subscribed with email:", newsletterEmail);
  };

  const handleDelete = () => {
    setDeleteModal({ show: true, postId: id, title: post?.title || "this post" });
  };

  const confirmDelete = async () => {
    try {
      const result = await blogService.deletePost(deleteModal.postId);
      console.log("Delete result:", result);
      toast.success("Post deleted successfully!");
      setDeleteModal({ show: false, postId: null, title: "" });
      navigate("/blog");
    } catch (err) {
      console.error("Failed to delete post", err);
      console.error("Error details:", err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || "Failed to delete post";
      toast.error(`Error: ${errorMessage}. Please try again.`);
      setDeleteModal({ show: false, postId: null, title: "" });
    }
  };

  const handleEdit = () => {
    // Navigate to blog page with edit mode
    navigate(`/blog?edit=${id}`);
  };

  const examplePost = {
    title: "How to Get Started with SellSquare Blogging",
    subtitle: "A quick guide to writing and publishing your first post",
    coverImage: blogImg1,
    content: `# Welcome to the SellSquare Blog\n\nThis is a sample article shown when a post can't be found. Use it as a reference for formatting and layout.\n\n## What you can do\n- Add a cover image for visual appeal\n- Write a compelling title and subtitle\n- Use Markdown for rich content (headings, lists, images, links)\n\n### Example image\n![Sample Chart](https://images.unsplash.com/photo-1517148815978-75f6acaaf32c?q=80&w=600)\n\n### Example code\n\n\`\`\`js\nfunction hello() {\n  console.log('Hello from the sample post!')\n}\nhello();\n\`\`\`\n\n### Tips\n> Keep paragraphs short and scannable.\n\nUse \n\n- Bold for emphasis\n- Links like [SellSquare](https://www.sellsquarehub.com)\n- Images via Markdown syntax\n\nHappy writing!`,
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await blogService.getPost(id);
        setPost(data || null);
      } catch (err) {
        console.error("Failed to load post", err);
        setPost(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading)
    return (
      <div className="blog-root">
        <div className="blog-post-detail-wrapper">
          <SiteNav />
          <div className="blog-post-loading">Loading...</div>
        </div>
      </div>
    );

  return (
    <main className="blog-root">
      <div className="blog-post-detail-wrapper">
        <SiteNav />
        <div className="blog-post-detail">
          {/* <button className="back-btn" onClick={() => navigate(-1)}>
          &lt; Back
        </button> */}
          <h1 className="blog-post-title">{(post || examplePost).title}</h1>
          {(post || examplePost).subtitle && (
            <h2 className="blog-post-subtitle">
              {(post || examplePost).subtitle}
            </h2>
          )}
          {(post || examplePost).coverImage && (
            <div className="blog-post-cover-wrapper">
              <img
                className="blog-post-cover"
                src={(post || examplePost).coverImage}
                alt={(post || examplePost).title}
              />
              {isAuthorized && post && (
                <div className="blog-post-actions">
                  <button
                    className="post-action-btn edit-btn"
                    onClick={handleEdit}
                    title="Edit post"
                  >
                    <img src={editIcon} alt="Edit" />
                  </button>
                  <button
                    className="post-action-btn delete-btn"
                    onClick={handleDelete}
                    title="Delete post"
                  >
                    <img src={deleteIcon} alt="Delete" />
                  </button>
                </div>
              )}
            </div>
          )}
          <div
            className="blog-post-body"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                marked.parse((post || examplePost).content || "")
              ),
            }}
          />
        </div>
      </div>

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

export default BlogPost;
