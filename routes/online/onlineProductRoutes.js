const express = require('express');
const { upload } = require('../../utils/online/uploadS3');
const {
  getAllOnlineProducts,
  getOnlineProductById,
  createOnlineProduct,
  updateOnlineProduct,
  deleteOnlineProduct,
  getFrequentlyBoughtTogether,
  syncProductStock,
  syncAllComboStock,
} = require('../../controllers/online/onlineProductController');

const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();

// Online Product CRUD routes (admin/employee only)
router.get('/', authenticateToken, requireDashboardAccess, getAllOnlineProducts);
router.get('/:id', authenticateToken, requireDashboardAccess, getOnlineProductById);
router.get('/:id/frequently-bought-together', authenticateToken, requireDashboardAccess, getFrequentlyBoughtTogether);
router.post('/', authenticateToken, requirePermission('online_products', 'add'), upload.any(), createOnlineProduct);
router.put('/:id', authenticateToken, requirePermission('online_products', 'edit'), upload.any(), updateOnlineProduct);
router.delete('/:id', authenticateToken, requirePermission('online_products', 'delete'), deleteOnlineProduct);

// Manual stock sync endpoint
router.post('/:id/sync-stock', authenticateToken, requirePermission('online_products', 'edit'), syncProductStock);

// Sync all combo products stock
router.post('/sync-all-combo-stock', authenticateToken, requirePermission('online_products', 'edit'), syncAllComboStock);

// SEO generation route
router.post('/generate-seo', authenticateToken, requirePermission('online_products', 'add'), require('../../controllers/online/onlineProductController').generateProductSEO);

module.exports = router;
