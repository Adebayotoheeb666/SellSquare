/**
 * History Tracking Utilities for Products and Product Groups
 */

const mongoose = require("mongoose");
const Product = require("../models/productModel");
const ProductGroup = require("../models/productGroupModel");
const CheckOut = require("../models/checkOutSalesModel");

/**
 * Add a history entry to a product
 * @param {Object} product - The product document
 * @param {string} type - Type of entry: 'stock-in', 'sale', or 'adjustment'
 * @param {number} quantityChange - The quantity change (positive or negative)
 * @param {string} performedBy - User or system identifier
 * @param {string} note - Additional notes
 * @returns {Object} History entry object
 */
const addHistoryEntry = (
  product,
  type,
  quantityChange,
  performedBy,
  note = ""
) => {
  const balance = product.quantity;

  const historyEntry = {
    date: new Date(),
    type,
    quantityChange,
    balance,
    performedBy,
    note,
  };

  if (!product.history) {
    product.history = [];
  }

  product.history.push(historyEntry);
  return historyEntry;
};

/**
 * Add a history entry to a product group
 * @param {Object} productGroup - The product group document
 * @param {string} type - Type of entry: 'stock-in', 'sale', or 'adjustment'
 * @param {string} itemName - Name of the item in format 'Item Name - SKU' or similar
 * @param {number} quantityChange - The quantity change
 * @param {number} balance - Current balance after change
 * @param {string} performedBy - User or system identifier
 * @param {string} note - Additional notes
 * @returns {Object} History entry object
 */
const addGroupHistoryEntry = (
  productGroup,
  type,
  itemName,
  quantityChange,
  balance,
  performedBy,
  note = ""
) => {
  const historyEntry = {
    date: new Date(),
    type,
    itemName,
    quantityChange,
    balance,
    performedBy,
    note,
  };

  if (!productGroup.history) {
    productGroup.history = [];
  }

  productGroup.history.push(historyEntry);
  return historyEntry;
};

/**
 * Calculate totalSold and totalRevenue for a single product from checkouts
 * @param {string} productId - The product ID
 * @returns {Promise<{totalSold: number, totalRevenue: number}>}
 */
const calculateProductSalesMetrics = async (productId) => {
  try {
    const product = await Product.findById(productId);

    if (!product || !product.history) {
      return {
        totalSold: 0,
        totalRevenue: 0,
      };
    }

    // Calculate totalSold from history entries with type "sale"
    const totalSold = product.history
      .filter((entry) => entry.type === "sale")
      .reduce((sum, entry) => sum + Math.abs(entry.quantityChange), 0);

    // Calculate totalRevenue from history entries with type "sale"
    // Uses the stored selling price (amount) from when the sale occurred
    const totalRevenue = product.history
      .filter((entry) => entry.type === "sale")
      .reduce(
        (sum, entry) =>
          sum + Math.abs(entry.quantityChange) * (entry.amount || 0),
        0
      );

    return {
      totalSold,
      totalRevenue,
    };
  } catch (error) {
    console.error("Error calculating product sales metrics:", error);
    return {
      totalSold: 0,
      totalRevenue: 0,
    };
  }
};

/**
 * Calculate totalSold and totalRevenue for a product group from checkouts
 * @param {string} productGroupId - The product group ID
 * @returns {Promise<{totalSold: number, totalRevenue: number}>}
 */
const calculateGroupSalesMetrics = async (productGroupId) => {
  try {
    const productGroup = await ProductGroup.findById(productGroupId);

    if (!productGroup || !productGroup.history) {
      return {
        totalSold: 0,
        totalRevenue: 0,
      };
    }

    // Calculate totalSold from history entries with type "sale"
    const totalSold = productGroup.history
      .filter((entry) => entry.type === "sale")
      .reduce((sum, entry) => sum + Math.abs(entry.quantityChange), 0);

    // Calculate totalRevenue from history entries with type "sale"
    // Uses the stored selling price (amount) from when the sale occurred
    const totalRevenue = productGroup.history
      .filter((entry) => entry.type === "sale")
      .reduce(
        (sum, entry) =>
          sum + Math.abs(entry.quantityChange) * (entry.amount || 0),
        0
      );

    return {
      totalSold,
      totalRevenue,
    };
  } catch (error) {
    console.error("Error calculating group sales metrics:", error);
    return {
      totalSold: 0,
      totalRevenue: 0,
    };
  }
};

/**
 * Update totalSold and totalRevenue for a product
 * @param {string} productId - The product ID
 */
const updateProductSalesMetrics = async (productId) => {
  try {
    const metrics = await calculateProductSalesMetrics(productId);
    await Product.findByIdAndUpdate(
      productId,
      {
        totalSold: metrics.totalSold,
        totalRevenue: metrics.totalRevenue,
      },
      { new: true }
    );
  } catch (error) {
    console.error("Error updating product sales metrics:", error);
  }
};

/**
 * Update totalSold and totalRevenue for a product group
 * @param {string} productGroupId - The product group ID
 */
const updateGroupSalesMetrics = async (productGroupId) => {
  try {
    const metrics = await calculateGroupSalesMetrics(productGroupId);
    await ProductGroup.findByIdAndUpdate(
      productGroupId,
      {
        totalSold: metrics.totalSold,
        totalRevenue: metrics.totalRevenue,
      },
      { new: true }
    );
  } catch (error) {
    console.error("Error updating group sales metrics:", error);
  }
};

/**
 * Initialize history and totalStocked for new products
 * @param {Object} product - The product document
 * @returns {Object} Updated product
 */
const initializeProductHistory = (product) => {
  product.history = [];
  product.totalStocked = 0;
  product.totalSold = 0;
  product.totalRevenue = 0;
  return product;
};

/**
 * Initialize history and totalStocked for new product groups
 * @param {Object} productGroup - The product group document
 * @returns {Object} Updated product group
 */
const initializeGroupHistory = (productGroup) => {
  productGroup.history = [];
  productGroup.totalStocked = 0;
  productGroup.totalSold = 0;
  productGroup.totalRevenue = 0;
  return productGroup;
};

module.exports = {
  addHistoryEntry,
  addGroupHistoryEntry,
  calculateProductSalesMetrics,
  calculateGroupSalesMetrics,
  updateProductSalesMetrics,
  updateGroupSalesMetrics,
  initializeProductHistory,
  initializeGroupHistory,
};
