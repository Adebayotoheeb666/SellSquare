import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "../../../redux/features/auth/authSlice";
import { getLoginStatus } from "../../../services/authService";
import { Helmet } from "react-helmet";
import "./Homepage.scss";
import "./Homepage.scss";
import { NavLink, Link } from "react-router-dom";
import logo from "../../../assets/logo2.png";
import heroImg from "../../../assets/hero-img.png";
import whyusImg from "../../../assets/why-sellsquare-img.svg";
import whyIcon1 from "../../../assets/homepageicons/why-icon-1.svg";
import whyIcon2 from "../../../assets/homepageicons/why-icon-2.svg";
import whyIcon3 from "../../../assets/homepageicons/why-icon-3.svg";
import whyIcon4 from "../../../assets/homepageicons/why-icon-4.svg";
import toolIcon1 from "../../../assets/homepageicons/tools-img-1.svg";
import toolIcon2 from "../../../assets/homepageicons/tools-img-2.svg";
import toolIcon3 from "../../../assets/homepageicons/tools-img-3.svg";
import toolIcon4 from "../../../assets/homepageicons/tools-img-4.svg";
import tickCircle from "../../../assets/homepageicons/tick-circle.svg";
import tickCircleActive from "../../../assets/homepageicons/tick-circle-active.svg";
import joinImg from "../../../assets/homepageicons/joinImg.svg";
import arrowLeft from "../../../assets/homepageicons/arrow-left.svg";
import arrowRight from "../../../assets/homepageicons/arrow-right.svg";
import avatar1 from "../../../assets/homepageicons/osaks.jpg";
import avatar2 from "../../../assets/homepageicons/simple.jpg";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
// import avatar3 from "../../../assets/homepageicons/avatar-3.png";
// import avatar4 from "../../../assets/homepageicons/avatar-4.png";

