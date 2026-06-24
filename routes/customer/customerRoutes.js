const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllCustomers,
  getCustomerById,
  searchCustomers,
  getCustomerStats,
  getCustomerOrders,
  getCustomerAnalytics,
  getCustomerOnlineOrders,
  createCustomer,
} = require("../../controllers/customer/customerController");

// Customer routes
router.get("/customers/stats", authenticateToken, requirePermission('customers', 'view'), getCustomerStats);
router.get("/customers/search", authenticateToken, requirePermission('customers', 'view'), searchCustomers);
router.get("/customers/:id", authenticateToken, requirePermission('customers', 'view'), getCustomerById);
router.get("/customers/:id/orders", authenticateToken, requirePermission('customers', 'view'), getCustomerOrders);
router.get("/customers/:id/analytics", authenticateToken, requirePermission('customers', 'view'), getCustomerAnalytics);
router.get("/customers", authenticateToken, requirePermission('customers', 'view'), getAllCustomers);
router.post("/customers", authenticateToken, requirePermission('customers', 'view'), createCustomer); // Create customer

// Online orders for customer
router.get("/online-orders/customer/:customerId", authenticateToken, requirePermission('customers', 'view'), getCustomerOnlineOrders);

module.exports = router;
