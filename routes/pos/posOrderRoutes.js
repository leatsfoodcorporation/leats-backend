const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();
const posOrderController = require("../../controllers/pos/posOrderController");

// Create POS order (POS billing action)
router.post("/", authenticateToken, requirePermission('pos_billing', 'add'), posOrderController.createPOSOrder);

// View POS orders (pos_orders permission — separate from pos_billing)
router.get("/", authenticateToken, requirePermission('pos_orders', 'view'), posOrderController.getPOSOrders);
router.get("/stats/summary", authenticateToken, requirePermission('pos_orders', 'view'), posOrderController.getPOSOrderStats);
router.get("/date-range", authenticateToken, requirePermission('pos_orders', 'view'), posOrderController.getPOSOrdersByDateRange);
router.get("/order-number/:orderNumber", authenticateToken, requirePermission('pos_orders', 'view'), posOrderController.getPOSOrderByOrderNumber);
router.get("/:id", authenticateToken, requirePermission('pos_orders', 'view'), posOrderController.getPOSOrderById);

// Customer lookup for POS checkout
router.get("/customers/search", authenticateToken, requireDashboardAccess, posOrderController.searchCustomers);
router.get("/customers/:id", authenticateToken, requireDashboardAccess, posOrderController.getCustomerById);

module.exports = router;