const Homepage = () => {
  const currentUser = useSelector(selectUser);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // const isLoggedIn = await getLoginStatus();

  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [selectedPlan, setSelectedPlan] = useState("standard");

  const plans = [
    {
      id: "basic",
      name: "Basic Plan",
      priceMonthly: 5000,
      priceYearly: 50000,
      features: [
        "Unlimited Products",
        "Record Installmental Payments",
        "Print Receipts",
        "Message to Customers",
        "1 Salesperson",
        "Group Products",
      ],
    },
    {
      id: "standard",
      name: "Standard Plan",
      priceMonthly: 10000,
      priceYearly: 100000,
      features: [
        "Unlimited Products",
        "Record Installmental Payments",
        "Print Receipts",
        "Message to Customers",
        "Multiple Stores",
        "2 Salespersons",
        "Group Products",
        "Activity Logs",
        "Monthly Business Reports",
      ],
    },
    {
      id: "premium",
      name: "Professional Plan",
      priceMonthly: 15000,
      priceYearly: 150000,
      features: [
        "Unlimited Products",
        "Record Installmental Payments",
        "Print Receipts",
        "Message to Customers",
        "Multiple Stores",
        "Up to 5 Salespersons",
        "Group Products",
        "Activity Logs",
        "Monthly Business Reports",
        // "Everything in Standard",
        "Tracking Unique Products IDs, e.g Serial Numbers, IMEI Numbers etc.",
        "Priority customer support",
        "Custom reporting",
      ],
    },
  ];

  const testimonials = [
    {
      id: "t1",
      text: "The app has been very helpful in book keeping since all the items in my shop are well captured. I could know which products are completely sold out. It also helps in reminding me the cost price at any given time.",
      name: "Mrs. Bimpe Osakuade",
      avatar: avatar1,
    },
    {
      id: "t2",
      text: "This website has been so helpful in record keeping and account balancing. I have been using it for more than 2 months with no error. It's a website that is worth using. Well done guys!!!",
      name: "Seun Omolaye",
      avatar: avatar2,
    },
    {
      id: "t3",
      text: "The app has been very helpful in book keeping since all the items in my shop are well captured. I could know which products are completely sold out. It also helps in reminding me the cost price at any given time.",
      name: "Mrs. Bimpe Osakuade",
      avatar: avatar1,
    },
    {
      id: "t4",
      text: "This website has been so helpful in record keeping and account balancing. I have been using it for more than 2 months with no error. It's a website that is worth using. Well done guys!!!",
      name: "Seun Omolaye",
      avatar: avatar2,
    },
    // {
    //   id: "t3",
    //   text: "We saw immediate improvements in order accuracy. The dashboard gives us the insights we needed.",
    //   name: "Binta Musa",
    //   avatar: toolIcon3,
    // },
    // {
    //   id: "t4",
    //   text: "Powerful features without the complexity. Perfect for our growing store.",
    //   name: "Kofi Mensah",
    //   avatar: toolIcon4,
    // },
  ];

  const carouselRef = useRef(null);

  const [faqOpen, setFaqOpen] = useState({});

  const faqCategories = [
    {
      id: "general",
      title: "General",
      subtitle: "Basics about getting started as a buyer or seller",
      items: [
        {
          id: "g0",
          q: "Who can use Sell Square?",
          a: "Businesses of all sizes including retail stores, wholesalers, gadget stores, agrochemical stores, and basically all stores that use bookkeeping for their inventory can use Sell Square to manage inventory, sales, and customer data. Businesses that have product variations and unique products (e.g. gadget stores needing IMEI/serial tracking) can also use Sell Square. You can add sales reps, grant permissions, and monitor activity remotely.",
        },
        {
          id: "g1",
          q: "Is this software suitable for small businesses?",
          a: "Yes — our software is scalable and can be customized to meet the needs of small businesses as well as larger enterprises.",
        },
        {
          id: "g2",
          q: "Can I use this software for multiple locations?",
          a: "Yes — Sell Square supports multi-location inventory management, allowing you to track inventory across warehouses and store locations.",
        },
        {
          id: "g3",
          q: "How can I start using sell square?",
          a: "Create an account by visiting the signup page and filling in your details. After creating an account you can start using the software. We also provide tutorial videos on our YouTube channel to help you get started.",
        },
        {
          id: "g4",
          q: "Can I use sell square on my phone?",
          a: "Yes — Sell Square is web-based and accessible on any device with an internet connection (phone, tablet, or computer).",
        },
      ],
    },
    {
      id: "security",
      title: "Security",
      subtitle: "How we keep payments and accounts safe",
      items: [
        {
          id: "s0",
          q: "How secure is my data with your software?",
          a: "We prioritize data security and use industry-standard encryption to protect your information. Regular backups are also performed to ensure data integrity.",
        },
        {
          id: "s1",
          q: "Can I control who has access to my inventory data?",
          a: "Yes — you can set permissions and roles to control access to different parts of the software for salespeople and managers.",
        },
        {
          id: "s2",
          q: "What happens to my data if I cancel my subscription?",
          a: "You can export your data before canceling. After cancellation, data will be securely stored for a limited period before being permanently deleted.",
        },
      ],
    },
    {
      id: "fees",
      title: "Fees",
      subtitle: "Simple fee explanations for sellers and buyers",
      items: [
        {
          id: "f0",
          q: "What is the cost of the software?",
          a: "Pricing varies depending on features and number of users. Contact our sales team for a customized quote.",
        },
        {
          id: "f1",
          q: "Is there a free trial available?",
          a: "Yes — we offer a 7-day free trial so you can explore the features before committing.",
        },
        {
          id: "f2",
          q: "What kind of support do you offer?",
          a: "We offer comprehensive support including video tutorials, email support, and live chat.",
        },
        {
          id: "f3",
          q: "Are software updates included in the subscription?",
          a: "Yes — all software updates are included in your subscription at no additional cost.",
        },
      ],
    },
  ];

  const toggleFaq = (id) => {
    setFaqOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrev = () => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector(".testimonial-card");
    const gap = 24;
    const cardW =
      card && card.clientWidth
        ? card.clientWidth + gap
        : Math.floor(el.clientWidth * 0.8);
    el.scrollBy({ left: -cardW, behavior: "smooth" });
  };

  const handleNext = () => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector(".testimonial-card");
    const gap = 24;
    const cardW =
      card && card.clientWidth
        ? card.clientWidth + gap
        : Math.floor(el.clientWidth * 0.8);
    el.scrollBy({ left: cardW, behavior: "smooth" });
  };

  useEffect(() => {
    const redirectLoggedOutUser = async () => {
      const loggedInStatus = await getLoginStatus();

      setIsLoggedIn(loggedInStatus);
    };
    redirectLoggedOutUser();
  }, []);

  return (
    <main className="homepage-root">
      <Helmet>
        <title>Sell Square - Cloud Inventory Management & Local Marketplace Platform</title>
        <meta
          name="description"
          content="The smartest way to buy and sell locally online. Sell Square combines a local marketplace with comprehensive inventory management, POS system, sales tracking, and team collaboration tools for SMEs, retailers, and wholesalers."
        />
        <meta
          name="keywords"
          content="inventory management software, local marketplace, cloud POS system, business management platform, SME software, retail management, warehouse management, sales tracking, online marketplace Nigeria, business inventory software, stock management, free inventory system"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Sell Square - Inventory Management & Local Marketplace" />
        <meta
          property="og:description"
          content="All-in-one platform for local buying, selling, and business management. Track inventory across warehouses, manage sales with POS, analyze performance, and grow your business."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com" />
        <meta property="og:site_name" content="Sell Square" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Sell Square - Inventory Management & Marketplace" />
        <meta
          name="twitter:description"
          content="Buy local, sell smart. Complete inventory management with marketplace integration."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Sell Square",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "description":
              "Cloud-based inventory management and local marketplace platform for SMEs. Real-time stock tracking, POS system, sales analytics, and team collaboration.",
            "url": "https://www.sellsquarehub.com",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "NGN",
              "availability": "https://schema.org/InStock"
            },
            "featureList": [
              "Real-time Inventory Tracking",
              "Multi-warehouse Management",
              "Point of Sale System",
              "Sales Analytics",
              "Customer Management",
              "Team Collaboration",
              "Local Marketplace"
            ]
          })}
        </script>
      </Helmet>
      <div className="top-hero">
        <SiteNav />

        <header className="hero">
          <div className="hero-inner">
            <div className="hero-content">
              <h1 className="hero-title">
                The Smartest Way to Buy and Sell Locally Online
              </h1>
              <p className="hero-subtitle">
                SellSquare isn't just a local marketplace. It's also an
                all-in-one inventory platform for business owners to manage
                stock, track orders, monitor staff, and grow smarter.
              </p>
              <div className="hero-ctas">
                <a className="btn primary" href="/register">
                  Start Selling Now
                </a>
                <a className="btn ghost" href="/marketplace">
                  Explore the Marketplace
                </a>
              </div>
            </div>

            {/* Hero image: place your image at public/images/hero-img.png or update the src */}
            <div className="hero-media">
              <img
                className="herp-img"
                src={heroImg}
                alt="Marketplace preview"
              />
            </div>
          </div>
        </header>
      </div>

      <section id="features" className="features-section">
        <div className="features-inner">
          <div className="features-layout">
            <div className="left-panel">
              <h2 className="big-heading">Why Sellsquare Exists</h2>
              <p className="normal-paragraph">
                Because Buying and Selling Online Should Be Simple, Secure, and
                Built for Everyone
              </p>
              <div className="left-image">
                <img src={whyusImg} alt="Inventory preview" />
              </div>
            </div>

            <div className="right-panel">
              <div className="feature-grid">
                <article className="feature-item">
                  <div className="feature-icon">
                    <img src={whyIcon1} alt="online-store" />
                  </div>
                  <h3 className="feature-title">Instant Online Store</h3>
                  <p className="feature-desc">
                    Get a free online store instantly—no design or coding
                    needed. Share your store link and start selling today.
                  </p>
                </article>
                <article className="feature-item">
                  <div className="feature-icon">
                    <img src={whyIcon2} alt="inventory-management" />
                  </div>
                  <h3 className="feature-title">Inventory Management</h3>
                  <p className="feature-desc">
                    Monitor stock levels, get low quantity alerts, and sync
                    products to your marketplace store automatically.
                  </p>
                </article>
                <article className="feature-item">
                  <div className="feature-icon">
                    <img src={whyIcon3} alt="inventory-all-in-one" />
                  </div>
                  <h3 className="feature-title">All-in-One Platform</h3>
                  <p className="feature-desc">
                    From inventory to orders, payments to tracking, SellSquare
                    brings every part of your retail business into one
                    dashboard.
                  </p>
                </article>
                <article className="feature-item">
                  <div className="feature-icon">
                    <img src={whyIcon4} alt="sales-activity tracking" />
                  </div>
                  <h3 className="feature-title">Sales Activity Tracking</h3>
                  <p className="feature-desc">
                    Track revenue, customers, top-selling products, and see
                    everything your sales reps do—including permission-based
                    actions.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="business-section">
        <div className="business-columns">
          <div className="business-side sellers">
            <div className="side-inner">
              <div className="side-fixed">
                <div className="side-small">For Business</div>
                <h3 className="side-big">
                  Sell & Manage Your Products in One Place
                </h3>
                <p className="side-paragraph">
                  List your inventory, monitor sales, and control every order
                  from restocking to delivery.
                </p>
                <button className="start_selling"><Link to="/register">Start Selling</Link></button>
              </div>
            </div>
          </div>

          <div className="business-side buyers">
            <div className="side-inner">
              <div className="side-fixed">
                <div className="side-small">For Buyers</div>
                <h3 className="side-big">Discover Products Near You</h3>
                <p className="side-paragraph">
                  Shop trusted sellers, track your orders, and get fast delivery
                  with buyer protection.
                </p>
                <button className="explore_marketplace">
                  <Link to="/marketplace">Explore Marketplace</Link>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tools-section">
        <div className="tools-inner">
          <div className="tools-inner-header">
            <h2 className="tools-title">Everything you need, built in</h2>
            <p className="tools-sub">
              From inventory tracking to buyer wallets, Sell Square gives you
              the tools to thrive.
            </p>
          </div>

          <div className="tools-grid">
            <div className="tools-row row-1">
              <div className="tool-card">
                <div className="card-content">
                  <h4 className="card-header">Marketplace Access</h4>
                  <h3 className="card-title">
                    List your products, attract real buyers, and increase sales.
                  </h3>
                </div>
                <img className="card-image" src={toolIcon1} alt="catalog" />
              </div>

              <div className="tool-card">
                <div className="card-content">
                  <h4 className="card-header">Inventory Dashboard</h4>
                  <h3 className="card-title">
                    Monitor product levels, track low stock alerts, and sync
                    inventory directly to your marketplace store in real time.
                  </h3>
                </div>
                <img className="card-image" src={toolIcon2} alt="insights" />
              </div>
            </div>

            <div className="tools-row row-2">
              <div className="tool-card">
                <div className="card-content">
                  <h4 className="card-header">
                    Secure Payments, Instant Payouts
                  </h4>
                  <h3 className="card-title">
                    Receive funds automatically after confirmed delivery.
                    Withdraw to your bank anytime and view all wallet
                    transactions in one place.
                  </h3>
                </div>
                <img className="card-image" src={toolIcon3} alt="orders" />
              </div>

              <div className="tool-card last-card">
                <div className="card-content">
                  <h4 className="card-header">Order Management</h4>
                  <h3 className="card-title">
                    Accept, reject, ship, and mark orders as delivered—all from
                    one clean dashboard with real-time updates.
                  </h3>
                </div>
                <img className="card-image" src={toolIcon4} alt="security" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="pricing-section">
        <div className="pricing-inner">
          <div className="pricing-inner-header">
            <h2 className="pricing-title">
              Flexible Pricing Plans That Grow With Your Business
            </h2>
            <p className="pricing-sub">
              SellSquare offers flexible, affordable plans for sellers at every
              stage. You get powerful tools to list products, manage orders, and
              get paid
            </p>
          </div>

          <div className="billing-tabs">
            <div className="tabs-wrapper">
              <button
                className={`tab-btn ${billingPeriod === "monthly" ? "active" : ""
                  }`}
                onClick={() => setBillingPeriod("monthly")}
              >
                Monthly Billing
              </button>
              <button
                className={`tab-btn ${billingPeriod === "yearly" ? "active" : ""
                  }`}
                onClick={() => setBillingPeriod("yearly")}
              >
                Annual Billing
              </button>
            </div>
          </div>

          <div className="trial-note">
            All plans include a 14-day fully featured free trial.
          </div>

          <div className="pricing-cards">
            {plans.map((plan) => {
              const selected = selectedPlan === plan.id;
              const price =
                billingPeriod === "monthly"
                  ? plan.priceMonthly
                  : plan.priceYearly;
              const periodLabel =
                billingPeriod === "monthly" ? "/month" : "/year";
              return (
                <div
                  key={plan.id}
                  className={`plan-card ${selected ? "selected" : ""}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <div className="plan-inner">
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-price">
                      <span className="plan-amount">₦{price} </span>
                      <span className="plan-period">{periodLabel}</span>
                    </div>
                    <button className="btn get-started">Get started</button>

                    <div className="features-label">FEATURES</div>
                    <ul className="plan-features">
                      {plan.features.map((f, i) => (
                        <li key={i} className="feature-row">
                          <span>
                            <img
                              src={selected ? tickCircleActive : tickCircle}
                              alt="sellsquare feature"
                            />
                          </span>
                          <span className="feature-text">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="testimonials" className="testimonials-section">
        <div className="testimonials-inner">
          <div className="testimonials-header">
            <div className="testimonials-title-wrap">
              <h3 className="testimonials-title">
                What Our <span className="brand-color">Clients</span> Say
              </h3>
              <p className="testimonials-sub">
                Real people are growing their businesses and shopping
                confidently with SellSquare.{" "}
              </p>
            </div>

            <div className="test-nav-wrapper">
              <div className="testimonials-nav">
                <button
                  aria-label="Previous testimonials"
                  className="test-nav-btn"
                  onClick={handlePrev}
                >
                  <img src={arrowLeft} alt="" />
                </button>
                <button
                  aria-label="Next testimonials"
                  className="test-nav-btn next"
                  onClick={handleNext}
                >
                  <img src={arrowRight} alt="" />
                </button>
              </div>
            </div>
          </div>

          <div className="testimonials-track-wrap">
            <div className="testimonials-track" ref={carouselRef}>
              {testimonials.map((t) => (
                <article key={t.id} className="testimonial-card">
                  <p className="testimonial-text">{t.text}</p>
                  <div className="testimonial-meta">
                    <img
                      className="testimonial-avatar"
                      src={t.avatar}
                      alt={t.name}
                    />
                    <div className="testimonial-name">{t.name}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="faq-section">
        <div className="faq-inner">
          <div className="faq-header">
            <h2 className="faq-title">
              Frequently Asked Questions About Selling & Buying on SellSquare
            </h2>
            <p className="faq-sub">
              Got questions? We’ve answered the most common things new buyers
              and sellers ask so you can start with clarity and confidence.
            </p>
          </div>

          <div className="faq-groups">
            {faqCategories.map((cat) => (
              <div key={cat.id} className="faq-row">
                <div className="faq-category-col">
                  <h4 className="cat-title">{cat.title}</h4>
                  <p className="cat-sub">{cat.subtitle}</p>
                </div>

                <div className="faq-items">
                  {cat.items.map((item) => {
                    const open = !!faqOpen[item.id];
                    return (
                      <div
                        key={item.id}
                        className={`faq-item ${open ? "open" : ""}`}
                      >
                        <button
                          className="faq-question"
                          onClick={() => toggleFaq(item.id)}
                          aria-expanded={open}
                          aria-controls={`faq-body-${item.id}`}
                        >
                          <span className="q-text">{item.q}</span>
                          <span className="q-toggle">{open ? "−" : "+"}</span>
                        </button>
                        <div
                          id={`faq-body-${item.id}`}
                          className="faq-body"
                          style={{ maxHeight: open ? "500px" : "0px" }}
                        >
                          <p>{item.a}</p>
                        </div>
                        <div className="faq-divider" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
                Join The Train of Sellers Who Are Growing Their Businesses with{" "}
                <span className="join-brand">SellSquare</span>
              </h3>
              <div className="join-ctas">
                <a className="btn create-store" href="/register">
                  Create My Free Store
                </a>
                <a className="btn explore-market" href="/marketplace">
                  Explore the Marketplace
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Homepage;
