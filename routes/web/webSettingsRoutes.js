const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const { upload } = require("../../utils/web/uploadsS3");
const {
  getWebSettings,
  uploadLogo,
  uploadFavicon,
  deleteLogo,
  deleteFavicon,
  proxyLogo,
  proxyFavicon,
} = require("../../controllers/web/webSettingsController");

// Public routes (frontend website)
router.get("/", getWebSettings);
router.get("/logo", proxyLogo);
router.get("/favicon", proxyFavicon);

// Dashboard routes - protected
router.post("/logo", authenticateToken, requirePermission('web_logo', 'edit'), upload.single("logo"), uploadLogo);
router.post("/favicon", authenticateToken, requirePermission('web_logo', 'edit'), upload.single("favicon"), uploadFavicon);
router.delete("/logo", authenticateToken, requirePermission('web_logo', 'edit'), deleteLogo);
router.delete("/favicon", authenticateToken, requirePermission('web_logo', 'edit'), deleteFavicon);

module.exports = router;
