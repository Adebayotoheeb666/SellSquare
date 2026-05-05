import React, { useState } from "react";
import { Helmet } from "react-helmet";
import SiteNav from "../../../components/header/SiteNav";
import Footer from "../../../components/footer/Footer";
import ApplicationModal from "../../../components/ApplicationModal/ApplicationModal";
import "./MarketingInterns.scss";

const MarketingInterns = () => {
    const [showApplicationModal, setShowApplicationModal] = useState(false);
    return (
        <main className="mi-page">
            <Helmet>
                <title>SellSquare Marketing Interns</title>
                <meta
                    name="description"
                    content="Join SellSquare as a marketing intern. Own campaigns, learn fast, and ship real work with a growth-first team."
                />
                <meta property="og:title" content="SellSquare Marketing Interns" />
                <meta
                    property="og:description"
                    content="Grow with SellSquare—real campaigns, real mentorship, flexible paid internship."
                />
                <meta property="og:image" content="/marketing-interns/social-card.svg" />
                <meta property="og:type" content="website" />
            </Helmet>

            <div className="mi-hero">
                <div className="marketing-top-nav">
                    <SiteNav />
                </div>

                <div className="mi-hero__content mi-container">
                    <div className="mi-hero__text">
                        <div className="mi-kicker">Careers · Internships</div>
                        <h1>Join SellSquare as a Marketing Intern</h1>
                        <p className="mi-subtitle">
                            Ship real campaigns, learn fast with growth mentors, and build a portfolio that gets noticed.
                        </p>
                        <div className="mi-cta-row">
                            <button
                                className="mi-btn mi-btn--primary"
                                onClick={() => setShowApplicationModal(true)}
                            >
                                Apply now
                            </button>
                            {/* <a className="mi-btn mi-btn--ghost" href="/marketing-interns/social-card.svg" download>
                                Download social card
                            </a>
                            <a className="mi-btn mi-btn--ghost" href="/marketing-interns/index.html" download>
                                Download poster (HTML)
                            </a> */}
                        </div>
                        <div className="mi-meta">Hybrid · Paid · Growth-focused · January 2026</div>
                    </div>

                    <div className="mi-hero__visual">
                        <div className="mi-hero__badge">January 2026</div>
                        <svg className="mi-hero__illustration" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Marketing workspace illustration */}
                            {/* Desk */}
                            <rect x="50" y="280" width="400" height="20" fill="#295F2D" opacity="0.1" rx="4" />

                            {/* Laptop */}
                            <rect x="120" y="180" width="160" height="100" fill="#fff" stroke="#295F2D" strokeWidth="2" rx="4" />
                            <rect x="125" y="185" width="150" height="80" fill="#295F2D" opacity="0.05" />
                            {/* Screen content - chart */}
                            <polyline points="135,240 150,220 170,230 190,210 210,225 230,200 250,215" stroke="#295F2D" strokeWidth="2" fill="none" />
                            <circle cx="150" cy="220" r="3" fill="#295F2D" />
                            <circle cx="210" cy="225" r="3" fill="#295F2D" />
                            <circle cx="250" cy="215" r="3" fill="#295F2D" />

                            {/* Coffee cup */}
                            <ellipse cx="340" cy="255" rx="18" ry="5" fill="#295F2D" opacity="0.2" />
                            <path d="M 325 240 L 325 255 Q 325 260 330 260 L 350 260 Q 355 260 355 255 L 355 240 Z" fill="#fff" stroke="#295F2D" strokeWidth="2" />
                            <path d="M 355 245 Q 365 245 365 250 Q 365 255 355 255" fill="none" stroke="#295F2D" strokeWidth="2" />
                            <line x1="330" y1="245" x2="350" y2="245" stroke="#295F2D" opacity="0.3" strokeWidth="1" />

                            {/* Notebook */}
                            <rect x="300" y="200" width="80" height="60" fill="#fff" stroke="#295F2D" strokeWidth="2" rx="2" />
                            <line x1="310" y1="215" x2="360" y2="215" stroke="#295F2D" opacity="0.3" strokeWidth="1.5" />
                            <line x1="310" y1="225" x2="370" y2="225" stroke="#295F2D" opacity="0.3" strokeWidth="1.5" />
                            <line x1="310" y1="235" x2="350" y2="235" stroke="#295F2D" opacity="0.3" strokeWidth="1.5" />

                            {/* Floating icons - Social media */}
                            <circle cx="100" cy="120" r="25" fill="#295F2D" opacity="0.1" />
                            <path d="M 95 115 L 95 125 L 105 120 Z" fill="#295F2D" />

                            {/* Floating icons - Email */}
                            <circle cx="380" cy="100" r="25" fill="#295F2D" opacity="0.1" />
                            <rect x="365" y="95" width="30" height="20" fill="none" stroke="#295F2D" strokeWidth="2" rx="2" />
                            <path d="M 365 95 L 380 107 L 395 95" fill="none" stroke="#295F2D" strokeWidth="2" />

                            {/* Floating icons - Analytics */}
                            <circle cx="420" cy="180" r="25" fill="#295F2D" opacity="0.1" />
                            <rect x="410" y="175" width="6" height="15" fill="#295F2D" rx="1" />
                            <rect x="418" y="170" width="6" height="20" fill="#295F2D" rx="1" />
                            <rect x="426" y="178" width="6" height="12" fill="#295F2D" rx="1" />

                            {/* Decorative elements */}
                            <circle cx="80" cy="80" r="4" fill="#295F2D" opacity="0.2" />
                            <circle cx="440" cy="260" r="4" fill="#295F2D" opacity="0.2" />
                            <circle cx="200" cy="60" r="3" fill="#295F2D" opacity="0.15" />
                        </svg>
                    </div>
                </div>
            </div>

            <section className="mi-section mi-container">
                <div className="mi-section__header">
                    <div className="mi-kicker">Open positions</div>
                    <h2>Choose your track</h2>
                    <p className="mi-muted">
                        We're hiring for three specialized marketing roles. Pick the one that matches your interests and strengths.
                    </p>
                </div>
                <div className="mi-roles-grid">
                    <div className="mi-role-card">
                        <div className="mi-role-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="5" y="2" width="14" height="20" rx="2" stroke="#295F2D" strokeWidth="2" />
                                <path d="M9 6h6M9 10h6M9 14h4" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <h3>Social Media Manager</h3>
                        <p>Create viral campaigns across Instagram, TikTok, and LinkedIn</p>
                        <ul className="mi-role-highlights">
                            <li>Content strategy & planning</li>
                            <li>Community engagement</li>
                            <li>Analytics & reporting</li>
                        </ul>
                    </div>
                    <div className="mi-role-card">
                        <div className="mi-role-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="5" width="18" height="14" rx="2" stroke="#295F2D" strokeWidth="2" />
                                <path d="M3 7l9 6 9-6" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h3>Email Marketing Specialist</h3>
                        <p>Design and optimize email campaigns that convert</p>
                        <ul className="mi-role-highlights">
                            <li>Email copywriting</li>
                            <li>A/B testing & segmentation</li>
                            <li>Campaign automation</li>
                        </ul>
                    </div>
                    <div className="mi-role-card">
                        <div className="mi-role-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 3v16a2 2 0 002 2h16" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" />
                                <path d="M7 16l4-8 4 4 4-6" stroke="#295F2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="7" cy="16" r="1.5" fill="#295F2D" />
                                <circle cx="11" cy="8" r="1.5" fill="#295F2D" />
                                <circle cx="15" cy="12" r="1.5" fill="#295F2D" />
                                <circle cx="19" cy="6" r="1.5" fill="#295F2D" />
                            </svg>
                        </div>
                        <h3>Growth Marketing Lead</h3>
                        <p>Drive user acquisition and retention through data-driven experiments</p>
                        <ul className="mi-role-highlights">
                            <li>Growth experiments</li>
                            <li>Data analysis & insights</li>
                            <li>Cross-channel strategy</li>
                        </ul>
                    </div>
                </div>

                <div className="mi-section__header" style={{ marginTop: '64px' }}>
                    <div className="mi-kicker">What you get</div>
                    <h2>Do real work with a team that ships</h2>
                    <p className="mi-muted">
                        Work on live campaigns across social, email, and in-product messaging. Learn the craft with hands-on reviews and weekly mentorship.
                    </p>
                </div>
                <div className="mi-grid">
                    <article className="mi-card">
                        <h3>Own campaigns end-to-end</h3>
                        <p>Create briefs, draft copy, build assets, and measure performance with real dashboards.</p>
                    </article>
                    <article className="mi-card">
                        <h3>Mentorship that cares</h3>
                        <p>Weekly 1:1s with growth leads, async feedback, and clear goals so you always know what to do next.</p>
                    </article>
                    <article className="mi-card">
                        <h3>Flexible and paid</h3>
                        <p>Hybrid schedule, 3–6 months, stipend plus learning budget. We respect your time and growth.</p>
                    </article>
                    <article className="mi-card">
                        <h3>Ship with a product team</h3>
                        <p>Partner with design, product, and sales to learn how campaigns move metrics for a real product.</p>
                    </article>
                </div>
            </section>

            <section className="mi-section mi-container mi-section--alt">
                <div className="mi-section__header">
                    <div className="mi-kicker">How to apply</div>
                    <h2>Ready to join?</h2>
                    <p className="mi-muted">Three quick steps to get started.</p>
                </div>
                <div className="mi-steps">
                    <div className="mi-step">
                        <div className="mi-step__index">01</div>
                        <div>
                            <h3>Send your application</h3>
                            <p>Tell us about a campaign you admire, and share a link to any past work (it can be school projects).</p>
                        </div>
                    </div>
                    <div className="mi-step">
                        <div className="mi-step__index">02</div>
                        <div>
                            <h3>Complete a short brief</h3>
                            <p>We’ll send a bite-sized prompt so you can show your thinking. No long spec work.</p>
                        </div>
                    </div>
                    <div className="mi-step">
                        <div className="mi-step__index">03</div>
                        <div>
                            <h3>Meet the team</h3>
                            <p>Chat with our growth lead and a designer to see if it’s a fit on both sides.</p>
                        </div>
                    </div>
                </div>
                <div className="mi-apply-cta">
                    <button
                        className="mi-btn mi-btn--primary mi-btn--large"
                        onClick={() => setShowApplicationModal(true)}
                    >
                        Apply Now for January 2026
                    </button>
                    <p className="mi-apply-note">Application takes ~5 minutes. We review applications on a rolling basis.</p>
                </div>            </section>

            <ApplicationModal
                isOpen={showApplicationModal}
                onClose={() => setShowApplicationModal(false)}
            />

            <Footer />
        </main>
    );
};

export default MarketingInterns;
