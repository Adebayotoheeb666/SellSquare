const express = require("express");
const router = express.Router();
const protect = require("../middleWare/authMiddleware");
const { expenseEventMiddleware } = require("../events");
const {
  addExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
} = require("../controllers/expenseController");

// Add expense
router.post("/", protect, expenseEventMiddleware, addExpense);

// Get all expenses with pagination and filters
router.get("/", protect, getExpenses);

// Get expense statistics
router.get("/stats", protect, getExpenseStats);

// Get single expense
router.get("/:id", protect, getExpense);

// Update expense
router.patch("/:id", protect, expenseEventMiddleware, updateExpense);

// Delete expense
router.delete("/:id", protect, expenseEventMiddleware, deleteExpense);

module.exports = router;
