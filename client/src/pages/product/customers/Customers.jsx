import { useEffect, useState, useRef } from "react";
import "./customers.css";
import ReactPaginate from "react-paginate";
import { Tooltip } from "antd";
import { Link } from "react-router-dom";
import { SpinnerImg } from "../../../components/loader/Loader";
import Search from "../../../components/search/Search";
import { RxCrossCircled } from "react-icons/rx";
import { Helmet } from "react-helmet";
import { useStateCustomersPagination } from "../../../customHook/useStatePagination";

// SVG Icon Components
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H4H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 4V2C6 1.46957 6.21071 0.960859 6.58579 0.585786C6.96086 0.210714 7.46957 0 8 0H10C10.5304 0 11.0391 0.210714 11.4142 0.585786C11.7893 0.960859 12 1.46957 12 2V4M14 4V14C14 14.5304 13.7893 15.0391 13.4142 15.4142C13.0391 15.7893 12.5304 16 12 16H6C5.46957 16 4.96086 15.7893 4.58579 15.4142C4.21071 15.0391 4 14.5304 4 14V4H14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Customers = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimeout = useRef();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Use state-driven pagination from bulk-loaded cache
  const {
    items: currentItems,
    totalPages,
    isLoading: isCustomersLoading,
    refresh: refreshCustomers,
  } = useStateCustomersPagination({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
    sortField: 'name',
    sortDirection: 'asc'
  });

  // pageCount comes directly from hook's totalPages
  const pageCount = totalPages || 1;

  // Debounce search and update debounced value and URL param only after debounce
  useEffect(() => {
    if (debounceTimeout?.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(debounceTimeout.current);
  }, [search]);

  const [showMessageModal, setShowMessageModal] = useState(false);
  const [receipients, setReceipients] = useState([]);
  const [checkedState, setCheckedState] = useState({});
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [showMessageTypeDialog, setShowMessageTypeDialog] = useState(false);
  const [messageType, setMessageType] = useState(""); // Email or SMS

  const shortenText = (text, n) => {
    if (text.length > n) {
      const shortenedText = text.substring(0, n).concat("...");
      return shortenedText;
    }
    return text;
  };

  const handleMessageTypeSelection = (type) => {
    setMessageType(type);
    setShowMessageTypeDialog(false);
    setShowMessageModal(true);
  };

  // State-driven page change - NO backend call
  const handlePageClick = (event) => {
    setCurrentPage(event.selected + 1);
  };

  useEffect(() => {
    const isEveryChecked = currentItems.every(
      (customer) => checkedState[customer.phone]
    );
    const isNoneChecked = currentItems.every(
      (customer) => !checkedState[customer.phone]
    );

    setIsAllSelected(isEveryChecked && !isNoneChecked);
  }, [currentItems, checkedState]);

  const handleChecked = (e, customer) => {
    const { checked } = e.target;

    setCheckedState((prev) => ({
      ...prev,
      [customer.phone]: checked,
    }));

    if (checked) {
      setReceipients((prevReceipients) => [...prevReceipients, customer]);
    } else {
      setReceipients((prevReceipients) =>
        prevReceipients.filter(
          (receipient) => receipient.phone !== customer.phone
        )
      );
    }

    const isEveryChecked = currentItems.every((cust) =>
      cust.phone === customer.phone ? checked : checkedState[cust.phone]
    );
    setIsAllSelected(isEveryChecked);
  };

  const handleSelectAll = (e) => {
    const { checked } = e.target;
    setIsAllSelected(checked);

    const updatedCheckedState = {};
    const updatedReceipients = [];

    if (checked) {
      currentItems.forEach((customer) => {
        updatedCheckedState[customer.phone] = true;
        updatedReceipients.push(customer);
      });
    } else {
      currentItems.forEach((customer) => {
        updatedCheckedState[customer.phone] = false;
      });
    }

    setCheckedState(updatedCheckedState);
    setReceipients(updatedReceipients);
  };

  console.log("receipients", receipients);

  const handleSendMessage = (e) => {
    e.preventDefault();
    console.log("sending message to", receipients);
  };

  return (
    <div className="product-list customers-list">
      <Helmet>
        <title>Customer Management | Sell Square - CRM & Purchase History</title>
        <meta
          name="description"
          content="Comprehensive customer relationship management. Maintain customer database, track purchase history, manage debtor payments, send receipts via email/WhatsApp, and communicate directly with customers."
        />
        <meta
          name="keywords"
          content="customer management, CRM software, customer database, purchase history, debtor tracking, customer communication, WhatsApp receipts, email receipts, customer records, business CRM"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Customer Management | Sell Square CRM" />
        <meta
          property="og:description"
          content="Manage customer relationships effectively. Track purchases, monitor outstanding payments, and communicate via email or WhatsApp."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/customers" />
        <meta property="og:site_name" content="Sell Square" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Customer Management | Sell Square" />
        <meta
          name="twitter:description"
          content="Track customers, purchase history, and outstanding payments all in one place."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/customers" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Customer Management | Sell Square",
            "description":
              "Comprehensive customer relationship management with purchase history, debtor tracking, and direct communication tools.",
            "url": "https://www.sellsquarehub.com/customers",
          })}
        </script>
      </Helmet>
      <div className="table">
        <header className="customers-header">
          <h1>Customers</h1>
          <button
            type="button"
            className="refresh_btn"
            onClick={refreshCustomers}
            disabled={isCustomersLoading}
          >
            {isCustomersLoading ? "Refreshing..." : "Refresh"}
          </button>
        </header>
        <button
          className="mobile_send_button"
          onClick={() => setShowMessageTypeDialog(true)}
        >
          <SendIcon />
        </button>
        <div className="--flex-between --flex-dir-column defaul-inventory-header">
          <span>
            <h3>
              <Link className="inventory-routes active-route" to="/inventory">
                All customers
              </Link>
            </h3>
          </span>
          <div className="contact-search">
            <button onClick={() => setShowMessageTypeDialog(true)}>
              <span className="mobile_send_text">Contact</span>
            </button>
            <span>
              <Search
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>
          {showMessageTypeDialog && (
            <div className="message-type-overlay">
              <div className="message-type-dialog">
                <RxCrossCircled
                  size={36}
                  className="cancel_message_dialogue"
                  onClick={() => setShowMessageTypeDialog(false)}
                />
                <h2>Select Message Type</h2>
                <div className="message-type-options">
                  <button onClick={() => handleMessageTypeSelection("Email")}>
                    Send Email
                  </button>
                  <button onClick={() => handleMessageTypeSelection("SMS")}>
                    Send SMS
                  </button>
                </div>
              </div>
            </div>
          )}
          {showMessageModal && (
            <div className="customers-message-container">
              <RxCrossCircled
                size={46}
                style={{ cursor: "pointer" }}
                className="cancel-modal"
                onClick={() => setShowMessageModal(false)}
              />
              <div className="message-body">
                <h1>{`Send ${messageType} to customers`}</h1>
                <form onSubmit={handleSendMessage}>
                  <div className="customers-message-form">
                    <div className="form-field">
                      <label htmlFor="">Recipient(s)</label>
                      <input
                        type="text"
                        name="recipients"
                        id="recipients"
                        value={
                          receipients.length > 3
                            ? `${receipients[0]?.name}, ${receipients[1]?.name
                            }, and ${receipients.length - 2} others`
                            : receipients
                              .map((recipient) => recipient.name)
                              .join(", ")
                        }
                        readOnly
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="">Subject</label>
                      <input
                        type="text"
                        name="subject"
                        id="subject"
                        placeholder={`Enter ${messageType.toLowerCase()} subject`}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="">Message</label>
                      <textarea
                        name="message"
                        id="message"
                        cols="15"
                        rows="5"
                        placeholder={`Write your ${messageType.toLowerCase()} message`}
                      ></textarea>
                    </div>
                  </div>
                  <div className="submit-btn">
                    <button type="submit">Send {messageType}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {isCustomersLoading && <SpinnerImg />}

        <div className="table">
          {isCustomersLoading ? (
            <p>-- All customers</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>s/n</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {currentItems.map((customer, index) => {
                    return (
                      <tr key={index}>
                        <td>
                          <input
                            onChange={(e) => handleChecked(e, customer)}
                            type="checkbox"
                            value={JSON.stringify({
                              name: customer.name,
                              email: customer.email,
                              phone: customer.phone,
                            })}
                            checked={checkedState[customer.phone] || false}
                            name=""
                            id=""
                          />
                        </td>
                        <td>{index + 1}</td>
                        <td>
                          <Tooltip title={customer.name}>
                            {shortenText(customer.name, 16)}
                          </Tooltip>
                        </td>
                        <td>{customer.email}</td>
                        <td>{customer.phone}</td>
                        <td className="icons">
                          <span>
                            <DeleteIcon />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <ReactPaginate
          breakLabel="..."
          nextLabel=">"
          onPageChange={handlePageClick}
          pageRangeDisplayed={3}
          pageCount={pageCount}
          previousLabel="<"
          renderOnZeroPageCount={null}
          containerClassName={`pagination ${isCustomersLoading ? 'pagination-disabled' : ''}`}
          pageLinkClassName="page-num"
          previousLinkClassName="page-num"
          nextLinkClassName="page-num"
          activeLinkClassName="activePageClass"
          forcePage={currentPage - 1}
        />
      </div>
    </div>
  );
};

export default Customers;