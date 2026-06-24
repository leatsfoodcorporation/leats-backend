const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const { upload } = require("../../utils/web/uploadsS3");
const {
  getAllPageSEO,
  getPageSEOByPath,
  savePageSEO,
  deletePageSEO,
  generatePageSEO,
} = require("../../controllers/web/pageSEOController");

// Public routes (frontend website)
router.get("/", getAllPageSEO);
router.get("/page/:path", getPageSEOByPath);

// Dashboard routes - protected
router.post("/generate", authenticateToken, requirePermission('web_seo', 'edit'), generatePageSEO);
router.post("/", authenticateToken, requirePermission('web_seo', 'edit'), upload.single("ogImage"), savePageSEO);
router.delete("/:id", authenticateToken, requirePermission('web_seo', 'delete'), deletePageSEO);

module.exports = router;
