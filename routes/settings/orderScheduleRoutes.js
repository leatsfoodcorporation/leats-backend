const express = require("express");
const router = express.Router();
const {
  getOrderSchedule,
  updateOrderSchedule,
  getPublicOrderSchedule,
} = require("../../controllers/settings/orderScheduleController");
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");

// Public route — no auth needed (used by frontend/mobile)
router.get("/active", getPublicOrderSchedule);

// Admin routes — auth required
router.get("/", authenticateToken, requirePermission('settings_schedule', 'view'), getOrderSchedule);
router.put("/", authenticateToken, requirePermission('settings_schedule', 'edit'), updateOrderSchedule);

module.exports = router;
