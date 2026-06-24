const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const posInvoiceController = require("../../controllers/pos/posInvoiceController");

// Generate invoice number
router.post("/generate-invoice-number", authenticateToken, requirePermission('pos_billing', 'add'), posInvoiceController.generatePOSInvoiceNumber);
router.get("/generate-invoice-number", authenticateToken, requirePermission('pos_orders', 'view'), posInvoiceController.generatePOSInvoiceNumber);

// Get invoice settings
router.get("/settings", authenticateToken, requirePermission('pos_orders', 'view'), posInvoiceController.getInvoiceSettings);

// Get invoice details by order number
router.get("/details/:orderNumber", authenticateToken, requirePermission('pos_orders', 'view'), posInvoiceController.getInvoiceDetails);

// Download invoice PDF
router.get("/download/:orderNumber", authenticateToken, requirePermission('pos_orders', 'view'), posInvoiceController.downloadInvoicePDF);

// Preview invoice PDF
router.get("/preview/:orderNumber", authenticateToken, requirePermission('pos_orders', 'view'), posInvoiceController.previewInvoicePDF);

module.exports = router;
