import React, { useEffect, useState, useMemo, useRef } from "react";
import { SpinnerImg } from "../../loader/Loader";
import "../productList/productList.scss";
import { useDispatch, useSelector } from "react-redux";
import {
  generateReceipt,
  printReceipt,
  updateDeliveryStatus,
} from "../../../redux/features/cart/cartSlice";
import ReactPaginate from "react-paginate";
import "react-confirm-alert/src/react-confirm-alert.css";
import moment from "moment";
import { Link, useSearchParams } from "react-router-dom";
import arrowDown from "../../../assets/home/arrowdown.svg";
import arrowUp from "../../../assets/home/arrowUp.svg";
import downloadIcon from "../../../assets/home/downloadIcon.svg";
import printIcon from "../../../assets/home/printIcon.svg";
import shareIcon from "../../../assets/home/shareIcon.svg";
import whatsappIcon from "../../../assets/home/whatsapp-icon2.svg";
import emailIcon from "../../../assets/home/email-icon2.svg";
import returnIcon from "../../../assets/home/return.svg";
import "./salesList.css";
import DatePicker from "../../datePicker/DatePicker";
import InventoryHeader from "../../inventoryHeader/InventoryHeader";
import { Button, Popover, Tooltip } from "antd";
import { selectUser } from "../../../redux/features/auth/authSlice";
import ReturnFunction from "./ReturnFunction";
import StatisticsHeader from "../../inventoryHeader/StatisticsHeader";
import {
  sendReceiptEmail,
  shareReceipt,
  verifyBusinessEmail,
} from "../../../services/authService";
import { toast } from "sonner";
import axios from "axios";
import fileDownload from "js-file-download";
import useFormatter from "../../../customHook/useFormatter";
import { useAsyncButtons } from "../../../customHook/useAsyncButton";
import ButtonSpinner from "../../loader/ButtonSpinner";
import {
  invalidateBulkCache,
  fetchBulkSales,
  updateBulkCacheItem,
  selectSalesArray,
  selectSalesMeta,
} from "../../../redux/features/dataCache/bulkDataCacheSlice";

// Icon Components for Payment Methods
const CashPaymentIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
      fill="currentColor"
    />
    <path
      d="M12 6C9.24 6 7 8.24 7 11C7 13.76 9.24 16 12 16C14.76 16 17 13.76 17 11C17 8.24 14.76 6 12 6ZM12 14C10.34 14 9 12.66 9 11C9 9.34 10.34 8 12 8C13.66 8 15 9.34 15 11C15 12.66 13.66 14 12 14Z"
      fill="currentColor"
    />
  </svg>
);

const TransferPaymentIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 12.3333H15M15 12.3333L12.6 10M15 12.3333L12.6 14.6667"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PosPaymentIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 8H4C2.9 8 2.01 8.9 2.01 10L2 22C2 23.1 2.9 24 4 24H20C21.1 24 22 23.1 22 22V10C22 8.9 21.1 8 20 8ZM20 22H4V10H20V22Z"
      fill="currentColor"
    />
    <path
      d="M12 17C10.34 17 9 15.66 9 14C9 12.34 10.34 11 12 11C13.66 11 15 12.34 15 14C15 15.66 13.66 17 12 17Z"
      fill="currentColor"
    />
    <path d="M4 6H20V4H4V6Z" fill="currentColor" />
  </svg>
);

// Seller Icon
const SellerIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.67 14 5 15.17 5 17.5V20H19V17.5C19 15.17 14.33 14 12 14Z"
      fill="currentColor"
    />
  </svg>
);

// Package/Items Icon
const PackageIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM8 12.5C7.17 12.5 6.5 11.83 6.5 11C6.5 10.17 7.17 9.5 8 9.5C8.83 9.5 9.5 10.17 9.5 11C9.5 11.83 8.83 12.5 8 12.5ZM12 9.5C11.17 9.5 10.5 10.17 10.5 11C10.5 11.83 11.17 12.5 12 12.5C12.83 12.5 13.5 11.83 13.5 11C13.5 10.17 12.83 9.5 12 9.5ZM16 9.5C15.17 9.5 14.5 10.17 14.5 11C14.5 11.83 15.17 12.5 16 12.5C16.83 12.5 17.5 11.83 17.5 11C17.5 10.17 16.83 9.5 16 9.5Z"
      fill="currentColor"
    />
  </svg>
);

// Payment Icon
const PaymentMethodIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M19 6H5C3.9 6 3 6.9 3 8V18C3 19.1 3.9 20 5 20H19C20.1 20 21 19.1 21 18V8C21 6.9 20.1 6 19 6ZM19 18H5V8H19V18ZM17 10H9V16H17V10Z"
      fill="currentColor"
    />
  </svg>
);

// Warehouse Icon
const WarehouseIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L2 7V12H4V20H20V12H22V7L12 2ZM12 4.18L19 7.5H5L12 4.18ZM6 18V13H18V18H6Z"
      fill="currentColor"
    />
  </svg>
);

