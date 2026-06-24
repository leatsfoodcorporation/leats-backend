const express = require('express');
const {
  getAllBadges,
  getHomepageBadges,
  createBadge,
  updateBadge,
  resetStaticBadge,
  deleteBadge,
} = require('../../controllers/online/badgeController');

const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();

// Public GET routes (needed by homepage/frontend)
router.get('/', getAllBadges);
router.get('/homepage', getHomepageBadges);
router.post('/', authenticateToken, requirePermission('online_products', 'add'), createBadge);
router.put('/:id', authenticateToken, requirePermission('online_products', 'edit'), updateBadge);
router.post('/:id/reset', authenticateToken, requirePermission('online_products', 'add'), resetStaticBadge);
router.delete('/:id', authenticateToken, requirePermission('online_products', 'delete'), deleteBadge);

module.exports = router;
