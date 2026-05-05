const asyncHandler = require("express-async-handler");
const Expense = require("../models/expenseModel");
const logActivity = require("../middleWare/logActivityMiddleware");
const { ObjectId } = require("mongoose").Types;

// Add Expense
const addExpense = asyncHandler(async (req, res) => {
  try {
    const { amount, description, category, date } = req.body;
    const businessId = req.business.id;

    // Validation
    if (!amount || !description) {
      res.status(400);
      throw new Error("Please fill in all required fields");
    }

    if (amount <= 0) {
      res.status(400);
      throw new Error("Amount must be greater than 0");
    }

    // Create expense
    const expense = await Expense.create({
      business: businessId,
      amount: parseFloat(amount),
      description,
      category: category || "General",
      date: date || Date.now(),
    });

    // Log activity
    logActivity(`Added expense: ${description} - ₦${amount}`)(req, res);

    res.status(201).json(expense);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Get All Expenses for a Business
const getExpenses = asyncHandler(async (req, res) => {
  try {
    const businessId = req.business.id;
    const { page = 1, limit = 20, startDate, endDate, category } = req.query;

    // Build filter
    const filter = { business: businessId };

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate);
      }
    }

    // Category filter
    if (category && category !== "All") {
      filter.category = category;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get expenses with pagination
    const expenses = await Expense.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await Expense.countDocuments(filter);

    // Calculate total amount for filtered expenses
    const aggregationFilter = { ...filter };
    if (aggregationFilter.business) {
      aggregationFilter.business = new ObjectId(aggregationFilter.business);
    }

    const totalAmount = await Expense.aggregate([
      { $match: aggregationFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.status(200).json({
      expenses,
      total,
      totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Get Single Expense
const getExpense = asyncHandler(async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const expense = await Expense.findOne({
      _id: id,
      business: businessId,
    });

    if (!expense) {
      res.status(404);
      throw new Error("Expense not found");
    }

    res.status(200).json(expense);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Update Expense
const updateExpense = asyncHandler(async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;
    const { amount, description, category, date } = req.body;

    const expense = await Expense.findOne({
      _id: id,
      business: businessId,
    });

    if (!expense) {
      res.status(404);
      throw new Error("Expense not found");
    }

    // Update fields
    if (amount !== undefined) expense.amount = parseFloat(amount);
    if (description !== undefined) expense.description = description;
    if (category !== undefined) expense.category = category;
    if (date !== undefined) expense.date = date;

    const updatedExpense = await expense.save();

    // Log activity
    logActivity(`Updated expense: ${updatedExpense.description}`)(req, res);

    res.status(200).json(updatedExpense);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Delete Expense
const deleteExpense = asyncHandler(async (req, res) => {
  try {
    const businessId = req.business.id;
    const { id } = req.params;

    const expense = await Expense.findOne({
      _id: id,
      business: businessId,
    });

    if (!expense) {
      res.status(404);
      throw new Error("Expense not found");
    }

    await expense.deleteOne();

    // Log activity
    logActivity(`Deleted expense: ${expense.description} - ₦${expense.amount}`)(req, res);

    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Get Expense Statistics
const getExpenseStats = asyncHandler(async (req, res) => {
  try {
    const businessId = req.business.id;
    const { startDate, endDate } = req.query;

    // Build filter
    const filter = { business: businessId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.date.$lte = new Date(endDate);
      }
    }

    // Get total expenses
    const totalExpenses = await Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Get expenses by category
    const expensesByCategory = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.status(200).json({
      totalExpenses: totalExpenses.length > 0 ? totalExpenses[0].total : 0,
      expenseCount: totalExpenses.length > 0 ? totalExpenses[0].count : 0,
      byCategory: expensesByCategory,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

module.exports = {
  addExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
};
