const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  generateBarcode,
  validateBarcodeEndpoint,
} = require('../../controllers/pos/posBarcodeController');

// Generate unique barcode for POS products
router.post('/generate', authenticateToken, requirePermission('pos_products', 'add'), generateBarcode);

// Validate barcode for POS products
router.post('/validate', authenticateToken, requirePermission('pos_products', 'add'), validateBarcodeEndpoint);

module.exports = router;
