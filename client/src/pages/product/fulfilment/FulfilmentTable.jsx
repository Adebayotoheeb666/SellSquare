import { useParams } from "react-router-dom";
import moment from "moment";
import { useState } from "react";
import { Tooltip } from "antd";
import useFormatter from "../../../customHook/useFormatter";

// SVG Icons
const ArrowDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 10L8 6L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2V5M16 2V5M3 9H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MoneyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="var(--brand-color)" strokeWidth="2" />
    <path d="M12 6V18M9 9H12.5C13.3284 9 14 9.67157 14 10.5C14 11.3284 13.3284 12 12.5 12H9.5C8.67157 12 8 12.6716 8 13.5C8 14.3284 8.67157 15 9.5 15H15" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function FulFilmentTable({
  items,
  handleAmountChange,
  handleUpdatePayment,
  amountPaid,
  updatingPayment,
  paymentMethod,
  handleMethodChange,
  methodError,
}) {
  const [expandedCard, setExpandedCard] = useState({});
  const [showPaymentTooltip, setShowPaymentTooltip] = useState({});

  const handleToggleCard = (id) => {
    setExpandedCard((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleUpdateClick = (e, id) => {
    e.stopPropagation();

    // Validate amount first
    if (!amountPaid[id] || amountPaid[id] <= 0) {
      return;
    }

    // Show payment method tooltip
    setShowPaymentTooltip((prev) => ({
      ...prev,
      [id]: true,
    }));
  };

  const handlePaymentMethodSelect = (id, method) => {
    // Update the payment method
    handleMethodChange(id, method);

    // Close the tooltip
    setShowPaymentTooltip((prev) => ({
      ...prev,
      [id]: false,
    }));

    // Execute the update payment function
    setTimeout(() => {
      handleUpdatePayment(id, method);
    }, 100);
  };

  const handleCloseTooltip = (id) => {
    setShowPaymentTooltip((prev) => ({
      ...prev,
      [id]: false,
    }));
  };

  const { formatter } = useFormatter();

  // Calculate totals
  const totals = items?.reduce(
    (acc, item) => {
      const amountPaid = item.payment?.paymentDetails?.amountPaid || 0;
      const balance = item.payment?.paymentDetails?.balance || 0;
      const totalDebt = amountPaid + balance;

      return {
        totalDebt: acc.totalDebt + totalDebt,
        totalPaid: acc.totalPaid + amountPaid,
        totalBalance: acc.totalBalance + balance,
      };
    },
    { totalDebt: 0, totalPaid: 0, totalBalance: 0 }
  ) || { totalDebt: 0, totalPaid: 0, totalBalance: 0 };

  const shortenText = (text, n) => {
    if (text.length > n) {
      return text.substring(0, n).concat("...");
    }
    return text;
  };

  return (
    <>
      {/* Summary Header */}
      {items && items.length > 0 && (
        <div className="fulfilment_summary_header">
          <div className="summary_card">
            <div className="summary_card_icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2V22M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="summary_card_content">
              <div className="summary_card_label">Total Debt</div>
              <div className="summary_card_value">{formatter(totals.totalDebt)}</div>
            </div>
          </div>

          <div className="summary_card">
            <div className="summary_card_icon" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="summary_card_content">
              <div className="summary_card_label">Total Paid</div>
              <div className="summary_card_value">{formatter(totals.totalPaid)}</div>
            </div>
          </div>

          <div className="summary_card">
            <div className="summary_card_icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 16V8C20.9996 7.64927 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64927 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 12C13.6569 12 15 10.6569 15 9C15 7.34315 13.6569 6 12 6C10.3431 6 9 7.34315 9 9C9 10.6569 10.3431 12 12 12Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 12L6 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 12L18 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="summary_card_content">
              <div className="summary_card_label">Remaining Balance</div>
              <div className="summary_card_value">{formatter(totals.totalBalance)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Cards Container */}
      <div className="fulfilment_cards_container">
        {items?.map((item, index) => {
          const { customer, payment, createdAt, _id, paymentStatus } = item;
          const formattedDate = moment(createdAt).format("MMM DD, YYYY h:mmA");
          const isExpanded = expandedCard[_id];

          return (
            <div key={_id} className={`fulfilment_card ${isExpanded ? 'expanded' : ''}`}>
              {/* Card Header with Summary Info */}
              <div className="card_header" onClick={() => handleToggleCard(_id)}>
                {/* First Row: Customer Info, Status Badge, and Expand Icon */}
                <div className="card_header_row card_header_row_top">
                  <div className="customer_info">
                    <UserIcon />
                    <div className="customer_details">
                      <h3 className="customer_name">
                        <Tooltip title={customer.name}>
                          {shortenText(customer.name, 25)}
                        </Tooltip>
                      </h3>
                      <p className="customer_phone">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="card_header_right">
                    <div className="status_badge" data-status={payment?.paymentStatus}>
                      {payment?.paymentStatus}
                    </div>
                    <button className="expand_btn" aria-label={isExpanded ? "Collapse" : "Expand"}>
                      {isExpanded ? <ArrowUpIcon /> : <ArrowDownIcon />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Second Section: Date, Paid, Balance - Below Header */}
              <div className="card_summary_section">
                <div className="header_summary_info">
                  <div className="header_summary_item">
                    <CalendarIcon />
                    <span className="header_summary_text">{formattedDate}</span>
                  </div>
                  <div className="header_summary_item">
                    <MoneyIcon />
                    <span className="header_summary_text">Paid: {formatter(payment?.paymentDetails?.amountPaid)}</span>
                  </div>
                  <div className="header_summary_item">
                    <MoneyIcon />
                    <span className="header_summary_text balance">Balance: {formatter(payment?.paymentDetails?.balance)}</span>
                  </div>
                </div>
              </div>

              {/* Update Payment Section - Always Visible for Pending */}
              {payment?.paymentStatus !== "completed" && (
                <div className="card_payment_update">
                  <div className="payment_update_controls">
                    <input
                      type="number"
                      className="payment_input"
                      value={amountPaid[_id] || ""}
                      onChange={(e) => handleAmountChange(_id, e.target.value)}
                      placeholder="Enter amount to pay"
                      onClick={(e) => e.stopPropagation()}
                      disabled={updatingPayment === _id}
                    />
                    <div className="update_btn_wrapper">
                      <button
                        className="update_btn"
                        onClick={(e) => handleUpdateClick(e, _id)}
                        disabled={updatingPayment === _id || !amountPaid[_id] || amountPaid[_id] <= 0}
                      >
                        {updatingPayment === _id ? (
                          <>
                            <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                              <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                            </svg>
                            Updating...
                          </>
                        ) : (
                          "Update Payment"
                        )}
                      </button>

                      {/* Payment Method Tooltip */}
                      {showPaymentTooltip[_id] && (
                        <>
                          <div className="payment_tooltip_overlay" onClick={() => handleCloseTooltip(_id)} />
                          <div className="payment_tooltip">
                            <div className="payment_tooltip_header">
                              <span>Select Payment Method</span>
                              <button className="tooltip_close_btn" onClick={() => handleCloseTooltip(_id)}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>
                            <div className="payment_tooltip_options">
                              <button
                                className="payment_option_btn"
                                onClick={() => handlePaymentMethodSelect(_id, 'cash')}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 2V22M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Cash</span>
                              </button>
                              <button
                                className="payment_option_btn"
                                onClick={() => handlePaymentMethodSelect(_id, 'transfer')}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                                  <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                <span>Transfer</span>
                              </button>
                              <button
                                className="payment_option_btn"
                                onClick={() => handlePaymentMethodSelect(_id, 'pos')}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                                  <path d="M9 9H15M9 12H15M9 15H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                <span>POS</span>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {isExpanded && (
                <div className="card_details">
                  {/* Products Section */}
                  <div className="details_section">
                    <h4 className="section_title">Products</h4>
                    <div className="products_list">
                      {item.items.map((product, idx) => (
                        <div key={idx} className="product_item">
                          <div className="product_name_qty">
                            <span className="product_name">{product.name}</span>
                            <span className="product_qty">×{product.quantity}</span>
                          </div>
                          <span className="product_price">{formatter(product.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment History Section */}
                  <div className="details_section">
                    <h4 className="section_title">Payment History</h4>
                    <div className="payment_history">
                      {payment.paymentDetails.paymentParts.map((part, idx) => {
                        const methodLabel = (part.method || payment?.paymentType || "unspecified").toLowerCase();
                        return (
                          <div key={idx} className="payment_history_item">
                            <div className="payment_amount_wrapper">
                              <div className="payment_amount">{formatter(part.amountPaid)}</div>
                              <span className="payment_method_badge">{methodLabel}</span>
                            </div>
                            <div className="payment_date">
                              {moment(part.datePaid).format("MMM DD, YYYY h:mmA")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
