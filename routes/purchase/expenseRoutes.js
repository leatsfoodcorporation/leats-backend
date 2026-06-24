const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllExpenses,
  getExpenseById,
  getNextExpenseNumber,
  createExpense,
  updateExpense,
  getExpenseStats,
  getExpensesByCategory,
} = require("../../controllers/purchase/expenseController");
const { upload } = require("../../utils/purchase/uploadsS3");

// Get all expenses
router.get("/", authenticateToken, requirePermission('expenses', 'view'), getAllExpenses);

// Get expense statistics
router.get("/stats", authenticateToken, requirePermission('expenses', 'view'), getExpenseStats);

// Get next expense number
router.get("/next-number", authenticateToken, requirePermission('expenses', 'view'), getNextExpenseNumber);

// Get expenses by category
router.get("/category/:categoryId", authenticateToken, requirePermission('expenses', 'view'), getExpensesByCategory);

// Get expense by ID
router.get("/:id", authenticateToken, requirePermission('expenses', 'view'), getExpenseById);

// Create expense (with receipt upload)
router.post("/", authenticateToken, requirePermission('expenses', 'add'), upload.single("receipt"), createExpense);

// Update expense (with receipt upload)
router.put("/:id", authenticateToken, requirePermission('expenses', 'edit'), upload.single("receipt"), updateExpense);

module.exports = router;
