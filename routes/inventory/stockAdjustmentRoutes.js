const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllStockAdjustments,
  getStockAdjustmentById,
  createStockAdjustment,
  getItemAdjustmentHistory,
  getAdjustmentSummary,
} = require("../../controllers/inventory/stockAdjustmentController");

// Stock adjustment routes
router.get("/", authenticateToken, requirePermission('stock_adjustment', 'view'), getAllStockAdjustments);
router.get("/summary", authenticateToken, requirePermission('stock_adjustment', 'view'), getAdjustmentSummary);
router.get("/:id", authenticateToken, requirePermission('stock_adjustment', 'view'), getStockAdjustmentById);
router.get("/item/:itemId/history", authenticateToken, requirePermission('stock_adjustment', 'view'), getItemAdjustmentHistory);
router.post("/", authenticateToken, requirePermission('stock_adjustment', 'add'), createStockAdjustment);

module.exports = router;
