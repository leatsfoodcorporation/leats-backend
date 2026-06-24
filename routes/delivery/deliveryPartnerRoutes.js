const express = require("express");
const router = express.Router();
const {
  createDeliveryPartner,
  getAllDeliveryPartners,
  getDeliveryPartnerById,
  updateDeliveryPartner,
  updateStatus,
  updateApplicationStatus,
  updatePartnerStatus,
  getApprovedPartners,
  getStatusHistory,
} = require("../../controllers/delivery/deliveryPartnerController");
const {
  getAllPartnersReports,
} = require("../../controllers/partner/partnerReportsController");
const {
  validateDeliveryPartner,
  validateUpdateDeliveryPartner,
  validateObjectId,
} = require("../../middleware/delivery/validation");
const { uploadDocument } = require("../../utils/delivery/uploadS3");
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission, requireDashboardAccess } = require("../../middleware/permission");

// Get approved partners — lookup data (needed by order assignment)
router.get("/approved", authenticateToken, requireDashboardAccess, getApprovedPartners);

// Get all partners reports (admin view)
router.get("/reports", authenticateToken, requirePermission('partner_applications', 'view'), getAllPartnersReports);

// Get all delivery partners
router.get("/", authenticateToken, requirePermission('partner_applications', 'view'), getAllDeliveryPartners);

// Get delivery partner by ID
router.get("/:id", authenticateToken, requirePermission('partner_applications', 'view'), validateObjectId, getDeliveryPartnerById);

// Get status history
router.get("/:id/status-history", authenticateToken, requirePermission('partner_applications', 'view'), validateObjectId, getStatusHistory);

// Public partner registration (no auth required)
router.post("/register", uploadDocument.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'aadharDocument', maxCount: 1 },
  { name: 'licenseDocument', maxCount: 1 },
  { name: 'vehicleRCDocument', maxCount: 1 },
  { name: 'insuranceDocument', maxCount: 1 },
  { name: 'pollutionCertDocument', maxCount: 1 },
  { name: 'idProofDocument', maxCount: 1 }
]), validateDeliveryPartner, createDeliveryPartner);

// Create new delivery partner with file uploads (admin only)
router.post("/", authenticateToken, requirePermission('partner_applications', 'add'), uploadDocument.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'aadharDocument', maxCount: 1 },
  { name: 'licenseDocument', maxCount: 1 },
  { name: 'vehicleRCDocument', maxCount: 1 },
  { name: 'insuranceDocument', maxCount: 1 },
  { name: 'pollutionCertDocument', maxCount: 1 },
  { name: 'idProofDocument', maxCount: 1 }
]), validateDeliveryPartner, createDeliveryPartner);

// Update delivery partner with file uploads
router.put(
  "/:id", authenticateToken, requirePermission('partner_applications', 'edit'), validateObjectId,
  uploadDocument.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'aadharDocument', maxCount: 1 },
    { name: 'licenseDocument', maxCount: 1 },
    { name: 'vehicleRCDocument', maxCount: 1 },
    { name: 'insuranceDocument', maxCount: 1 },
    { name: 'pollutionCertDocument', maxCount: 1 },
    { name: 'idProofDocument', maxCount: 1 }
  ]),
  validateUpdateDeliveryPartner,
  updateDeliveryPartner
);

// Update application status (pending -> verified -> approved/rejected)
router.put(
  "/:id/application-status", authenticateToken, requirePermission('partner_applications', 'edit'), validateObjectId,
  updateApplicationStatus
);

// Update partner status (active/inactive/suspended) - Only for approved partners
router.put("/:id/partner-status", authenticateToken, requirePermission('partner_applications', 'edit'), validateObjectId, updatePartnerStatus);

// Update status (legacy - keeping for backward compatibility)
router.put("/:id/status", authenticateToken, requirePermission('partner_applications', 'edit'), validateObjectId, updateStatus);

module.exports = router;
