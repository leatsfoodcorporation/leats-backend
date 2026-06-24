const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getSalesSummaryReport,
  getPosSalesReport,
  getOnlineSalesReport,
} = require("../../controllers/finance/salesReportController");

// Sales report routes
router.get("/sales-summary", authenticateToken, requirePermission('sales_reports', 'view'), getSalesSummaryReport);
router.get("/pos-sales", authenticateToken, requirePermission('sales_reports', 'view'), getPosSalesReport);
router.get("/online-sales", authenticateToken, requirePermission('sales_reports', 'view'), getOnlineSalesReport);

module.exports = router;
