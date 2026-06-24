const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();
const {
  getInvoiceSettings,
  updateInvoiceSettings,
  generateInvoiceNumber,
} = require("../../controllers/finance/invoiceSettingsController");

// Invoice settings routes
router.get("/", authenticateToken, requireDashboardAccess, getInvoiceSettings); // Lookup — needed by purchase, bills for invoice number
router.put("/", authenticateToken, requirePermission('settings_invoice', 'edit'), updateInvoiceSettings);
router.post("/generate-number", authenticateToken, requirePermission('settings_invoice', 'edit'), generateInvoiceNumber);

module.exports = router;
