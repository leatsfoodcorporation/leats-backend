const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  getGateways,
  updateGateway,
  toggleGateway,
  getActiveGateways,
} = require("../../controllers/payment-gateway/paymentGatewayController");
const {
  handleRazorpayWebhook,
  handleStripeWebhook,
  verifyRazorpayPayment,
} = require("../../controllers/payment-gateway/webhookController");

// Public routes (for checkout & payment providers)
router.get("/active", getActiveGateways);
router.post("/verify", verifyRazorpayPayment);
router.post("/webhook/razorpay", handleRazorpayWebhook);
router.post("/webhook/stripe", handleStripeWebhook);

// Dashboard routes - protected
router.get("/", authenticateToken, requirePermission('settings_payment', 'view'), getGateways);
router.put("/:gatewayName", authenticateToken, requirePermission('settings_payment', 'edit'), updateGateway);
router.put("/:gatewayName/toggle", authenticateToken, requirePermission('settings_payment', 'edit'), toggleGateway);

module.exports = router;
