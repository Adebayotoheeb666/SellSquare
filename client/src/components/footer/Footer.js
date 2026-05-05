import React from "react";
import { Link } from "react-router-dom";
import logo from "../../assets/logo2.png";
import "./Footer.scss";

const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-left">
          <div className="footer-brand">
            <img src={logo} alt="SellSquare logo" className="footer-logo" />
            <div className="footer-brand-name">SellSquare</div>
          </div>
          <p className="footer-tag">
            The marketplace built for modern businesses and everyday buyers
          </p>
        </div>

        <div className="footer-right">
          <div className="footer-col">
            <h4 className="footer-col-title">Quick links</h4>
            <ul className="footer-links">
              <li>
                <Link to="/">Home</Link>
              </li>
              <li>
                <Link to="/about-us">About Us</Link>
              </li>
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#pricing">Pricing</a>
              </li>
              <li>
                <Link to="/contact-us">Contact Us</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Company</h4>
            <ul className="footer-links">
              <li>
                <Link to="/marketplace">Marketplace</Link>
              </li>
              <li>
                <Link to="/marketing-interns/">Marketing Intern</Link>
              </li>
              <li>
                <Link to="/our-policy">Policy</Link>
              </li>
              <li>
                <Link to="/terms-and-agreement">Terms</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        © {new Date().getFullYear()} SellSquare. All rights reserved
      </div>
    </footer>
  );
};

export default Footer;