const Sales = ({ admin }) => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoading: buttonLoading, execute } = useAsyncButtons();

  // Initialize from URL params
  // Get current month dates for default display (with full timestamp)
  const getCurrentMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59, 999);
    return {
      start: firstDay.toISOString(),
      end: lastDay.toISOString(),
    };
  };

  // Initialize dates from URL params, or use current month as default
  const defaultDates = getCurrentMonthDates();
  const hasExplicitDateParams = Boolean(
    searchParams.get("start") || searchParams.get("end"),
  );
  const [startDate, setStartDate] = useState(
    searchParams.get("start") || defaultDates.start,
  );
  const [endDate, setEndDate] = useState(
    searchParams.get("end") || defaultDates.end,
  );
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceTimeout = useRef();
  const [categoryFilter, setCategoryFilter] = useState(
    searchParams.get("category") ? searchParams.get("category").split(",") : [],
  );
  const [priceRangeFilter, setPriceRangeFilter] = useState(
    searchParams.get("priceRange")
      ? searchParams.get("priceRange").split(",")
      : [],
  );
  const [warehouseFilter, setWarehouseFilter] = useState(
    searchParams.get("warehouse")
      ? searchParams.get("warehouse").split(",")
      : [],
  );
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState(
    searchParams.get("deliveryStatus")
      ? searchParams.get("deliveryStatus").split(",")
      : [],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isDateFilterExplicit, setIsDateFilterExplicit] = useState(
    hasExplicitDateParams,
  );

  const salesArray = useSelector(selectSalesArray);
  const salesMeta = useSelector(selectSalesMeta);
  const isSalesLoading = salesMeta?.isLoading || false;
  const salesItems = useMemo(() => {
    return [...salesArray].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
  }, [salesArray]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      debouncedSearch ||
      startDate ||
      endDate ||
      categoryFilter.length > 0 ||
      priceRangeFilter.length > 0 ||
      warehouseFilter.length > 0 ||
      deliveryStatusFilter.length > 0
    );
  }, [
    debouncedSearch,
    startDate,
    endDate,
    categoryFilter,
    priceRangeFilter,
    warehouseFilter,
    deliveryStatusFilter,
  ]);

  // Memoize filters object to prevent unnecessary re-renders
  const filters = useMemo(
    () => ({
      category: categoryFilter,
      priceRange: priceRangeFilter,
      warehouse: warehouseFilter,
      deliveryStatus: deliveryStatusFilter,
    }),
    [categoryFilter, priceRangeFilter, warehouseFilter, deliveryStatusFilter],
  );

  const hasNonDateFilters = useMemo(() => {
    return (
      debouncedSearch ||
      categoryFilter.length > 0 ||
      priceRangeFilter.length > 0 ||
      warehouseFilter.length > 0 ||
      deliveryStatusFilter.length > 0
    );
  }, [
    debouncedSearch,
    categoryFilter,
    priceRangeFilter,
    warehouseFilter,
    deliveryStatusFilter,
  ]);

  // Client-side filtering - date filters apply by default unless user is actively searching
  // and has not explicitly chosen a date range.
  const filteredSales = useMemo(() => {
    const shouldApplyDateFilter = isDateFilterExplicit || !hasNonDateFilters;
    const normalizeBoundary = (value, type) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      if (type === "start") {
        date.setHours(0, 0, 0, 0);
      } else {
        date.setHours(23, 59, 59, 999);
      }
      return date;
    };

    const filtered = salesItems.filter((sale) => {
      // Search filter
      const matchesSearch =
        !debouncedSearch ||
        sale.customer?.name
          ?.toLowerCase()
          .includes(debouncedSearch.toLowerCase()) ||
        sale.customer?.email
          ?.toLowerCase()
          .includes(debouncedSearch.toLowerCase()) ||
        sale.orderId?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        sale.items?.some((item) =>
          item?.name?.toLowerCase().includes(debouncedSearch.toLowerCase()),
        );

      // Date filters
      const saleDate = new Date(sale.createdAt);
      const startDateObj = shouldApplyDateFilter
        ? normalizeBoundary(startDate, "start")
        : null;
      const endDateObj = shouldApplyDateFilter
        ? normalizeBoundary(endDate, "end")
        : null;
      const matchesStartDate = !startDateObj || saleDate >= startDateObj;
      const matchesEndDate = !endDateObj || saleDate <= endDateObj;

      // Category filter
      const matchesCategory =
        categoryFilter.length === 0 ||
        sale.items?.some((item) => categoryFilter.includes(item.category));

      // Warehouse filter
      const matchesWarehouse =
        warehouseFilter.length === 0 ||
        sale.items?.some((item) => warehouseFilter.includes(item.warehouse));

      // Price range filter
      const matchesPriceRange =
        priceRangeFilter.length === 0 ||
        sale.items?.some((item) => {
          const price = parseFloat(item?.price) || 0;
          return priceRangeFilter.some((range) => {
            const [min, max] = range.split("-").map(Number);
            return price >= min && (Number.isFinite(max) ? price <= max : true);
          });
        });

      // Delivery status filter
      const matchesDeliveryStatus =
        deliveryStatusFilter.length === 0 ||
        deliveryStatusFilter.includes(sale.deliveryStatus?.status || "pending");

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate &&
        matchesCategory &&
        matchesWarehouse &&
        matchesPriceRange &&
        matchesDeliveryStatus
      );
    });

    if (filtered.length === 0 && salesItems.length > 0) {
      console.log("[Sales] No items match filters! Sample check:", {
        totalItems: salesItems.length,
        firstItemDate: salesItems[0]?.createdAt,
        startDate,
        endDate,
        startDateObj: startDate ? new Date(startDate) : null,
        endDateObj: endDate ? new Date(endDate) : null,
        firstItemComparison: {
          saleDate: new Date(salesItems[0]?.createdAt),
          startDateObj: startDate ? new Date(startDate) : null,
          endDateObj: endDate ? new Date(endDate) : null,
        },
      });
    }

    console.log("[Sales] filteredSales calculation:", {
      salesItemsLength: salesItems.length,
      filteredLength: filtered.length,
      startDate,
      endDate,
      debouncedSearch,
    });

    return filtered;
  }, [
    salesItems,
    debouncedSearch,
    startDate,
    endDate,
    categoryFilter,
    warehouseFilter,
    priceRangeFilter,
    deliveryStatusFilter,
    isDateFilterExplicit,
    hasNonDateFilters,
  ]);

  // Client-side pagination of filtered results
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage, itemsPerPage]);

  const pageCount = useMemo(() => {
    return Math.ceil(filteredSales.length / itemsPerPage);
  }, [filteredSales.length, itemsPerPage]);

  // Debounce search and update debounced value and URL param only after debounce
  useEffect(() => {
    if (debounceTimeout?.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
      // Update URL params after debounce
      const params = {};
      if (search) params.search = search;
      if (filters.category.length > 0)
        params.category = filters.category.join(",");
      if (filters.priceRange.length > 0)
        params.priceRange = filters.priceRange.join(",");
      if (filters.warehouse.length > 0)
        params.warehouse = filters.warehouse.join(",");
      if (filters.deliveryStatus.length > 0)
        params.deliveryStatus = filters.deliveryStatus.join(",");
      if (isDateFilterExplicit && startDate) params.start = startDate;
      if (isDateFilterExplicit && endDate) params.end = endDate;
      setSearchParams(params, { replace: true });
    }, 500);
    return () => clearTimeout(debounceTimeout.current);
  }, [
    search,
    filters,
    startDate,
    endDate,
    isDateFilterExplicit,
    setSearchParams,
  ]);

  const currentUser = useSelector(selectUser);
  const [showBody, setShowBody] = useState({});
  const [returnModal, setReturnModal] = useState(false);
  const [selectedCheckoutForReturn, setSelectedCheckoutForReturn] =
    useState(null);
  const [openPopoverId, setOpenPopoverId] = useState(null);
  const [popOverCurrentSale, setPopOverCurrentSale] = useState(null);
  const [pageRangeDisplayed, setPageRangeDisplayed] = useState(3);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const handleOpenChange = (newOpen, id) => {
    setOpenPopoverId(newOpen ? id : null);
  };
  const [deliveryStatusDropdown, setDeliveryStatusDropdown] = useState(null);

  const hide = () => {
    setOpenPopoverId(null);
  };

  function handleShowBody(id) {
    setShowBody((prev) => {
      const newState = { ...prev };
      newState[id] = !newState[id];
      return newState;
    });
  }

  // Update URL params separately
  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.category.length > 0)
      params.category = filters.category.join(",");
    if (filters.priceRange.length > 0)
      params.priceRange = filters.priceRange.join(",");
    if (filters.warehouse.length > 0)
      params.warehouse = filters.warehouse.join(",");
    if (filters.deliveryStatus.length > 0)
      params.deliveryStatus = filters.deliveryStatus.join(",");
    if (isDateFilterExplicit && startDate) params.start = startDate;
    if (isDateFilterExplicit && endDate) params.end = endDate;
    setSearchParams(params, { replace: true });
  }, [
    debouncedSearch,
    filters,
    startDate,
    endDate,
    isDateFilterExplicit,
    setSearchParams,
  ]);

  const shortenText = (text, n) => {
    if (text.length > n) {
      const shortenedText = text.substring(0, n).concat("...");
      return shortenedText;
    }
    return text;
  };

  // State-driven pagination - NO backend call, just update page
  const handlePageClick = (event) => {
    setCurrentPage(event.selected + 1);
  };

  // Ensure currentPage never exceeds pageCount
  useEffect(() => {
    if (currentPage > pageCount && pageCount > 0) {
      setCurrentPage(Math.max(1, pageCount));
    }
  }, [pageCount, currentPage]);

  // Refresh handler for manual refresh
  const handleRefresh = () => {
    dispatch(invalidateBulkCache("sales"));
    dispatch(fetchBulkSales());
  };

  const { formatter } = useFormatter();

  const sendReceiptToPrinter = (id, sale) => {};

  const sendReceiptToEmail = async (sale) => {
    const email = currentUser?.email;
    if (!email) {
      return;
    }

    await execute(`sendEmail-${sale._id}`, async () => {
      const formData = {
        toEmail: sale.customer.email,
        sale: sale,
      };

      handleOpenChange(false, openPopoverId);
      try {
        const response = await sendReceiptEmail(formData);
        toast.success(response.message);
        console.log("response", response);
      } catch (error) {
        console.log("error", error);
        toast.error("Failed to send email");
      }
    });
  };

  const verifyEmailSendGrid = async () => {
    await execute("verifyEmail", async () => {
      try {
        const data = await verifyBusinessEmail();
        toast.success("Kindly check your email to verify your email address");
        handleOpenChange(false, openPopoverId);
      } catch (error) {
        toast.error(error.message);
        console.log("error", error);
      }
    });
  };

  const shareReceiptContent = (sale) => {
    const message = `Thank you for your purchase!\n\nPlease find your receipt attached.`;

    const shareViaWhatsApp = async () => {
      handleOpenChange(false, openPopoverId);
      // setVerifyingEmail(true);
      try {
        const receipt = await shareReceipt(sale, sale._id);

        const receiptFile = new File([receipt], "receipt.pdf", {
          type: "application/pdf",
        });

        // console.log("receiptFile", receiptFile);
        if (
          navigator.canShare &&
          navigator.canShare({ files: [receiptFile] })
        ) {
          await navigator.share({
            title: "Sales Receipt",
            text: message,
            files: [receiptFile],
          });
        } else {
          // Fallback for unsupported browsers
          toast.error("File sharing is not supported on this device.");
        }
      } catch (error) {
        console.log("Error sharing:", error);
        toast.error("Failed to share the receipt.");
      }
    };

    return (
      <div className="share-receipt-content">
        <span>
          Verify your email to send emails, click{" "}
          <span
            onClick={
              buttonLoading("verifyEmail") ? undefined : verifyEmailSendGrid
            }
            style={{
              opacity: buttonLoading("verifyEmail") ? 0.6 : 1,
              cursor: buttonLoading("verifyEmail") ? "not-allowed" : "pointer",
            }}
          >
            {buttonLoading("verifyEmail") ? "Verifying..." : "here"}
          </span>
        </span>
        <a
          onClick={
            buttonLoading(`sendEmail-${sale._id}`)
              ? undefined
              : () => sendReceiptToEmail(sale)
          }
          target="_blank"
          rel="noopener noreferrer"
          style={{
            opacity: buttonLoading(`sendEmail-${sale._id}`) ? 0.6 : 1,
            cursor: buttonLoading(`sendEmail-${sale._id}`)
              ? "not-allowed"
              : "pointer",
          }}
        >
          {buttonLoading(`sendEmail-${sale._id}`) && (
            <ButtonSpinner size="12px" />
          )}
          <img src={emailIcon} alt="email" />
          <span className="share_text">
            {buttonLoading(`sendEmail-${sale._id}`) ? "Sending..." : "Email"}
          </span>
        </a>
        <a onClick={shareViaWhatsApp} target="_blank" rel="noopener noreferrer">
          <img src={whatsappIcon} alt="whatsapp" />
          <span className="share_text">WhatsApp/Other channels</span>
        </a>
      </div>
    );
  };

  const handleChangeDeliveryStatus = async (id, newStatus) => {
    await execute(`delivery-${id}`, async () => {
      const formData = {
        id: id,
        status: newStatus,
      };

      if (currentUser?.permissions?.sellProducts) {
        try {
          const response = await dispatch(updateDeliveryStatus(formData));
          // Update the sale directly in the bulk cache from the API response
          // instead of refetching all sales via GET
          const updatedCheckout = response?.payload;
          if (updatedCheckout && updatedCheckout._id) {
            dispatch(
              updateBulkCacheItem({
                dataType: "sales",
                item: updatedCheckout,
              }),
            );
          }
          toast.success("Delivery status updated successfully.");
          setDeliveryStatusDropdown(null);
        } catch (error) {
          console.log("error", error);
          toast.error("Failed to update delivery status.");
        }
      } else {
        toast.error("You do not have permission to update delivery status.");
      }
    });
  };

  const toggleDeliveryStatusDropdown = (id) => {
    setDeliveryStatusDropdown((prev) => (prev === id ? null : id));
  };

  const handleDetectMobileScreen = () => {
    if (window.innerWidth <= 500) {
      setPageRangeDisplayed(2); // For mobile devices
    } else {
      setPageRangeDisplayed(3); // For larger screens
    }
  };

  useEffect(() => {
    handleDetectMobileScreen(); // Set initial value
    window.addEventListener("resize", handleDetectMobileScreen);
    return () => {
      window.removeEventListener("resize", handleDetectMobileScreen);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideDropdown = event.target.closest(
        ".delivery-status-dropdown",
      );
      const clickedInsideLegacyOptions = event.target.closest(
        ".delivery-status-options",
      );
      const clickedInsidePopover = event.target.closest(
        ".delivery-status-options-popover",
      );
      const clickedInsideAntPopover = event.target.closest(".ant-popover");

      if (
        deliveryStatusDropdown &&
        !clickedInsideDropdown &&
        !clickedInsideLegacyOptions &&
        !clickedInsidePopover &&
        !clickedInsideAntPopover
      ) {
        setDeliveryStatusDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [deliveryStatusDropdown]);

  return (
    <>
      <div className="product-list sales-page">
        <InventoryHeader
          label="Sales"
          placeholder="Search sales by product, customer, or order ID..."
          search={search}
          handleSearchChange={(e) => setSearch(e.target.value)}
          onRefresh={handleRefresh}
          isRefreshing={isSalesLoading}
          refreshLabel="Refresh"
          filters={filters}
          onFilterChange={(filterType, values) => {
            if (filterType === "category") {
              setCategoryFilter(values);
            } else if (filterType === "priceRange") {
              setPriceRangeFilter(values);
            } else if (filterType === "warehouse") {
              setWarehouseFilter(values);
            } else if (filterType === "deliveryStatus") {
              setDeliveryStatusFilter(values);
            }
          }}
          categories={[]}
          warehouses={[]}
          deliveryStatuses={["pending", "picked-up", "delivered"]}
        />

        <div className="table">
          {returnModal && selectedCheckoutForReturn && (
            <div
              className="return_container"
              onClick={(e) => {
                // Close modal when clicking the backdrop
                if (e.target.className === "return_container") {
                  setReturnModal(false);
                  setSelectedCheckoutForReturn(null);
                }
              }}
            >
              <ReturnFunction
                handleCancel={() => {
                  // Close modal
                  setReturnModal(false);
                  setSelectedCheckoutForReturn(null);
                }}
                selectedCheckout={selectedCheckoutForReturn}
                admin={admin}
                currentUser={currentUser}
                startDate={startDate}
                endDate={endDate}
                search={debouncedSearch}
              />
            </div>
          )}

          <StatisticsHeader
            checkouts={filteredSales}
            admin={admin}
            search={debouncedSearch}
            currentUser={currentUser}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onDateFilterModeChange={setIsDateFilterExplicit}
          />

          {isSalesLoading && (
            <p className="no-products-p">Loading checkouts...</p>
          )}
          {verifyingEmail && (
            <p className="no-products-p">Verifying email...</p>
          )}

          <div className="">
            {!isSalesLoading && currentItems.length === 0 ? (
              <p className="no-products-p">
                -- All checkouts will appear here...
              </p>
            ) : (
              <>
                {/* Desktop Table View */}
                <table className="salesList-table desktop-table">
                  <thead>
                    <tr>
                      <th>Id</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Customer</th>
                      <th>Payment Type</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Delivery</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems?.map((sale, index) => {
                      const {
                        customer,
                        items,
                        user,
                        createdAt,
                        _id,
                        payment,
                        deliveryStatus,
                        orderId,
                      } = sale;
                      const format = "DD-MM-YYYY h:mmA";
                      const formattedDate = moment(createdAt).format(format);
                      const formattedDeliveryDate = moment(
                        deliveryStatus.date,
                      ).format(format);
                      const totalAmount = items.reduce(
                        (total, item) => total + item.price * item.quantity,
                        0,
                      );
                      return (
                        <React.Fragment key={index}>
                          <tr
                            className={showBody[_id] ? "show_background" : ""}
                          >
                            <td onClick={() => handleShowBody(_id)}>
                              {orderId ? orderId : index + 1}
                            </td>
                            <td onClick={() => handleShowBody(_id)}>
                              <div className="item_s_date">{formattedDate}</div>
                            </td>
                            <td onClick={() => handleShowBody(_id)}>
                              <span className="items-badge">
                                {items.length}
                              </span>
                            </td>
                            <td>
                              <div className="item_name">
                                {customer?.name && (
                                  <Tooltip title={customer?.name}>
                                    {shortenText(customer?.name, 14)}
                                  </Tooltip>
                                )}
                              </div>
                            </td>

                            <td onClick={() => handleShowBody(_id)}>
                              <div className="payment-type-badge">
                                <span
                                  className={`payment-badge payment-${payment?.paymentType?.toLowerCase()}`}
                                >
                                  {payment?.paymentType}
                                </span>
                              </div>
                            </td>
                            <td onClick={() => handleShowBody(_id)}>
                              <span
                                className={`status-badge status-${payment?.paymentStatus?.toLowerCase()}`}
                              >
                                {payment?.paymentStatus}
                              </span>
                            </td>
                            <td>
                              <div className="item_name total-amount">
                                {formatter(totalAmount)}
                              </div>
                            </td>
                            <td>
                              <Popover
                                content={
                                  <div className="delivery-status-options-popover">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleChangeDeliveryStatus(
                                          _id,
                                          "pending",
                                        );
                                        toggleDeliveryStatusDropdown(null);
                                      }}
                                      className={
                                        deliveryStatus?.status === "pending"
                                          ? "option active"
                                          : "option"
                                      }
                                    >
                                      Pending
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleChangeDeliveryStatus(
                                          _id,
                                          "delivered",
                                        );
                                        toggleDeliveryStatusDropdown(null);
                                      }}
                                      className={
                                        deliveryStatus?.status === "delivered"
                                          ? "option active"
                                          : "option"
                                      }
                                    >
                                      Delivered
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleChangeDeliveryStatus(
                                          _id,
                                          "pickedup",
                                        );
                                        toggleDeliveryStatusDropdown(null);
                                      }}
                                      className={
                                        deliveryStatus?.status === "pickedup"
                                          ? "option active"
                                          : "option"
                                      }
                                    >
                                      Picked up
                                    </button>
                                  </div>
                                }
                                title="Update Delivery Status"
                                trigger="click"
                                open={deliveryStatusDropdown === _id}
                                onOpenChange={(open) =>
                                  toggleDeliveryStatusDropdown(
                                    open ? _id : null,
                                  )
                                }
                                placement="bottomRight"
                                overlayStyle={{ zIndex: 2000 }}
                              >
                                <div className="delivery-status-badge-trigger">
                                  <span
                                    className={`delivery-badge delivery-${deliveryStatus?.status}`}
                                  >
                                    {deliveryStatus?.status === "pickedup"
                                      ? "picked up"
                                      : deliveryStatus?.status}
                                  </span>
                                  <span className="delivery-date">
                                    {formattedDeliveryDate}
                                  </span>
                                </div>
                              </Popover>
                            </td>
                            <td className="icons sales_page_action_icons">
                              <span className="actions-spans item_s_icons">
                                {/* <span
                                  className="arrow-btn"
                                  onClick={() => handleShowBody(_id)}
                                >
                                  <img
                                    src={showBody[_id] ? arrowUp : arrowDown}
                                    alt="arrow down"
                                  />
                                </span> */}
                                <span
                                  className="receipt"
                                  onClick={() => {
                                    dispatch(generateReceipt(_id));
                                  }}
                                >
                                  <img src={downloadIcon} alt="download" />
                                </span>

                                <Popover
                                  content={() => shareReceiptContent(sale)}
                                  title="Share Receipt via:"
                                  trigger="click"
                                  open={openPopoverId === _id}
                                  onOpenChange={(newOpen) =>
                                    handleOpenChange(newOpen, _id)
                                  }
                                >
                                  <Button>
                                    <span className="receipt noclick">
                                      <img src={shareIcon} alt="print" />
                                    </span>
                                  </Button>
                                </Popover>

                                <span
                                  className="receipt"
                                  onClick={() => {
                                    dispatch(printReceipt(_id, sale));
                                  }}
                                >
                                  <img src={printIcon} alt="print" />
                                </span>
                                {admin ||
                                currentUser?.permissions?.returnItems ? (
                                  <span
                                    className="return_icon"
                                    onClick={() => {
                                      setSelectedCheckoutForReturn(sale);
                                      setReturnModal(true);
                                    }}
                                    style={{ cursor: "pointer" }}
                                  >
                                    <img src={returnIcon} alt="return" />
                                  </span>
                                ) : (
                                  ""
                                )}
                              </span>
                            </td>
                          </tr>
                          {showBody[_id] && (
                            <>
                              <tr className="dropdown-section">
                                <td colSpan="9">
                                  <div className="dropdown-chip-row">
                                    <div className="chip-pill vendor-chip">
                                      <span className="chip-icon">
                                        <SellerIcon />
                                      </span>
                                      <span className="chip-text">
                                        <span className="chip-label">
                                          Sold by
                                        </span>
                                        <span className="chip-value">
                                          {user?.name || "N/A"}
                                        </span>
                                      </span>
                                    </div>

                                    {payment?.paymentAmounts?.cash > 0 && (
                                      <div className="chip-pill cash-chip">
                                        <span className="chip-icon">
                                          <CashPaymentIcon />
                                        </span>
                                        <span className="chip-text">
                                          <span className="chip-label">
                                            Cash
                                          </span>
                                          <span className="chip-value">
                                            {formatter(
                                              payment.paymentAmounts.cash,
                                            )}
                                          </span>
                                        </span>
                                      </div>
                                    )}

                                    {payment?.paymentAmounts?.transfer > 0 && (
                                      <div className="chip-pill transfer-chip">
                                        <span className="chip-icon">
                                          <TransferPaymentIcon />
                                        </span>
                                        <span className="chip-text">
                                          <span className="chip-label">
                                            Transfer
                                          </span>
                                          <span className="chip-value">
                                            {formatter(
                                              payment.paymentAmounts.transfer,
                                            )}
                                          </span>
                                        </span>
                                      </div>
                                    )}

                                    {payment?.paymentAmounts?.pos > 0 && (
                                      <div className="chip-pill pos-chip">
                                        <span className="chip-icon">
                                          <PosPaymentIcon />
                                        </span>
                                        <span className="chip-text">
                                          <span className="chip-label">
                                            POS
                                          </span>
                                          <span className="chip-value">
                                            {formatter(
                                              payment.paymentAmounts.pos,
                                            )}
                                          </span>
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              <tr className="items-section-row">
                                <td colSpan="9">
                                  <div className="items-section-wrapper">
                                    <div className="section-header">
                                      <PackageIcon />
                                      <span className="section-title">
                                        Items ({items.length})
                                      </span>
                                    </div>
                                    <div className="items-table-container">
                                      <table className="items-table">
                                        <thead>
                                          <tr>
                                            <th>Product Name</th>
                                            <th>Warehouse</th>
                                            <th>Price</th>
                                            <th>Cost</th>
                                            <th>Qty</th>
                                            <th>Profit</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items &&
                                            items.map((item, idx) => (
                                              <tr
                                                key={idx}
                                                className="item-row"
                                              >
                                                <td className="item-name-cell">
                                                  <Tooltip title={item?.name}>
                                                    {shortenText(
                                                      item?.name,
                                                      25,
                                                    )}
                                                  </Tooltip>
                                                </td>
                                                <td className="warehouse-cell">
                                                  <Tooltip
                                                    title={
                                                      item.warehouse || "N/A"
                                                    }
                                                  >
                                                    {shortenText(
                                                      item.warehouse || "N/A",
                                                      15,
                                                    )}
                                                  </Tooltip>
                                                </td>
                                                <td className="price-cell">
                                                  {formatter(item.price)}
                                                </td>
                                                <td className="cost-cell">
                                                  {admin ||
                                                  currentUser?.permissions
                                                    ?.seeBusinessFinances
                                                    ? formatter(item.cost)
                                                    : "N/A"}
                                                </td>
                                                <td className="qty-cell">
                                                  {item.quantity}
                                                </td>
                                                <td className="profit-cell">
                                                  {admin ||
                                                  currentUser?.permissions
                                                    ?.seeBusinessFinances
                                                    ? formatter(
                                                        item.price *
                                                          item.quantity -
                                                          item.cost *
                                                            item.quantity,
                                                      )
                                                    : "N/A"}
                                                </td>
                                              </tr>
                                            ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="sales-cards-mobile">
                  {currentItems?.map((sale, index) => {
                    const {
                      customer,
                      items,
                      user,
                      createdAt,
                      _id,
                      payment,
                      deliveryStatus,
                      orderId,
                    } = sale;
                    const format = "DD-MM-YYYY h:mmA";
                    const formattedDate = moment(createdAt).format(format);
                    const formattedDeliveryDate = moment(
                      deliveryStatus.date,
                    ).format(format);
                    const totalAmount = items.reduce(
                      (total, item) => total + item.price * item.quantity,
                      0,
                    );
                    return (
                      <div key={index} className="sale-card-mobile">
                        <div className="sale-card-header">
                          <div className="sale-card-id">
                            <span className="label">Order ID:</span>
                            <span className="value">
                              #{orderId ? orderId : index + 1}
                            </span>
                          </div>
                          <div className="sale-card-date">{formattedDate}</div>
                        </div>

                        <div className="sale-card-body">
                          <div className="sale-card-row">
                            <span className="label">Customer:</span>
                            <span className="value">
                              {customer?.name || "N/A"}
                            </span>
                          </div>

                          <div className="sale-card-row">
                            <span className="label">Items:</span>
                            <span className="items-badge">{items.length}</span>
                          </div>

                          <div className="sale-card-row">
                            <span className="label">Payment Method:</span>
                            <span
                              className={`payment-badge payment-${payment?.paymentType?.toLowerCase()}`}
                            >
                              {payment?.paymentType}
                            </span>
                          </div>

                          <div className="sale-card-row">
                            <span className="label">Payment Status:</span>
                            <span
                              className={`status-badge status-${payment?.paymentStatus?.toLowerCase()}`}
                            >
                              {payment?.paymentStatus}
                            </span>
                          </div>

                          <div className="sale-card-row">
                            <span className="label">Total Amount:</span>
                            <span className="value total-amount">
                              {formatter(totalAmount)}
                            </span>
                          </div>

                          <div className="sale-card-row">
                            <span className="label">Delivery Status:</span>
                            <div
                              className="delivery-status-dropdown"
                              onClick={() => toggleDeliveryStatusDropdown(_id)}
                            >
                              <span
                                className={`delivery-badge delivery-${deliveryStatus?.status}`}
                              >
                                {deliveryStatus?.status === "pickedup"
                                  ? "picked up"
                                  : deliveryStatus?.status}
                              </span>
                              <span className="delivery-date">
                                {formattedDeliveryDate}
                              </span>
                              {deliveryStatusDropdown === _id && (
                                <div className="delivery-status-options">
                                  <div
                                    onClick={() =>
                                      handleChangeDeliveryStatus(_id, "pending")
                                    }
                                    className={
                                      deliveryStatus?.status === "pending"
                                        ? "option active"
                                        : "option"
                                    }
                                  >
                                    Pending
                                  </div>
                                  <div
                                    onClick={() =>
                                      handleChangeDeliveryStatus(
                                        _id,
                                        "delivered",
                                      )
                                    }
                                    className={
                                      deliveryStatus?.status === "delivered"
                                        ? "option active"
                                        : "option"
                                    }
                                  >
                                    Delivered
                                  </div>
                                  <div
                                    onClick={() =>
                                      handleChangeDeliveryStatus(
                                        _id,
                                        "pickedup",
                                      )
                                    }
                                    className={
                                      deliveryStatus?.status === "pickedup"
                                        ? "option active"
                                        : "option"
                                    }
                                  >
                                    Picked up
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="sale-card-actions">
                          <button
                            className="action-btn"
                            onClick={() => handleShowBody(_id)}
                          >
                            <img
                              src={showBody[_id] ? arrowUp : arrowDown}
                              alt="toggle details"
                            />
                            {showBody[_id] ? "Hide Details" : "View Details"}
                          </button>
                          <button
                            className="action-btn"
                            onClick={() => {
                              dispatch(generateReceipt(_id));
                            }}
                          >
                            <img src={downloadIcon} alt="download" />
                          </button>
                          <Popover
                            content={() => shareReceiptContent(sale)}
                            title="Share Receipt via:"
                            trigger="click"
                            open={openPopoverId === _id}
                            onOpenChange={(newOpen) =>
                              handleOpenChange(newOpen, _id)
                            }
                          >
                            <Button className="action-btn">
                              <img src={shareIcon} alt="share" />
                            </Button>
                          </Popover>
                          <button
                            className="action-btn"
                            onClick={() => {
                              dispatch(printReceipt(_id, sale));
                            }}
                          >
                            <img src={printIcon} alt="print" />
                          </button>
                          {(admin || currentUser?.permissions?.returnItems) && (
                            <button
                              className="action-btn return-btn"
                              onClick={() => {
                                setSelectedCheckoutForReturn(sale);
                                setReturnModal(true);
                              }}
                            >
                              <img src={returnIcon} alt="return" />
                            </button>
                          )}
                        </div>

                        {showBody[_id] && (
                          <div className="sale-card-details-mobile">
                            {/* Vendor Section */}
                            <div className="mobile-info-section">
                              <div className="section-header">
                                <SellerIcon />
                                <span className="section-label">Vendor</span>
                              </div>
                              <span className="section-value">
                                {user?.name}
                              </span>
                            </div>

                            {/* Payment Breakdown Section */}
                            {payment?.paymentAmounts &&
                              (Object.values(payment.paymentAmounts).some(
                                (amount) => amount > 0,
                              ) ||
                                (payment.paymentDetails?.paymentParts &&
                                  payment.paymentDetails.paymentParts.length >
                                    0)) && (
                                <div className="mobile-info-section">
                                  <div className="section-header">
                                    <PaymentMethodIcon />
                                    <span className="section-label">
                                      Payment Methods
                                    </span>
                                  </div>
                                  <div className="payment-chips-mobile">
                                    {payment.paymentAmounts?.cash > 0 && (
                                      <div className="payment-chip-mobile">
                                        <CashPaymentIcon />
                                        <div className="chip-info">
                                          <span className="chip-name">
                                            Cash
                                          </span>
                                          <span className="chip-value">
                                            {formatter(
                                              payment.paymentAmounts.cash,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    {payment.paymentAmounts?.transfer > 0 && (
                                      <div className="payment-chip-mobile">
                                        <TransferPaymentIcon />
                                        <div className="chip-info">
                                          <span className="chip-name">
                                            Transfer
                                          </span>
                                          <span className="chip-value">
                                            {formatter(
                                              payment.paymentAmounts.transfer,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    {payment.paymentAmounts?.pos > 0 && (
                                      <div className="payment-chip-mobile">
                                        <PosPaymentIcon />
                                        <div className="chip-info">
                                          <span className="chip-name">POS</span>
                                          <span className="chip-value">
                                            {formatter(
                                              payment.paymentAmounts.pos,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Items Horizontal Scroll Section */}
                            <div className="mobile-info-section items-section-mobile">
                              <div className="section-header">
                                <PackageIcon />
                                <span className="section-label">
                                  Items ({items.length})
                                </span>
                              </div>
                              <div className="items-scroll-container">
                                {items &&
                                  items.map((item, idx) => (
                                    <div key={idx} className="item-scroll-card">
                                      <div className="item-scroll-name">
                                        {shortenText(item?.name, 18)}
                                      </div>
                                      <div className="item-scroll-field">
                                        <span className="field-icon">
                                          <WarehouseIcon />
                                        </span>
                                        <div className="field-data">
                                          <span className="field-small-label">
                                            Warehouse
                                          </span>
                                          <span className="field-small-value">
                                            {shortenText(
                                              item.warehouse || "N/A",
                                              10,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="item-scroll-field">
                                        <span className="field-small-label">
                                          Price
                                        </span>
                                        <span className="field-small-value">
                                          {formatter(item.price)}
                                        </span>
                                      </div>
                                      <div className="item-scroll-field">
                                        <span className="field-small-label">
                                          Cost
                                        </span>
                                        <span className="field-small-value">
                                          {admin ||
                                          currentUser?.permissions
                                            ?.seeBusinessFinances
                                            ? formatter(item.cost)
                                            : "N/A"}
                                        </span>
                                      </div>
                                      <div className="item-scroll-field">
                                        <span className="field-small-label">
                                          Qty
                                        </span>
                                        <span className="field-small-value">
                                          {item.quantity}
                                        </span>
                                      </div>
                                      <div className="item-scroll-field">
                                        <span className="field-small-label">
                                          Profit
                                        </span>
                                        <span className="field-small-value">
                                          {admin ||
                                          currentUser?.permissions
                                            ?.seeBusinessFinances
                                            ? formatter(
                                                item.price * item.quantity -
                                                  item.cost * item.quantity,
                                              )
                                            : "N/A"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <ReactPaginate
            breakLabel="..."
            nextLabel=">"
            onPageChange={handlePageClick}
            pageRangeDisplayed={2}
            pageCount={pageCount}
            previousLabel="<"
            renderOnZeroPageCount={null}
            containerClassName={`pagination ${
              isSalesLoading ? "pagination-disabled" : ""
            }`}
            pageLinkClassName="page-num"
            previousLinkClassName="page-num"
            nextLinkClassName="page-num"
            activeLinkClassName="activePageClass"
          />
        </div>
      </div>
    </>
  );
};

export default Sales;
