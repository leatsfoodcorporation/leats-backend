const express = require('express');
const { 
    getEmail,
    postEmail,
    putEmail,
    testEmail
} = require("../../controllers/email/emailConfigController");

const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();

// GET /api/email/dashboard/settings/email-configuration
router.get('/', authenticateToken, requirePermission('settings_email', 'view'), getEmail);

// POST /api/email/dashboard/settings/email-configuration
router.post('/', authenticateToken, requirePermission('settings_email', 'edit'), postEmail);

// PUT /api/email/dashboard/settings/email-configuration/:id
router.put('/:id', authenticateToken, requirePermission('settings_email', 'edit'), putEmail);

// POST /api/email/dashboard/settings/email-configuration/test
router.post('/test', authenticateToken, requirePermission('settings_email', 'edit'), testEmail);

module.exports = router;
