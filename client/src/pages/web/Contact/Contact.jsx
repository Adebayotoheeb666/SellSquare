import React, { useState } from "react";
import { Helmet } from "react-helmet";
import "./Contact.scss";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import emailIcon from "../../../assets/homepageicons/sms-icon.svg";
import phoneIcon from "../../../assets/homepageicons/call-icon.svg";
import facebookIcon from "../../../assets/homepageicons/facebook.svg";
import xIcon from "../../../assets/homepageicons/x.svg";
import instagramIcon from "../../../assets/homepageicons/instagram.svg";
import locationIcon from "../../../assets/homepageicons/location.svg";
import joinImg from "../../../assets/homepageicons/joinImg.svg";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = "";

const Contact = () => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        subject: "",
        message: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            toast.error("Please fill in all fields");
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error("Please enter a valid email address");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post(`${BACKEND_URL}/api/contactus`, formData);

            if (response.data.success) {
                toast.success(response.data.message || "Message sent successfully! We'll get back to you soon.");
                // Reset form
                setFormData({
                    name: "",
                    email: "",
                    subject: "",
                    message: ""
                });
            }
        } catch (error) {
            console.error("Contact form error:", error);
            const errorMessage = error.response?.data?.message || "Failed to send message. Please try again.";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="contact-root">
            <Helmet>
                <title>Contact Sell Square - Get Support & Help for Your Business</title>
                <meta
                    name="description"
                    content="Have questions or need help? Contact Sell Square's support team. We're here to help you with inventory management, marketplace inquiries, technical support, and making your business experience better."
                />
                <meta
                    name="keywords"
                    content="contact sell square, customer support, business help, technical support, inventory management help, get in touch, customer service, support team, business inquiries"
                />
                <meta name="author" content="Sell Square" />
                <meta name="robots" content="index, follow" />
                <meta property="og:title" content="Contact Sell Square - Customer Support" />
                <meta
                    property="og:description"
                    content="Get in touch with Sell Square's support team. We're here to help you succeed with your business."
                />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://www.sellsquarehub.com/contact-us" />
                <meta property="og:site_name" content="Sell Square" />
                <meta
                    property="og:image"
                    content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
                />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content="Contact Sell Square" />
                <meta
                    name="twitter:description"
                    content="Get support and help for your business. We're here for you."
                />
                <link rel="canonical" href="https://www.sellsquarehub.com/contact" />
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "ContactPage",
                        "name": "Contact Sell Square",
                        "description":
                            "Contact Sell Square for support, inquiries, and help with your business needs.",
                        "url": "https://www.sellsquarehub.com/contact"
                    })}
                </script>
            </Helmet>
            <div className="contact-top-hero">
                {/* Site nav component */}
                <SiteNav />

                <header className="contact-hero">
                    <div className="contact-hero-inner">
                        <div className="contact-hero-content">
                            <h1 className="contact-hero-title">Contact Us</h1>
                            <p className="contact-hero-subtitle">
                                Have questions or need help? We're here to support you.
                                Reach out and let's make your experience with SellSquare even better.
                            </p>
                        </div>
                    </div>
                </header>
            </div>

            <section className="contact-content-section">
                <div className="contact-content-inner">
                    {/* Contact Form */}
                    <div className="contact-form-container">
                        <h2 className="form-header">Get In Touch With Us</h2>
                        <form className="contact-form" onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Your Name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="form-group">
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Your Email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <input
                                    type="text"
                                    name="subject"
                                    placeholder="Subject"
                                    value={formData.subject}
                                    onChange={handleChange}
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <textarea
                                    name="message"
                                    placeholder="Message"
                                    rows="5"
                                    value={formData.message}
                                    onChange={handleChange}
                                    required
                                    disabled={isSubmitting}
                                ></textarea>
                            </div>
                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Sending..." : "Submit"}
                            </button>
                        </form>
                    </div>

                    {/* Contact Details */}
                    <div className="contact-details-container">
                        <h2 className="details-header">Contact Details</h2>

                        <div className="social-icons">
                            <a href="#" className="social-icon">
                                <img src={facebookIcon} alt="Facebook" />
                            </a>
                            <a href="#" className="social-icon">
                                <img src={xIcon} alt="X (Twitter)" />
                            </a>
                            <a href="#" className="social-icon">
                                <img src={instagramIcon} alt="Instagram" />
                            </a>
                            {/* <a href="#" className="social-icon">
                                <img src={whatsappIcon} alt="WhatsApp" />
                            </a>
                            <a href="#" className="social-icon">
                                <img src={tiktokIcon} alt="TikTok" />
                            </a> */}
                        </div>

                        <div className="contact-info-grid">
                            <div className="contact-info-item">
                                <div className="info-icon">
                                    <img src={locationIcon} alt="Address" />
                                </div>
                                <div className="info-text">
                                    <div className="info-label">Address</div>
                                    <div className="info-value">123 Business Street, Lagos, Nigeria</div>
                                </div>
                            </div>

                            <div className="contact-info-item">
                                <div className="info-icon">
                                    <img src={emailIcon} alt="Email" />
                                </div>
                                <div className="info-text">
                                    <div className="info-label">Email</div>
                                    <div className="info-value">support@sellsquare.com</div>
                                </div>
                            </div>

                            <div className="contact-info-item">
                                <div className="info-icon">
                                    <img src={phoneIcon} alt="Mobile" />
                                </div>
                                <div className="info-text">
                                    <div className="info-label">Mobile</div>
                                    <div className="info-value">+234 800 123 4567</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            <section className="join-sellers-section-about">
                <div className="join-sellers-inner">
                    <div className="join-sellers-box-about">
                        <div className="join-media">
                            <img src={joinImg} alt="sellers growing" />
                        </div>
                        <div className="join-content">
                            <h3 className="join-title-about">
                                Join The Train of Sellers Who Are Growing Their Businesses with <span className="join-brand">SellSquare</span>
                            </h3>
                            <div className="join-ctas">
                                <a className="btn create-store" href="/register">Create My Free Store</a>
                                <a className="btn explore-market-about" href="/marketplace">Explore the Marketplace</a>
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

export default Contact;
