const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  getDeliveryCharge,
  createDeliveryCharge,
  updateDeliveryCharge,
  deleteDeliveryCharge,
  getActiveDeliveryCharge,
} = require("../../controllers/settings/deliveryChargeController");

// Public route - for cart/checkout
router.get("/active", getActiveDeliveryCharge);

// Dashboard routes - protected
router.get("/", authenticateToken, requirePermission('settings_charge', 'view'), getDeliveryCharge);
router.post("/", authenticateToken, requirePermission('settings_charge', 'add'), createDeliveryCharge);
router.put("/:id", authenticateToken, requirePermission('settings_charge', 'edit'), updateDeliveryCharge);
router.delete("/:id", authenticateToken, requirePermission('settings_charge', 'delete'), deleteDeliveryCharge);

module.exports = router;
