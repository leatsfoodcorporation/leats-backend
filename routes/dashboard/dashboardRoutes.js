const express = require('express');
const { getDashboardData } = require('../../controllers/dashboard/dashboardController');
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();

router.get('/', authenticateToken, requirePermission('dashboard', 'view'), getDashboardData);

module.exports = router;
