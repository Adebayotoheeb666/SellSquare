import React, { useState, useMemo, useEffect } from "react";
import "./activities.css";
import { useDispatch, useSelector } from "react-redux";
import { selectUser } from "../../../redux/features/auth/authSlice";
import { toast } from "sonner";
import moment from "moment";
import { Helmet } from "react-helmet";
import NumberedPagination from "../../../components/pagination/NumberedPagination";
import {
  invalidateBulkCache,
  fetchBulkActivities,
  selectActivitiesArray,
  selectActivitiesMeta,
} from "../../../redux/features/dataCache/bulkDataCacheSlice";

const BusinessActivities = () => {
  const [showActivities, setShowActivities] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState({});
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const activitiesPerPage = 10;
  const currentUser = useSelector(selectUser);
  const dispatch = useDispatch();

  /**
   * EVENT-DRIVEN ARCHITECTURE:
   * Activities are bulk-loaded during bootstrap (useDataBootstrap in Layout).
   * This component uses state-driven pagination - NO backend calls on mount/navigation.
   * Updates come via WebSocket events which update the bulkDataCache directly.
   * Manual refresh is available but should rarely be needed.
   */

  const allActivities = useSelector(selectActivitiesArray);
  const activitiesMeta = useSelector(selectActivitiesMeta);
  const isActivityLoading = activitiesMeta?.isLoading || false;

  const toggleActivityDetails = (index) => {
    setExpandedActivities((prevState) => ({
      ...prevState,
      [index]: !prevState[index],
    }));
  };

  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
  };

  // State-driven page change - NO backend call, just slice Redux data
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Manual refresh (only for user-initiated refresh, not automatic)
  const handleRefresh = () => {
    dispatch(invalidateBulkCache('activities'));
    dispatch(fetchBulkActivities());
  };

  const filteredActivities = useMemo(() => {
    const safeActivities = Array.isArray(allActivities) ? allActivities : [];

    return safeActivities
      .filter((activity) => {
        const matchesSearch = String(activity?.activity || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesStartDate = startDate
          ? new Date(activity?.createdAt) >= new Date(startDate)
          : true;
        const matchesEndDate = endDate
          ? new Date(activity?.createdAt) <= new Date(endDate)
          : true;
        return matchesSearch && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => {
        if (sortOrder === "asc") {
          return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
        }
        return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
      });
  }, [allActivities, searchTerm, startDate, endDate, sortOrder]);

  const indexOfLastActivity = currentPage * activitiesPerPage;
  const indexOfFirstActivity = indexOfLastActivity - activitiesPerPage;

  const currentActivities = filteredActivities.slice(
    indexOfFirstActivity,
    indexOfLastActivity,
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / activitiesPerPage),
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="business_activities_page">
      <Helmet>
        <title>Business Activities | Sell Square - Activity Logs & Audit Trail</title>
        <meta
          name="description"
          content="Complete business activity tracking and audit trail. Monitor team actions, see who is doing what and when, track all changes, ensure accountability, and maintain operational transparency with detailed activity logs."
        />
        <meta
          name="keywords"
          content="business activities, activity log, audit trail, team monitoring, user tracking, business transparency, activity timeline, operational logs, team accountability, business audit"
        />
        <meta name="author" content="Sell Square" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Business Activities | Sell Square - Complete Audit Trail" />
        <meta
          property="og:description"
          content="Track every action in your business. Monitor team activities, maintain audit trails, and ensure complete operational transparency."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.sellsquarehub.com/activities" />
        <meta property="og:site_name" content="Sell Square" />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Business Activities | Sell Square" />
        <meta
          name="twitter:description"
          content="Complete activity logs and audit trail for your business operations."
        />
        <meta
          name="twitter:image"
          content="https://res.cloudinary.com/dfrwntkjm/image/upload/v1741715297/logo_green_liq4cm.png"
        />
        <link rel="canonical" href="https://www.sellsquarehub.com/activities" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Business Activities | Sell Square",
            description:
              "Track all business activities with detailed logs. Monitor team actions, ensure accountability, and maintain complete transparency.",
            url: "https://www.sellsquarehub.com/activities",
          })}
        </script>
      </Helmet>

      {/* Header Section */}
      <div className="activities_header">
        <div className="header_icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1>Business Activities</h1>
        <p className="subtitle">Monitor and track all business operations in real-time</p>
        <button
          type="button"
          className="activities-refresh-btn"
          onClick={handleRefresh}
          disabled={isActivityLoading}
        >
          {isActivityLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {isActivityLoading && (
        <div className="loading_container">
          <div className="loading_spinner"></div>
          <p>Loading activities...</p>
        </div>
      )}

      {/* Check if user has access to activities based on subscription plan */}
      {currentUser?.subscription?.plan !== "Standard" &&
        currentUser?.subscription?.plan !== "Professional" ? (
        <div className="upgrade-card">
          <div className="upgrade-icon">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15V3M12 15L8 11M12 15L16 11M2 17L2.621 19.485C2.72915 19.9177 2.97882 20.3018 3.33033 20.5763C3.68184 20.8508 4.11501 21.0001 4.561 21H19.439C19.885 21.0001 20.3182 20.8508 20.6697 20.5763C21.0212 20.3018 21.2708 19.9177 21.379 19.485L22 17" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>Unlock Activity Tracking</h2>
          <p>Activity logs are available for Standard and Professional plans.</p>
          <button
            onClick={() =>
              toast.info("Upgrade to Standard or Professional plan to access activity logs.")
            }
            className="upgrade_button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Upgrade Now
          </button>
        </div>
      ) : (
        <div className="activities_content">
          {/* Stats Cards */}
          {/* <div className="stats_container">
            <div className="stat_card">
              <div className="stat_icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="stat_info">
                <p className="stat_label">Total Activities</p>
                <p className="stat_value">{activitiesPagination?.totalCount || (hasActiveFilters ? filteredActivities.length : activities.length) || 0}</p>
              </div>
            </div>
            <div className="stat_card">
              <div className="stat_icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="stat_info">
                <p className="stat_label">Current Page</p>
                <p className="stat_value">{currentPage} of {totalPages}</p>
              </div>
            </div>
            <div className="stat_card">
              <div className="stat_icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 3H21M3 7H21M3 11H21M3 15H21M3 19H21" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="stat_info">
                <p className="stat_label">Showing</p>
                <p className="stat_value">{currentActivities.length} items</p>
              </div>
            </div>
          </div> */}

          {/* Filters Card */}
          <div className="filters_card">
            <h3 className="filters_title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V6.58579C21 6.851 20.8946 7.10536 20.7071 7.29289L14.2929 13.7071C14.1054 13.8946 14 14.149 14 14.4142V17L10 21V14.4142C10 14.149 9.89464 13.8946 9.70711 13.7071L3.29289 7.29289C3.10536 7.10536 3 6.851 3 6.58579V4Z" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Filter & Search
            </h3>
            <div className="filters_grid">
              <div className="filter_item">
                <label>Search Activities</label>
                <div className="input_wrapper">
                  <svg className="input_icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search_input"
                  />
                </div>
              </div>
              <div className="filter_item">
                <label>Sort By</label>
                <div className="input_wrapper">
                  <svg className="input_icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 4H16M3 8H12M3 12H12M17 8V20M17 20L13 16M17 20L21 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <select
                    value={sortOrder}
                    onChange={handleSortChange}
                    className="sort_select"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>
              <div className="filter_item">
                <label>Start Date</label>
                <div className="input_wrapper">
                  <svg className="input_icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 2V5M16 2V5M3 9H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    type="date"
                    value={startDate}
                    onChange={handleStartDateChange}
                    className="date_input"
                  />
                </div>
              </div>
              <div className="filter_item">
                <label>End Date</label>
                <div className="input_wrapper">
                  <svg className="input_icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 2V5M16 2V5M3 9H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    type="date"
                    value={endDate}
                    onChange={handleEndDateChange}
                    className="date_input"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Activities List */}
          <div className="activities_timeline">
            {currentActivities.length === 0 ? (
              <div className="empty_state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3>No Activities Found</h3>
                <p>There are no activities matching your criteria.</p>
              </div>
            ) : (
              currentActivities.map((activity, index) => (
                <div
                  key={index}
                  className={`activity_card ${expandedActivities[index] ? "expanded" : ""}`}
                  onClick={() => toggleActivityDetails(index)}
                >
                  <div className="activity_timeline_marker">
                    <div className="timeline_dot"></div>
                    {index !== currentActivities.length - 1 && <div className="timeline_line"></div>}
                  </div>
                  <div className="activity_content">
                    <div className="activity_header">
                      <div className="activity_icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="var(--brand-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="activity_time">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{moment(activity.createdAt).format("MMM D, YYYY · h:mm A")}</span>
                      </div>
                    </div>
                    <p className={`activity_text ${expandedActivities[index] ? "expanded" : ""}`}>
                      {activity.activity}
                    </p>
                    <div className="activity_date_full">
                      {moment(activity.createdAt).format("dddd, MMMM Do YYYY")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Use the new NumberedPagination component */}
          <NumberedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            maxVisible={5}
          />
        </div>
      )}
    </div>
  );
};

export default BusinessActivities;
