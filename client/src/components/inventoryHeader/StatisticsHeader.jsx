import React, { useEffect, useRef, useState, useMemo } from "react";
import dateIcon from "../../assets/home/dateIcon.svg";
import arrowDown from "../../assets/home/arrowdown.svg";
import DatePicker from "../datePicker/DatePicker";
import { useSelector } from "react-redux";
import "./stats.css";
import leftArrow from "../../assets/home/narrowleft.svg";
import rightArrow from "../../assets/home/narrowright.svg";
import useFormatter from "../../customHook/useFormatter";

// Import SVG icons for statistics
const DateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const SalesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor" />
    <path d="M12 6C11.45 6 11 6.45 11 7V13C11 13.55 11.45 14 12 14C12.55 14 13 13.55 13 13V7C13 6.45 12.55 6 12 6Z" fill="currentColor" />
    <path d="M16 11C15.45 11 15 11.45 15 12V13C15 13.55 15.45 14 16 14C16.55 14 17 13.55 17 13V12C17 11.45 16.55 11 16 11Z" fill="currentColor" />
    <path d="M8 13C7.45 13 7 13.45 7 14V15C7 15.55 7.45 16 8 16C8.55 16 9 15.55 9 15V14C9 13.45 8.55 13 8 13Z" fill="currentColor" />
  </svg>
);

const ProfitIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z" fill="currentColor" />
    <path d="M12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12C17 9.24 14.76 7 12 7ZM12 15C10.34 15 9 13.66 9 12C9 10.34 10.34 9 12 9C13.66 9 15 10.34 15 12C15 13.66 13.66 15 12 15Z" fill="currentColor" />
  </svg>
);

const CashIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 18V4C21 2.9 20.1 2 19 2H5C3.9 2 3 2.9 3 4V18C3 19.1 3.9 20 5 20H19C20.1 20 21 19.1 21 18ZM19 8H5V4H19V8Z" fill="currentColor" />
    <path d="M12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14Z" fill="currentColor" />
  </svg>
);

const TransferIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor" />
  </svg>
);

const POSIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 8H4C2.9 8 2.01 8.9 2.01 10L2 22C2 23.1 2.9 24 4 24H20C21.1 24 22 23.1 22 22V10C22 8.9 21.1 8 20 8ZM20 22H4V10H20V22Z" fill="currentColor" />
    <path d="M12 17C10.34 17 9 15.66 9 14C9 12.34 10.34 11 12 11C13.66 11 15 12.34 15 14C15 15.66 13.66 17 12 17Z" fill="currentColor" />
    <path d="M4 6H20V4H4V6Z" fill="currentColor" />
  </svg>
);

