const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllExpenseCategories,
  getExpenseCategoryById,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  getExpenseCategoryNames,
} = require("../../controllers/purchase/expenseCategoryController");

// Get all expense categories — lookup data for expense form
router.get("/", authenticateToken, requireDashboardAccess, getAllExpenseCategories);

// Get expense category names (for dropdowns)
router.get("/names", authenticateToken, requireDashboardAccess, getExpenseCategoryNames);

// Get expense category by ID
router.get("/:id", authenticateToken, requireDashboardAccess, getExpenseCategoryById);

// Create expense category
router.post("/", authenticateToken, requirePermission('expenses', 'add'), createExpenseCategory);

// Update expense category
router.put("/:id", authenticateToken, requirePermission('expenses', 'edit'), updateExpenseCategory);

// Delete expense category
router.delete("/:id", authenticateToken, requirePermission('expenses', 'delete'), deleteExpenseCategory);

module.exports = router;
