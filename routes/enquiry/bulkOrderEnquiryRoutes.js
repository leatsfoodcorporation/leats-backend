const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  createBulkOrderEnquiry,
  getAllBulkOrderEnquiries,
  getBulkOrderEnquiryById,
  updateBulkOrderEnquiryStatus,
  deleteBulkOrderEnquiry,
} = require("../../controllers/enquiry/bulkOrderEnquiryController");

// Public route - customer submits enquiry
router.post("/", createBulkOrderEnquiry);

// Dashboard routes - protected
router.get("/", authenticateToken, requirePermission('bulk_enquiries', 'view'), getAllBulkOrderEnquiries);
router.get("/:id", authenticateToken, requirePermission('bulk_enquiries', 'view'), getBulkOrderEnquiryById);
router.patch("/:id", authenticateToken, requirePermission('bulk_enquiries', 'edit'), updateBulkOrderEnquiryStatus);
router.delete("/:id", authenticateToken, requirePermission('bulk_enquiries', 'delete'), deleteBulkOrderEnquiry);

module.exports = router;
