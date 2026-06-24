const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const { upload } = require("../../utils/web/uploadsS3");
const {
  getBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
} = require("../../controllers/web/bannerController");

// Public routes (frontend website)
router.get("/", getBanners);
router.get("/:id", getBanner);

// Dashboard routes - protected
router.post("/", authenticateToken, requirePermission('web_banner', 'add'), upload.single("image"), createBanner);
router.put("/:id", authenticateToken, requirePermission('web_banner', 'edit'), upload.single("image"), updateBanner);
router.delete("/:id", authenticateToken, requirePermission('web_banner', 'delete'), deleteBanner);

module.exports = router;
