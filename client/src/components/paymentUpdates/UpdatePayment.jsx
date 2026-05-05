import { Link } from "react-router-dom";

const ExpiredSubscription = ({ isBusinessOwner = true }) => {
  if (!isBusinessOwner) {
    // Sales rep sees different message
    return (
      <div className="expired_subscription_page">
        <div className="expired_content">
          <div className="expired_icon">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" fill="#fee2e2" />
              <path d="M12 7V13M12 16H12.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="expired_title">Access Restricted</h1>
          <p className="expired_description">
            This action is currently unavailable.<br />
            Please contact your business administrator for assistance.
          </p>
          <div className="expired_features">
            <div className="feature_item">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="var(--brand-color)" />
              </svg>
              <span>Contact your business administrator</span>
            </div>
            <div className="feature_item">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="var(--brand-color)" />
              </svg>
              <span>Action temporarily unavailable</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Business owner sees payment update option
  return (
    <div className="expired_subscription_page">
      <div className="expired_content">
        <div className="expired_icon">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" fill="#fee2e2" />
            <path d="M12 7V13M12 16H12.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="expired_title">Subscription Expired</h1>
        <p className="expired_description">
          Your subscription has expired. To continue using all features,<br />
          please update your payment information.
        </p>
        <Link to="/accounts/subscription" className="update_payment_btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 10H11M11 10C11 11.1046 11.8954 12 13 12H15C16.1046 12 17 11.1046 17 10C17 8.89543 16.1046 8 15 8H13C11.8954 8 11 8.89543 11 10ZM3 6H21M3 14H6M3 18H9M17 14H21M17 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Update Payment Now
        </Link>
        <div className="expired_features">
          <div className="feature_item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="var(--brand-color)" strokeWidth="2" fill="none" />
              <path d="M8 12L11 15L16 9" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Secure Payment Processing</span>
          </div>
          <div className="feature_item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="var(--brand-color)" strokeWidth="2" fill="none" />
              <path d="M8 12L11 15L16 9" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Instant Reactivation</span>
          </div>
          <div className="feature_item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="var(--brand-color)" strokeWidth="2" fill="none" />
              <path d="M8 12L11 15L16 9" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>No Data Loss</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GracePeriod = () => {
  return (
    <div className="grace_period_banner">
      <div className="banner_icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z" fill="#f59e0b" />
        </svg>
      </div>
      <div className="banner_content">
        <strong>Grace Period Active:</strong> Your subscription is in grace period.
        <Link to="/accounts/subscription" className="banner_link">Update payment</Link> to avoid service interruption.
      </div>
    </div>
  );
};

export const ExpiredBanner = ({ isBusinessOwner = false }) => {
  if (isBusinessOwner) {
    // Business owner sees subscription expired message with payment link
    return (
      <div className="expired_banner">
        <div className="banner_icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z" fill="#ef4444" />
          </svg>
        </div>
        <div className="banner_content">
          <strong>Subscription Expired:</strong> Your subscription has expired.
          <Link to="/accounts/subscription" className="banner_link">Update payment</Link> to restore full access.
        </div>
      </div>
    );
  }

  // Sales rep sees generic message
  return (
    <div className="expired_banner">
      <div className="banner_icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z" fill="#ef4444" />
        </svg>
      </div>
      <div className="banner_content">
        <strong>Service Notice:</strong> Some actions are currently restricted. Please contact your business administrator for more information.
      </div>
    </div>
  );
};

export default ExpiredSubscription;
