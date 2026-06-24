const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  getNextPONumber,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderStats,
} = require("../../controllers/purchase/purchaseOrderController");

// Get all purchase orders
router.get("/", authenticateToken, requirePermission('purchase_orders', 'view'), getAllPurchaseOrders);

// Get purchase order statistics
router.get("/stats", authenticateToken, requirePermission('purchase_orders', 'view'), getPurchaseOrderStats);

// Get next PO number
router.get("/next-number", authenticateToken, requirePermission('purchase_orders', 'view'), getNextPONumber);

// Get purchase order by ID
router.get("/:id", authenticateToken, requirePermission('purchase_orders', 'view'), getPurchaseOrderById);

// Create purchase order
router.post("/", authenticateToken, requirePermission('purchase_orders', 'add'), createPurchaseOrder);

// Update purchase order
router.put("/:id", authenticateToken, requirePermission('purchase_orders', 'edit'), updatePurchaseOrder);

// Delete purchase order (disabled)
router.delete("/:id", authenticateToken, requirePermission('purchase_orders', 'delete'), deletePurchaseOrder);

module.exports = router;
