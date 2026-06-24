const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllSales,
  getSalesSummary,
  getSalesByFinancialYear,
  getOrderDetails,
} = require("../../controllers/finance/salesController");

// Sales routes
router.get("/", authenticateToken, requirePermission('online_sales', 'view'), getAllSales);
router.get("/summary", authenticateToken, requirePermission('online_sales', 'view'), getSalesSummary);
router.get("/by-year", authenticateToken, requirePermission('online_sales', 'view'), getSalesByFinancialYear);
router.get("/:type/:id", authenticateToken, requirePermission('online_sales', 'view'), getOrderDetails);

module.exports = router;
