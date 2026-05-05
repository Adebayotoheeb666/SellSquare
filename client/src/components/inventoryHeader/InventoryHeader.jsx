import React, { useEffect, useState, useRef } from "react";
import Search from "../search/Search";
import "./InventoryHeader.scss";

// SVG Icon Components
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H18M5 8H15M8 12H12M10 16H10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function InventoryHeader({
  search,
  handleSearchChange,
  filters = {},
  onFilterChange,
  onRefresh,
  isRefreshing = false,
  refreshLabel = "Refresh",
  categories = [],
  warehouses = [],
  deliveryStatuses = [],
  listStatuses = [],
  label = "",
  placeholder = "Search..."
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  // Close filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFilterToggle = (filterType, value) => {
    if (onFilterChange) {
      const currentValues = filters[filterType] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];

      onFilterChange(filterType, newValues);
    }
  };

  const clearFilters = () => {
    if (onFilterChange) {
      onFilterChange('category', []);
      onFilterChange('warehouse', []);
      onFilterChange('priceRange', []);
      onFilterChange('deliveryStatus', []);
      onFilterChange('listStatus', []);
    }
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(arr => arr && arr.length > 0);
  };

  return (
    <div className="inventory-header-container">
      {label && (
        <div className="inventory-label">
          <h2>{label}</h2>
        </div>
      )}

      <div className="search-filter-wrapper">
        <div className="search-container">
          <Search value={search} onChange={handleSearchChange} placeholder={placeholder} />
        </div>

        <div className="filter-container" ref={filterRef}>
          {onRefresh ? (
            <button
              type="button"
              className="refresh-button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={refreshLabel}
              title={refreshLabel}
            >
              {isRefreshing ? "Refreshing..." : refreshLabel}
            </button>
          ) : null}

          <button
            className={`filter-button ${hasActiveFilters() ? "active" : ""}`}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <FilterIcon />
            {hasActiveFilters() && <span className="filter-badge">{Object.values(filters).flat().length}</span>}
          </button>

          {filterOpen && (
            <div className="filter-dropdown">
              <div className="filter-header">
                <h4>Filter Products</h4>
                {hasActiveFilters() && (
                  <button className="clear-filters" onClick={clearFilters}>
                    Clear All
                  </button>
                )}
              </div>

              {categories && categories.length > 0 && (
                <div className="filter-section">
                  <h5>Category</h5>
                  <div className="filter-options">
                    {categories.map((category) => (
                      <label key={category} className="filter-option">
                        <input
                          type="checkbox"
                          checked={filters.category?.includes(category) || false}
                          onChange={() => handleFilterToggle('category', category)}
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="filter-section">
                <h5>Price Range</h5>
                <div className="filter-options">
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={filters.priceRange?.includes('0-1000') || false}
                      onChange={() => handleFilterToggle('priceRange', '0-1000')}
                    />
                    <span>₦0 - ₦1,000</span>
                  </label>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={filters.priceRange?.includes('1000-5000') || false}
                      onChange={() => handleFilterToggle('priceRange', '1000-5000')}
                    />
                    <span>₦1,000 - ₦5,000</span>
                  </label>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={filters.priceRange?.includes('5000-10000') || false}
                      onChange={() => handleFilterToggle('priceRange', '5000-10000')}
                    />
                    <span>₦5,000 - ₦10,000</span>
                  </label>
                  <label className="filter-option">
                    <input
                      type="checkbox"
                      checked={filters.priceRange?.includes('10000+') || false}
                      onChange={() => handleFilterToggle('priceRange', '10000+')}
                    />
                    <span>Above ₦10,000</span>
                  </label>
                </div>
              </div>

              {warehouses && warehouses.length > 0 && (
                <div className="filter-section">
                  <h5>Warehouse</h5>
                  <div className="filter-options">
                    {warehouses.map((warehouse) => (
                      <label key={warehouse} className="filter-option">
                        <input
                          type="checkbox"
                          checked={filters.warehouse?.includes(warehouse) || false}
                          onChange={() => handleFilterToggle('warehouse', warehouse)}
                        />
                        <span>{warehouse}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {deliveryStatuses && deliveryStatuses.length > 0 && (
                <div className="filter-section">
                  <h5>Delivery Status</h5>
                  <div className="filter-options">
                    {deliveryStatuses.map((status) => (
                      <label key={status} className="filter-option">
                        <input
                          type="checkbox"
                          checked={filters.deliveryStatus?.includes(status) || false}
                          onChange={() => handleFilterToggle('deliveryStatus', status)}
                        />
                        <span style={{ textTransform: 'capitalize' }}>
                          {status === 'picked-up' ? 'Picked Up' : status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {listStatuses && listStatuses.length > 0 && (
                <div className="filter-section">
                  <h5>Listing</h5>
                  <div className="filter-options">
                    {listStatuses.map((status) => (
                      <label key={status} className="filter-option">
                        <input
                          type="checkbox"
                          checked={filters.listStatus?.includes(status) || false}
                          onChange={() => handleFilterToggle('listStatus', status)}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
