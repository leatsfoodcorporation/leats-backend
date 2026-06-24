const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require("../../controllers/purchase/supplierController");
const { upload } = require("../../utils/purchase/uploadsS3");

// Get all suppliers — dashboardAccess (lookup data for purchase orders, bills, etc.)
router.get("/", authenticateToken, requireDashboardAccess, getAllSuppliers);

// Get supplier by ID
router.get("/:id", authenticateToken, requireDashboardAccess, getSupplierById);

// Create supplier (with file upload)
router.post("/", authenticateToken, requirePermission('suppliers', 'add'), upload.single("attachment"), createSupplier);

// Update supplier (with file upload)
router.put("/:id", authenticateToken, requirePermission('suppliers', 'edit'), upload.single("attachment"), updateSupplier);

// Delete supplier
router.delete("/:id", authenticateToken, requirePermission('suppliers', 'delete'), deleteSupplier);

module.exports = router;
