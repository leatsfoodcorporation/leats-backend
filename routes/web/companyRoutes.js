const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  getCompanySettings,
  saveCompanySettings,
} = require("../../controllers/web/companySettingsController");

// Public route (frontend website)
router.get("/", getCompanySettings);

// Dashboard route - protected
router.post("/", authenticateToken, requirePermission('web_company', 'edit'), saveCompanySettings);

module.exports = router;
