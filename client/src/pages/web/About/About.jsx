import React from "react";
import { Helmet } from "react-helmet";
import "./About.scss";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import aboutImg from "../../../assets/homepageicons/about-img.svg";
import tickCircle from "../../../assets/homepageicons/about-tick-circle.svg";
import aboutMainImg from "../../../assets/homepageicons/about-big-img.svg";
import joinImg from "../../../assets/homepageicons/joinImg.svg";

const About = () => {
    return (
        <main className="about-root">
            <Helmet>
                <title>About Sell Square - Empowering African Businesses with Smart Technology</title>
                <meta
                    name="description"
                    content="Sell Square is a product of GNLife Tech Network, empowering African SMEs with scalable inventory management and marketplace tools. Learn about our mission to help local entrepreneurs grow with intuitive, affordable technology."
                />
                <meta
                    name="keywords"
                    content="about sell square, GNLife Tech Network, African business software, SME empowerment, inventory management company, business technology Africa, entrepreneur tools, local business growth"
                />
                <meta name="author" content="Sell Square" />
                <meta name="robots" content="index, follow" />
                <meta property="og:title" content="About Sell Square - Empowering African Businesses" />
                <meta
                    property="og:description"
                    content="Learn about Sell Square and GNLife Tech Network's mission to empower African SMEs with affordable, intuitive business management technology."
                />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://www.sellsquarehub.com/about" />
                <meta property="og:site_name" content="Sell Square" />
                <meta
                    property="og:image"
                    content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
                />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="About Sell Square" />
                <meta
                    name="twitter:description"
                    content="Empowering African businesses with smart, affordable technology solutions."
                />
                <meta
                    name="twitter:image"
                    content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
                />
                <link rel="canonical" href="https://www.sellsquarehub.com/about" />
            </Helmet>
            <div className="about-top-hero">
                {/* Site nav component */}
                <SiteNav />

                <header className="about-hero">
                    <div className="about-hero-inner">
                        <div className="about-hero-content">
                            <h1 className="about-hero-title">About Us</h1>
                            <p className="about-hero-subtitle">
                                SellSquare is a product of GNLife Tech Network — a technology
                                company focused on empowering African businesses with scalable
                                digital tools that simplify commerce, operations, and growth.
                            </p>
                        </div>
                    </div>
                </header>
            </div>

            <section className="about-content-section">
                <div className="about-content-inner">
                    <h2 className="about-section-title">Who we are</h2>

                    <div className="who-we-are-content">
                        <div className="who-image">
                            <img src={aboutImg} alt="About GNLife Tech Network" />
                        </div>

                        <div className="who-text">
                            <p>
                                GNLife Tech Network is a software development company, we build software for small and large scale businesses and we also mentor in the services that we render. We believe technology should feel natural, affordable, and empowering—especially for small and medium enterprises.
                            </p>
                            <p>
                                Our mission is to help local entrepreneurs grow with confidence by equipping them with tools that are intuitive, efficient, and made for the African market.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="about-content-section what-is-section">
                <div className="about-content-inner">
                    <div className="what-is-content">
                        <div className="what-is-left">
                            <h3 className="what-is-title">What is Sell Square?</h3>
                            <p className="what-is-subtitle">
                                An all-in-one platform that combines a product marketplace with
                                inventory and business management tools
                            </p>
                        </div>

                        <div className="what-is-right">
                            <p className="what-is-description">
                                SellSquare is GNLife's flagship product—a powerful, all-in-one
                                platform that combines an online marketplace with advanced
                                inventory management features. It's designed for both:
                            </p>

                            <div className="what-is-list">
                                <div className="what-is-item">
                                    <img
                                        src={tickCircle}
                                        alt="Check"
                                        className="what-is-icon"
                                    />
                                    <p className="what-is-item-text">
                                        Sellers, who want to track inventory, manage orders, control
                                        staff access, and get paid reliably, and
                                    </p>
                                </div>

                                <div className="what-is-item">
                                    <img
                                        src={tickCircle}
                                        alt="Check"
                                        className="what-is-icon"
                                    />
                                    <p className="what-is-item-text">
                                        Buyers, who want to shop local, trusted businesses and track
                                        their orders with ease.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <img src={aboutMainImg} className="about-main-img" alt="about-sellsquare" />
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

export default About;
