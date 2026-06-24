const express = require('express');
const {
  getAllCuttingStyles,
  getActiveCuttingStyles,
  getCuttingStyleById,
  createCuttingStyle,
  updateCuttingStyle,
  deleteCuttingStyle,
  toggleCuttingStyleStatus,
} = require('../../controllers/online/cuttingStyleController');

const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();

// Public GET routes (frontend product pages need cutting styles)
router.get('/', getAllCuttingStyles);
router.get('/active', getActiveCuttingStyles);
router.get('/:id', getCuttingStyleById);
router.post('/', authenticateToken, requirePermission('online_products', 'add'), createCuttingStyle);
router.put('/:id', authenticateToken, requirePermission('online_products', 'edit'), updateCuttingStyle);
router.put('/:id/toggle-status', authenticateToken, requirePermission('online_products', 'edit'), toggleCuttingStyleStatus);
router.delete('/:id', authenticateToken, requirePermission('online_products', 'delete'), deleteCuttingStyle);

module.exports = router;
