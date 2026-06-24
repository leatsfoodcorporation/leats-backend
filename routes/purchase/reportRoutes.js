const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getPurchaseSummaryReport,
  exportPurchaseSummaryExcel,
  getBillsSummaryReport,
  exportBillsSummaryExcel,
  getExpensesSummaryReport,
  exportExpensesSummaryExcel,
} = require("../../controllers/purchase/reportController");

// Purchase Summary Report
router.get("/purchase-summary", authenticateToken, requirePermission('purchase_reports', 'view'), getPurchaseSummaryReport);
router.get("/purchase-summary/export", authenticateToken, requirePermission('purchase_reports', 'view'), exportPurchaseSummaryExcel);

// Bills Summary Report
router.get("/bills-summary", authenticateToken, requirePermission('purchase_reports', 'view'), getBillsSummaryReport);
router.get("/bills-summary/export", authenticateToken, requirePermission('purchase_reports', 'view'), exportBillsSummaryExcel);

// Expenses Summary Report
router.get("/expenses-summary", authenticateToken, requirePermission('purchase_reports', 'view'), getExpensesSummaryReport);
router.get("/expenses-summary/export", authenticateToken, requirePermission('purchase_reports', 'view'), exportExpensesSummaryExcel);

module.exports = router;
