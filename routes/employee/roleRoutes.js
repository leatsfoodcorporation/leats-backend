const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  getPermissionModules,
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
} = require("../../controllers/employee/roleController");

router.get("/modules", authenticateToken, requirePermission("roles", "view"), getPermissionModules);
router.get("/", authenticateToken, requirePermission("roles", "view"), getAllRoles);
router.get("/:id", authenticateToken, requirePermission("roles", "view"), getRoleById);
router.post("/", authenticateToken, requirePermission("roles", "add"), createRole);
router.put("/:id", authenticateToken, requirePermission("roles", "edit"), updateRole);
router.delete("/:id", authenticateToken, requirePermission("roles", "delete"), deleteRole);

module.exports = router;
