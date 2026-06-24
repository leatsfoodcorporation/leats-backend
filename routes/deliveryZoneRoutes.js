const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const {
  createDeliveryZone,
  getAllDeliveryZones,
  updateDeliveryZone,
  deleteDeliveryZone,
  getAvailableCountries,
  checkPincode,
  discoverPincodesAI,
  detectLocation,
} = require('../controllers/deliveryZoneController');

// Public routes
router.get('/countries', getAvailableCountries);
router.get('/check/:pincode', checkPincode);
router.post('/detect-location', detectLocation);

// Protected routes
router.post('/', authenticateToken, requirePermission('settings_zones', 'add'), createDeliveryZone);
router.get('/', authenticateToken, requirePermission('settings_zones', 'view'), getAllDeliveryZones);
router.put('/:id', authenticateToken, requirePermission('settings_zones', 'edit'), updateDeliveryZone);
router.post('/discover-ai', authenticateToken, requirePermission('settings_zones', 'edit'), discoverPincodesAI);
router.delete('/:id', authenticateToken, requirePermission('settings_zones', 'delete'), deleteDeliveryZone);

module.exports = router;
