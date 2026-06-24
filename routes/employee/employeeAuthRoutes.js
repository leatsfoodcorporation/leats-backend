const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../../middleware/auth");
const {
  verifyEmployeeEmail,
  changeEmployeePassword,
  requestPasswordReset,
  resetPassword,
  getEmployeeProfile,
} = require("../../controllers/employee/employeeAuthController");

// Public routes (no auth required)
router.post("/verify-email", verifyEmployeeEmail);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

// Protected routes (auth required)
router.get("/me", authenticateToken, getEmployeeProfile);
router.post("/change-password", authenticateToken, changeEmployeePassword);

module.exports = router;
