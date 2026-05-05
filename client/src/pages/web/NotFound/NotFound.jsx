import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.scss';

const NotFound = () => {
    return (
        <div className="notfound-page">
            <div className="notfound-inner">
                <h1>404</h1>
                <h2>SellSquare cannot find the page you are looking for</h2>
                <p>
                    We couldn't find the page you're looking for. It may have been moved,
                    removed, or the URL is incorrect.
                </p>
                <div className="notfound-cta">
                    <Link to="/" className="btn btn-primary">
                        Go to Home
                    </Link>
                    <Link to="/contact-us" className="btn btn-secondary">
                        Contact Support
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
