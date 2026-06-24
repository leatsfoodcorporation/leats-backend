const express = require("express");
const {
  getDailyMovementReport,
  getEODClosingStockReport,
  getPeriodAnalytics,
  getInventoryValuationReport,
  getStockAvailabilityReport,
  getInventoryMovementReport,
  getExpiryWastageReport,
  getTopSellingReport,
} = require("../../controllers/inventory/inventoryReportController");

const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();

// GET /api/inventory/reports/daily-movement
router.get("/daily-movement", authenticateToken, requirePermission('inventory_reports', 'view'), getDailyMovementReport);

// GET /api/inventory/reports/eod-closing-stock
router.get("/eod-closing-stock", authenticateToken, requirePermission('inventory_reports', 'view'), getEODClosingStockReport);

// GET /api/inventory/reports/period-analytics
router.get("/period-analytics", authenticateToken, requirePermission('inventory_reports', 'view'), getPeriodAnalytics);

// GET /api/inventory/reports/valuation
router.get("/valuation", authenticateToken, requirePermission('inventory_reports', 'view'), getInventoryValuationReport);

// GET /api/inventory/reports/stock-availability
router.get("/stock-availability", authenticateToken, requirePermission('inventory_reports', 'view'), getStockAvailabilityReport);

// GET /api/inventory/reports/inventory-movement
router.get("/inventory-movement", authenticateToken, requirePermission('inventory_reports', 'view'), getInventoryMovementReport);

// GET /api/inventory/reports/expiry-wastage
router.get("/expiry-wastage", authenticateToken, requirePermission('inventory_reports', 'view'), getExpiryWastageReport);

// GET /api/inventory/reports/top-selling
router.get("/top-selling", authenticateToken, requirePermission('inventory_reports', 'view'), getTopSellingReport);

module.exports = router;
