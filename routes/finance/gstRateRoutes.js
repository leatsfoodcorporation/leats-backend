const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllGSTRates,
  getGSTRateById,
  createGSTRate,
  updateGSTRate,
  deleteGSTRate,
  toggleGSTRateStatus,
} = require("../../controllers/finance/gstRateController");

// GST rate routes — GET uses dashboardAccess (lookup data for purchase, POS, products, etc.)
router.get("/", authenticateToken, requireDashboardAccess, getAllGSTRates);
router.get("/:id", authenticateToken, requireDashboardAccess, getGSTRateById);
router.post("/", authenticateToken, requirePermission('settings_gst', 'add'), createGSTRate);
router.put("/:id", authenticateToken, requirePermission('settings_gst', 'edit'), updateGSTRate);
router.patch("/:id/status", authenticateToken, requirePermission('settings_gst', 'edit'), toggleGSTRateStatus);
router.delete("/:id", authenticateToken, requirePermission('settings_gst', 'delete'), deleteGSTRate);

module.exports = router;
