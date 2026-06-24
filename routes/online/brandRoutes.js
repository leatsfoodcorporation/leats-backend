const express = require('express');
const {
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} = require('../../controllers/online/brandController');

const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();

// Public GET (frontend product filter needs brands)
router.get('/', getAllBrands);
router.post('/', authenticateToken, requirePermission('online_products', 'add'), createBrand);
router.put('/:id', authenticateToken, requirePermission('online_products', 'edit'), updateBrand);
router.delete('/:id', authenticateToken, requirePermission('online_products', 'delete'), deleteBrand);

module.exports = router;
