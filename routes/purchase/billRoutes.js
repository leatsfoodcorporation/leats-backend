const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllBills,
  getBillById,
  getNextGRNNumber,
  createBill,
  updateBill,
  updatePaymentStatus,
  getBillStats,
  getBillsBySupplier,
  getBillsByWarehouse,
  getBillsByPurchaseOrder,
} = require("../../controllers/purchase/billController");
const { upload } = require("../../utils/purchase/uploadsS3");

// Get all bills
router.get("/", authenticateToken, requirePermission('bills', 'view'), getAllBills);

// Get bill statistics
router.get("/stats", authenticateToken, requirePermission('bills', 'view'), getBillStats);

// Get next GRN number
router.get("/next-grn-number", authenticateToken, requirePermission('bills', 'view'), getNextGRNNumber);

// Get bills by supplier
router.get("/supplier/:supplierId", authenticateToken, requirePermission('bills', 'view'), getBillsBySupplier);

// Get bills by warehouse
router.get("/warehouse/:warehouseId", authenticateToken, requirePermission('bills', 'view'), getBillsByWarehouse);

// Get bills by purchase order
router.get("/purchase-order/:poId", authenticateToken, requirePermission('bills', 'view'), getBillsByPurchaseOrder);

// Get bill by ID
router.get("/:id", authenticateToken, requirePermission('bills', 'view'), getBillById);

// Create bill (with invoice copy upload)
router.post("/", authenticateToken, requirePermission('bills', 'add'), upload.single("invoiceCopy"), createBill);

// Update bill (with invoice copy upload)
router.put("/:id", authenticateToken, requirePermission('bills', 'edit'), upload.single("invoiceCopy"), updateBill);

// Update payment status
router.patch("/:id/payment-status", authenticateToken, requirePermission('bills', 'edit'), updatePaymentStatus);

module.exports = router;
