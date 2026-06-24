const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} = require("../../controllers/employee/departmentController");

router.get("/", authenticateToken, requirePermission("departments", "view"), getAllDepartments);
router.get("/:id", authenticateToken, requirePermission("departments", "view"), getDepartmentById);
router.post("/", authenticateToken, requirePermission("departments", "add"), createDepartment);
router.put("/:id", authenticateToken, requirePermission("departments", "edit"), updateDepartment);
router.delete("/:id", authenticateToken, requirePermission("departments", "delete"), deleteDepartment);

module.exports = router;
