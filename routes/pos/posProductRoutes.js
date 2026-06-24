const express = require('express');
const {
  getAllPOSProducts,
  getPOSProductById,
  createPOSProduct,
  updatePOSProduct,
  togglePOSProductDisplay,
  syncPOSProductFromItem,
  deletePOSProduct,
} = require('../../controllers/pos/posProductController');
const { upload } = require('../../utils/pos/uploadS3');

const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();

// Get all POS products
router.get('/', authenticateToken, requirePermission('pos_products', 'view'), getAllPOSProducts);

// Get POS product by ID
router.get('/:id', authenticateToken, requirePermission('pos_products', 'view'), getPOSProductById);

// Create POS product from inventory item
router.post('/', authenticateToken, requirePermission('pos_products', 'add'), createPOSProduct);

// Update POS product (with optional image upload)
router.put('/:id', authenticateToken, requirePermission('pos_products', 'edit'), upload.single('itemImage'), updatePOSProduct);

// Toggle POS product display status
router.patch('/:id/display', authenticateToken, requirePermission('pos_products', 'edit'), togglePOSProductDisplay);

// Sync POS product from inventory item
router.post('/:id/sync', authenticateToken, requirePermission('pos_products', 'add'), syncPOSProductFromItem);

// Delete POS product
router.delete('/:id', authenticateToken, requirePermission('pos_products', 'delete'), deletePOSProduct);

module.exports = router;
