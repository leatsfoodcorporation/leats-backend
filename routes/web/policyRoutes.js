const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  getAllPolicies,
  getPolicyByType,
  getPublishedPolicyBySlug,
  savePolicy,
  deletePolicy,
  togglePublishPolicy,
} = require("../../controllers/web/policyController");

// Public routes (frontend website)
router.get("/", getAllPolicies);
router.get("/type/:type", getPolicyByType);
router.get("/public/:slug", getPublishedPolicyBySlug);

// Dashboard routes - protected
router.post("/", authenticateToken, requirePermission('web_policies', 'edit'), savePolicy);
router.patch("/:id/publish", authenticateToken, requirePermission('web_policies', 'edit'), togglePublishPolicy);
router.delete("/:id", authenticateToken, requirePermission('web_policies', 'delete'), deletePolicy);

module.exports = router;
