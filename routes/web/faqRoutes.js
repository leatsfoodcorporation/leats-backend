const express = require('express');
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const { getFaqs, getFaq, createFaq, updateFaq, deleteFaq, getActiveFaqs } = require('../../controllers/web/faqControllers');

// Public routes (frontend website)
router.get('/active', getActiveFaqs);
router.get('/', getFaqs);
router.get('/:id', getFaq);

// Dashboard routes - protected
router.post('/', authenticateToken, requirePermission('web_policies', 'add'), createFaq);
router.put('/:id', authenticateToken, requirePermission('web_policies', 'edit'), updateFaq);
router.delete('/:id', authenticateToken, requirePermission('web_policies', 'delete'), deleteFaq);

module.exports = router;