const StatisticsHeader = ({
  currentUser,
  checkouts,
  admin,
  search,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onDateFilterModeChange
}) => {
  // Calculate statistics from the checkouts array passed from parent
  // This ensures stats are always in sync with displayed data and filters
  const stats = useMemo(() => {
    console.log("[StatisticsHeader] Calculating stats from checkouts:", {
      checkoutsLength: checkouts?.length || 0,
      checkoutsSample: checkouts?.[0],
      startDate,
      endDate,
    });

    if (!checkouts || checkouts.length === 0) {
      console.log("[StatisticsHeader] No checkouts, returning 0 stats");
      return {
        totalSales: 0,
        totalProfit: 0,
        totalCash: 0,
        totalTransfer: 0,
        totalPOS: 0,
        totalPending: 0,
        totalPendingProfit: 0,
      };
    }

    return checkouts.reduce(
      (acc, checkout) => {
        // Use the correct field names from the actual data structure
        const grandTotal = checkout.totalOrderCost || checkout.grandTotal || 0;

        // Calculate profit from items (price - cost) * quantity
        const profit = checkout.items?.reduce((sum, item) => {
          const itemPrice = parseFloat(item.price) || 0;
          const itemCost = parseFloat(item.cost) || 0;
          const itemQty = parseInt(item.quantity) || 0;
          return sum + ((itemPrice - itemCost) * itemQty);
        }, 0) || 0;

        const paymentMethod = checkout.payment?.paymentType || "";
        const paymentStatus = checkout.payment?.paymentStatus || "";
        const amountPaid = checkout.payment?.paymentDetails?.amountPaid || 0;
        const cashAmount = checkout.payment?.paymentAmounts?.cash || 0;
        const transferAmount = checkout.payment?.paymentAmounts?.transfer || 0;
        const posAmount = checkout.payment?.paymentAmounts?.pos || 0;

        // Calculate payment method totals
        const cash = cashAmount > 0 ? cashAmount : (paymentMethod === "cash" ? grandTotal : 0);
        const transfer = transferAmount > 0 ? transferAmount : (paymentMethod === "transfer" ? grandTotal : 0);
        const pos = posAmount > 0 ? posAmount : (paymentMethod === "pos" ? grandTotal : 0);

        // Calculate pending amounts
        const paidRatio = grandTotal > 0 ? amountPaid / grandTotal : 1;
        const pendingAmount = paymentStatus === "Part Payment" ? grandTotal - amountPaid : 0;
        const pendingProfit = paymentStatus === "Part Payment" ? profit * (1 - paidRatio) : 0;

        return {
          totalSales: acc.totalSales + grandTotal,
          totalProfit: acc.totalProfit + profit,
          totalCash: acc.totalCash + cash,
          totalTransfer: acc.totalTransfer + transfer,
          totalPOS: acc.totalPOS + pos,
          totalPending: acc.totalPending + pendingAmount,
          totalPendingProfit: acc.totalPendingProfit + pendingProfit,
        };
      },
      {
        totalSales: 0,
        totalProfit: 0,
        totalCash: 0,
        totalTransfer: 0,
        totalPOS: 0,
        totalPending: 0,
        totalPendingProfit: 0,
      },
    );
  }, [checkouts]);

  // Use calculated stats from checkouts prop
  const totalSales = stats?.totalSales || 0;
  const totalProfit = stats?.totalProfit || 0;
  const totalCash = stats?.totalCash || 0;
  const totalTransfer = stats?.totalTransfer || 0;
  const totalOnPOS = stats?.totalPOS || 0;
  const totalPendingValue = stats?.totalPending || 0;
  const totalPendingProfit = stats?.totalPendingProfit || 0;
  const [displayQuery, setDisplayQuery] = useState(false);
  // Use parent state if provided, otherwise use local state
  const [start, setStart] = useState(startDate || "");
  const [end, setEnd] = useState(endDate || "");
  const dateInputRef = useRef(null);
  const statisticsRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState("thisMonth");
  const queryContainerRef = useRef(null);

  const { formatter } = useFormatter();

  // Helper functions to update both local and parent state
  const updateStart = (isoDate) => {
    setStart(isoDate);
    if (onStartDateChange) onStartDateChange(isoDate);
  };

  const updateEnd = (isoDate) => {
    setEnd(isoDate);
    if (onEndDateChange) onEndDateChange(isoDate);
  };

  const setDateFilterMode = (isExplicit) => {
    if (onDateFilterModeChange) onDateFilterModeChange(isExplicit);
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;

    const selectedDate = new Date(value);

    if (name === "start") {
      selectedDate.setHours(0, 0, 0, 0);
      updateStart(selectedDate.toISOString());
      setDateFilterMode(true);
    }

    if (name === "end") {
      selectedDate.setHours(23, 59, 59, 999);
      updateEnd(selectedDate.toISOString());
      setDateFilterMode(true);
    }
  };

  // Initialize with current month dates if not already set by parent
  useEffect(() => {
    if (!startDate || !endDate) {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(today);
      monthEnd.setHours(23, 59, 59, 999);
      updateStart(monthStart.toISOString());
      updateEnd(monthEnd.toISOString());
      setSelectedDate("thisMonth");
      setDateFilterMode(false);
    }
  }, []);

  const handleFetchSales = (start, end) => {
    // Update parent state and close modal - parent will handle filtering
    updateStart(start);
    updateEnd(end);
    setDateFilterMode(true);
    setDisplayQuery(!displayQuery);
  };

  const handleSetQueryToTodayAndFetchSales = () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Start of today

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999); // End of today

    updateStart(todayStart.toISOString());
    updateEnd(todayEnd.toISOString());
    setSelectedDate("today");
    setDateFilterMode(true);
    setDisplayQuery(!displayQuery);
  };

  const handleSetQueryToYesterdayAndFetchSales = () => {
    const today = new Date();

    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(today.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0); // Start of yesterday

    const yesterdayEnd = new Date(today);
    yesterdayEnd.setDate(today.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999); // End of yesterday

    updateStart(yesterdayStart.toISOString());
    updateEnd(yesterdayEnd.toISOString());
    setSelectedDate("yesterday");
    setDateFilterMode(true);
    setDisplayQuery(!displayQuery);
  };

  const handleSetQueryToThisWeekAndFetchSales = () => {
    const today = new Date();

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0); // Start of the week (Sunday)

    const weekEnd = new Date(today);
    weekEnd.setHours(23, 59, 59, 999); // End of today (end of the week if today is Saturday)

    updateStart(weekStart.toISOString());
    updateEnd(weekEnd.toISOString());
    setSelectedDate("thisWeek");
    setDateFilterMode(true);
    setDisplayQuery(!displayQuery);
  };

  const handleSetQueryToThisMonthAndFetchSales = () => {
    const today = new Date();

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0); // Start of the month

    const monthEnd = new Date(today);
    monthEnd.setHours(23, 59, 59, 999); // End of today (last day of the month if today is the last day)

    updateStart(monthStart.toISOString());
    updateEnd(monthEnd.toISOString());
    setSelectedDate("thisMonth");
    setDateFilterMode(true);
    setDisplayQuery(!displayQuery);
  };

  const handleDisplayQuery = () => {
    setDisplayQuery(!displayQuery);
  };

  const scrollLeft = () => {
    statisticsRef.current.scrollBy({
      top: 0,
      left: -200, // Adjust the scroll distance as needed
      behavior: "smooth",
    });
  };

  const scrollRight = () => {
    statisticsRef.current.scrollBy({
      top: 0,
      left: 200, // Adjust the scroll distance as needed
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        displayQuery &&
        queryContainerRef.current &&
        !queryContainerRef.current.contains(event.target)
      ) {
        setDisplayQuery(!displayQuery);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [displayQuery]);

  return (
    <div className="statistics-wrapper">
      <div className="statistics-container">
        <button className="scroll-button left" onClick={scrollLeft}>
          <img src={leftArrow} alt="Scroll Left" />
        </button>

        <div className="statistics-grid" ref={statisticsRef}>
          {/* Sort by Date - as first card */}
          <div className="stat-card query-card" onClick={handleDisplayQuery}>
            <div className="stat-icon">
              {/* <img src={dateIcon} alt="date" /> */}
              <DateIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Filter</span>
              <h1 className="stat-value">Sort by date</h1>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="stat-card">
            <div className="stat-icon">
              <SalesIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Sales</span>
              <h1 className="stat-value">
                {admin || currentUser?.permissions?.seeBusinessFinances
                  ? formatter(totalSales)
                  : "Unavailable"}
              </h1>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <ProfitIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Total Profit</span>
              <h1 className="stat-value">
                {admin || currentUser?.permissions?.seeBusinessFinances
                  ? formatter(totalProfit)
                  : "Unavailable"}
              </h1>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <CashIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Cash</span>
              <h1 className="stat-value">
                {admin || currentUser?.permissions?.seeBusinessFinances
                  ? formatter(totalCash)
                  : "Unavailable"}
              </h1>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <TransferIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">Transfer</span>
              <h1 className="stat-value">
                {admin || currentUser?.permissions?.seeBusinessFinances
                  ? formatter(totalTransfer)
                  : "Unavailable"}
              </h1>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <POSIcon />
            </div>
            <div className="stat-content">
              <span className="stat-label">POS</span>
              <h1 className="stat-value">
                {admin || currentUser?.permissions?.seeBusinessFinances
                  ? formatter(totalOnPOS)
                  : "Unavailable"}
              </h1>
            </div>
          </div>
        </div>

        <button className="scroll-button right" onClick={scrollRight}>
          <img src={rightArrow} alt="Scroll Right" />
        </button>
      </div>

      {/* Date Picker Modal */}
      <div
        className={displayQuery ? "query-cells show-query" : "query-cells"}
        onClick={(e) => {
          if (e.target.classList.contains('show-query')) {
            setDisplayQuery(false);
          }
        }}
      >
        <div className="show_query_container sales_page_date_filter" ref={queryContainerRef}>
          {/* Modal Header */}
          <div className="modal-header">
            <h2 className="modal-title">Filter by Date</h2>
            <p className="modal-subtitle">Select a custom range or choose a preset</p>
          </div>

          {/* Custom Date Range Section */}
          <div className="date-range-section">
            <h3 className="section-title">Custom Range</h3>
            <div className="dates_selection">
              <div className="from">
                <label>From</label>
                <div>
                  <DatePicker
                    dateInputRef={dateInputRef}
                    name="start"
                    handleDateChange={handleDateChange}
                  />
                </div>
              </div>
              <div className="dash"></div>
              <div className="to">
                <label>To</label>
                <div>
                  <DatePicker
                    dateInputRef={dateInputRef}
                    name="end"
                    handleDateChange={handleDateChange}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={() => handleFetchSales(start, end)}
              className="setDate"
            >
              Apply Custom Range
            </button>
          </div>

          {/* Quick Select Section */}
          <div className="quick-select-section">
            <h3 className="section-title">Quick Select</h3>
            <div className="specific_selection">
              <button
                className={`quick-select-btn ${selectedDate === "today" ? "selected_date" : ""}`}
                onClick={handleSetQueryToTodayAndFetchSales}
              >
                <span className="btn-label">Today</span>
              </button>
              <button
                className={`quick-select-btn ${selectedDate === "yesterday" ? "selected_date" : ""}`}
                onClick={handleSetQueryToYesterdayAndFetchSales}
              >
                <span className="btn-label">Yesterday</span>
              </button>
              <button
                className={`quick-select-btn ${selectedDate === "thisWeek" ? "selected_date" : ""}`}
                onClick={handleSetQueryToThisWeekAndFetchSales}
              >
                <span className="btn-label">This Week</span>
              </button>
              <button
                className={`quick-select-btn ${selectedDate === "thisMonth" ? "selected_date" : ""}`}
                onClick={handleSetQueryToThisMonthAndFetchSales}
              >
                <span className="btn-label">This Month</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsHeader;