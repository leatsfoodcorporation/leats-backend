const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../../controllers/inventory/categoryController");

// Category routes — GET uses dashboardAccess (lookup data for purchase, products, etc.)
router.get("/", authenticateToken, requireDashboardAccess, getAllCategories);
router.get("/:id", authenticateToken, requireDashboardAccess, getCategoryById);
router.post("/", authenticateToken, requirePermission('warehouse', 'add'), createCategory);
router.put("/:id", authenticateToken, requirePermission('warehouse', 'edit'), updateCategory);
router.delete("/:id", authenticateToken, requirePermission('warehouse', 'delete'), deleteCategory);

module.exports = router;
