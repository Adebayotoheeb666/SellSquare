import React, { useEffect, useState, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  updateIncompletePayment,
} from "../../../redux/features/cart/cartSlice";
import ReactPaginate from "react-paginate";
import { toast } from "sonner";
import FulfilmentHeader from "../../../components/inventoryHeader/FulfilmentHeader";
import { useParams, useSearchParams } from "react-router-dom";
import "./fulfilment.css";
import FulFilmentTable from "./FulfilmentTable";
import { Helmet } from "react-helmet";
import { useStateFulfilmentsPagination } from "../../../customHook/useStatePagination";
import { selectFulfilmentsArray } from "../../../redux/features/dataCache/bulkDataCacheSlice";

const Fulfilment = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  // Debounced search state
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceTimeout = useRef();
  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(debounceTimeout.current);
  }, [search]);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState(
    searchParams.get("category") ? searchParams.get("category").split(",") : []
  );
  const [warehouseFilter, setWarehouseFilter] = useState(
    searchParams.get("warehouse") ? searchParams.get("warehouse").split(",") : []
  );
  const [priceRangeFilter, setPriceRangeFilter] = useState(
    searchParams.get("priceRange") ? searchParams.get("priceRange").split(",") : []
  );

  // Memoize filters object
  const filters = useMemo(
    () => ({
      category: categoryFilter,
      priceRange: priceRangeFilter,
      warehouse: warehouseFilter,
    }),
    [categoryFilter, priceRangeFilter, warehouseFilter]
  );
  const [amountPaid, setAmountPaid] = useState({});
  const [paymentMethod, setPaymentMethod] = useState({});
  const [methodError, setMethodError] = useState({});
  const [updatingPayment, setUpdatingPayment] = useState(null);

  // Page states for pending and completed
  const [pendingPage, setPendingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const itemsPerPage = 10;

  // Use state-driven pagination from bulk-loaded cache
  const currentPage = id === "cleared" ? completedPage : pendingPage;
  const targetStatus = id === "cleared" ? "completed" : "pending";

  const {
    items: currentItems,
    totalPages,
    isLoading: isFulfilmentsLoading,
    refresh: refreshFulfilments,
  } = useStateFulfilmentsPagination({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
    filters: filters,
    status: targetStatus,
    sortField: 'createdAt',
    sortDirection: 'desc'
  });

  // All fulfilments for categories/warehouses extraction
  const allFulfilments = useSelector(selectFulfilmentsArray);

  // pageCount comes directly from hook's totalPages
  const pageCount = totalPages || 1;

  // Both pending and completed use same currentItems (status is pre-filtered by hook)
  const pendingItems = currentItems;
  const completedItems = currentItems;
  const incompletePayments = allFulfilments;

  // Update URL params only after debounce
  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.category.length > 0) params.category = filters.category.join(",");
    if (filters.priceRange.length > 0) params.priceRange = filters.priceRange.join(",");
    if (filters.warehouse.length > 0) params.warehouse = filters.warehouse.join(",");
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, filters, setSearchParams]);

  // Extract unique categories and warehouses from all items
  const categories = useMemo(() => {
    const allCategories = new Set();
    incompletePayments.forEach((fulfilment) => {
      fulfilment.items?.forEach((item) => {
        if (item.category) allCategories.add(item.category);
      });
    });
    return Array.from(allCategories).sort();
  }, [incompletePayments]);

  const warehouses = useMemo(() => {
    const allWarehouses = new Set();
    incompletePayments.forEach((fulfilment) => {
      fulfilment.items?.forEach((item) => {
        if (item.warehouse) allWarehouses.add(item.warehouse);
      });
    });
    return Array.from(allWarehouses).sort();
  }, [incompletePayments]);

  // Handle filter changes
  const handleFilterChange = (filterType, values) => {
    switch (filterType) {
      case "category":
        setCategoryFilter(values);
        setPendingPage(1);
        setCompletedPage(1);
        break;
      case "warehouse":
        setWarehouseFilter(values);
        setPendingPage(1);
        setCompletedPage(1);
        break;
      case "priceRange":
        setPriceRangeFilter(values);
        setPendingPage(1);
        setCompletedPage(1);
        break;
      default:
        break;
    }
  };

  // State-driven page changes - NO backend call
  const handlePendingPageClick = (event) => {
    setPendingPage(event.selected + 1);
  };

  const handleCompletedPageClick = (event) => {
    setCompletedPage(event.selected + 1);
  };

  const handleAmountChange = (id, value) => {
    setAmountPaid({
      ...amountPaid,
      [id]: value,
    });
  };

  const handleMethodChange = (id, value) => {
    setPaymentMethod({
      ...paymentMethod,
      [id]: value,
    });
    setMethodError((prev) => ({ ...prev, [id]: false }));
  };

  const handleUpdatePayment = (id, method = null) => {
    const paymentUpdate = {
      id,
      amountPaid: Number(amountPaid[id]),
      method: method || paymentMethod[id],
    };

    if (!paymentUpdate.method) {
      setMethodError((prev) => ({ ...prev, [id]: true }));
      return toast.error("Please select a payment type.");
    }

    if (paymentUpdate.amountPaid && paymentUpdate.amountPaid > 0) {
      setUpdatingPayment(id);
      const previousAmount = amountPaid[id];

      setAmountPaid((prevAmountPaid) => ({
        ...prevAmountPaid,
        [id]: "",
      }));

      dispatch(updateIncompletePayment(paymentUpdate)).then((result) => {
        if (updateIncompletePayment.fulfilled.match(result)) {
          toast.success("Payment updated successfully.");
          setAmountPaid((prevAmountPaid) => ({
            ...prevAmountPaid,
            [id]: "",
          }));
        } else {
          toast.error("Failed to update payment.");
          setAmountPaid((prevAmountPaid) => ({
            ...prevAmountPaid,
            [id]: previousAmount,
          }));
        }
        setUpdatingPayment(null);
      }).catch((error) => {
        toast.error("Failed to update payment.");
        setAmountPaid((prevAmountPaid) => ({
          ...prevAmountPaid,
          [id]: previousAmount,
        }));
        setUpdatingPayment(null);
      });
    } else {
      toast.error("Please enter an amount.");
    }
  };

  return (
    <>
      <Helmet>
        <title>Payment Tracking & Fulfilment | Sell Square - Manage Debtors</title>
        <meta
          name="description"
          content="Track and update incomplete payments and part payments from customers. Monitor outstanding balances, record payment installments, update delivery status, and manage debtor accounts efficiently."
        />
        <meta
          name="keywords"
          content="payment tracking, fulfilment management, debtor tracking, part payments, payment installments, outstanding payments, delivery status, customer payments, accounts receivable, payment management"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Payment Tracking | Sell Square - Manage Outstanding Payments" />
        <meta
          property="og:description"
          content="Track incomplete payments, manage part payment installments, and update delivery status for all outstanding customer orders."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/fulfilments" />
        <meta property="og:site_name" content="Sell Square" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Payment Tracking | Sell Square" />
        <meta
          name="twitter:description"
          content="Manage outstanding payments, part payments, and delivery status efficiently."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/fulfilments" />
      </Helmet>
      <div className="product-list fulfilment_page">
        <div className="table">
          <FulfilmentHeader
            search={search}
            handleSearchChange={(e) => setSearch(e.target.value)}
            filters={filters}
            onFilterChange={handleFilterChange}
            categories={categories}
            warehouses={warehouses}
            label={id === "cleared" ? "Fulfilments | Cleared" : "Fulfilments | Pending"}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button
              type="button"
              className="refresh_btn"
              onClick={refreshFulfilments}
              disabled={isFulfilmentsLoading}
            >
              {isFulfilmentsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {!id && (
            <>
              <div>
                {!isFulfilmentsLoading && pendingItems.length === 0 ? (
                  <p className="no-products-p">
                    -- No pending payments found --
                  </p>
                ) : (
                  <FulFilmentTable
                    handleUpdatePayment={handleUpdatePayment}
                    amountPaid={amountPaid}
                    handleAmountChange={handleAmountChange}
                    items={pendingItems}
                    updatingPayment={updatingPayment}
                    paymentMethod={paymentMethod}
                    handleMethodChange={handleMethodChange}
                    methodError={methodError}
                  />
                )}
              </div>
              <ReactPaginate
                breakLabel="..."
                nextLabel=">"
                onPageChange={handlePendingPageClick}
                pageRangeDisplayed={3}
                pageCount={pageCount}
                previousLabel="<"
                renderOnZeroPageCount={null}
                containerClassName="pagination"
                pageLinkClassName="page-num"
                previousLinkClassName="page-num"
                nextLinkClassName="page-num"
                activeLinkClassName="activePageClass"
                forcePage={pendingPage - 1}
              />
            </>
          )}

          {id && id === "cleared" && (
            <>
              <div>
                {!isFulfilmentsLoading && completedItems.length === 0 ? (
                  <p className="no-products-p">
                    -- No completed payments found --
                  </p>
                ) : (
                  <FulFilmentTable
                    handleUpdatePayment={handleUpdatePayment}
                    amountPaid={amountPaid}
                    handleAmountChange={handleAmountChange}
                    items={completedItems}
                    updatingPayment={updatingPayment}
                    paymentMethod={paymentMethod}
                    handleMethodChange={handleMethodChange}
                    methodError={methodError}
                  />
                )}
              </div>
              <ReactPaginate
                breakLabel="..."
                nextLabel=">"
                onPageChange={handleCompletedPageClick}
                pageRangeDisplayed={3}
                pageCount={pageCount}
                previousLabel="<"
                renderOnZeroPageCount={null}
                containerClassName="pagination"
                pageLinkClassName="page-num"
                previousLinkClassName="page-num"
                nextLinkClassName="page-num"
                activeLinkClassName="activePageClass"
                forcePage={completedPage - 1}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Fulfilment;
