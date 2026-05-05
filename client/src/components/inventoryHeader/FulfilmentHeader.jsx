import React from "react";
import InventoryHeader from "./InventoryHeader";

export default function FulfilmentHeader({
  search,
  handleSearchChange,
  filters = {},
  onFilterChange,
  categories = [],
  warehouses = [],
  label = "Fulfilments | Pending",
}) {
  return (
    <InventoryHeader
      label={label}
      search={search}
      handleSearchChange={handleSearchChange}
      filters={filters}
      onFilterChange={onFilterChange}
      categories={categories}
      warehouses={warehouses}
      placeholder="Search by order ID, customer name, or items..."
    />
  );
}
