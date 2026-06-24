const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getOrderStats,
  downloadOrderInvoice,
} = require('../../controllers/order/adminOrderController');

// Get order statistics
router.get('/stats', authenticateToken, requirePermission('online_orders', 'view'), getOrderStats);

// Download order invoice PDF (must be before /:id route)
router.get('/:orderNumber/invoice/download', authenticateToken, requirePermission('online_orders', 'view'), downloadOrderInvoice);

// Get all orders with filters
router.get('/', authenticateToken, requirePermission('online_orders', 'view'), getAllOrders);

// Get single order by ID
router.get('/:id', authenticateToken, requirePermission('online_orders', 'view'), getOrderById);

// Update order status
router.patch('/:id/status', authenticateToken, requirePermission('online_orders', 'edit'), updateOrderStatus);

module.exports = router;
