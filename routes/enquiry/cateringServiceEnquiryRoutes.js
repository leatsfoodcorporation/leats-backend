const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  createCateringServiceEnquiry,
  getAllCateringServiceEnquiries,
  getCateringServiceEnquiryById,
  updateCateringServiceEnquiryStatus,
  deleteCateringServiceEnquiry,
} = require("../../controllers/enquiry/cateringServiceEnquiryController");

// Public route - customer submits enquiry
router.post("/", createCateringServiceEnquiry);

// Dashboard routes - protected
router.get("/", authenticateToken, requirePermission('catering_enquiries', 'view'), getAllCateringServiceEnquiries);
router.get("/:id", authenticateToken, requirePermission('catering_enquiries', 'view'), getCateringServiceEnquiryById);
router.patch("/:id", authenticateToken, requirePermission('catering_enquiries', 'edit'), updateCateringServiceEnquiryStatus);
router.delete("/:id", authenticateToken, requirePermission('catering_enquiries', 'delete'), deleteCateringServiceEnquiry);

module.exports = router;
