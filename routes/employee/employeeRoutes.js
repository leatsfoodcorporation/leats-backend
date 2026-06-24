const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticateToken } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/permission");
const {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmployeeStatus,
  assignRole,
  resendInvitation,
  deleteEmployee,
  checkEmail,
} = require("../../controllers/employee/employeeController");

// Multer config for document uploads (memory storage for S3)
const upload = multer({ storage: multer.memoryStorage() });
const uploadFields = upload.fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "aadharDocument", maxCount: 1 },
  { name: "panDocument", maxCount: 1 },
  { name: "idProofDocument", maxCount: 1 },
]);

router.get("/check-email", authenticateToken, requirePermission("employees", "add"), checkEmail);
router.get("/", authenticateToken, requirePermission("employees", "view"), getAllEmployees);
router.get("/:id", authenticateToken, requirePermission("employees", "view"), getEmployeeById);
router.post("/", authenticateToken, requirePermission("employees", "add"), uploadFields, createEmployee);
router.put("/:id", authenticateToken, requirePermission("employees", "edit"), uploadFields, updateEmployee);
router.put("/:id/status", authenticateToken, requirePermission("employees", "edit"), updateEmployeeStatus);
router.put("/:id/assign-role", authenticateToken, requirePermission("employees", "edit"), assignRole);
router.post("/:id/resend-invitation", authenticateToken, requirePermission("employees", "edit"), resendInvitation);
router.delete("/:id", authenticateToken, requirePermission("employees", "delete"), deleteEmployee);

module.exports = router;
