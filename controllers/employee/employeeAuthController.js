const { prisma } = require("../../config/database");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendEmailWithEnv } = require("../../config/connectSMTP");

/**
 * Verify employee email
 * POST /api/auth/employee/verify-email
 */
const verifyEmployeeEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: "Verification token is required" });
    }

    const employee = await prisma.employee.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!employee) {
      return res.status(400).json({ success: false, error: "Invalid or expired verification token" });
    }

    if (employee.isEmailVerified) {
      return res.status(400).json({ success: false, error: "Email already verified" });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        status: "verified",
        statusHistory: {
          push: {
            from: employee.status,
            to: "verified",
            reason: "Email verified",
            changedAt: new Date().toISOString(),
          },
        },
      },
    });

    res.json({
      success: true,
      message: "Email verified successfully. You can now login.",
    });
  } catch (error) {
    console.error("Error verifying employee email:", error);
    res.status(500).json({ success: false, error: "Failed to verify email", message: error.message });
  }
};

/**
 * Change employee password (authenticated)
 * POST /api/auth/employee/change-password
 */
const changeEmployeePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: req.userId },
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, employee.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.employee.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, error: "Failed to change password", message: error.message });
  }
};

/**
 * Request password reset
 * POST /api/auth/employee/forgot-password
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const employee = await prisma.employee.findUnique({ where: { email: email.trim().toLowerCase() } });

    if (!employee) {
      // Don't reveal if email exists
      return res.json({ success: true, message: "If the email exists, a reset link has been sent" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.employee.update({
      where: { id: employee.id },
      data: { resetToken, resetTokenExpiry },
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&type=employee`;

    setImmediate(async () => {
      try {
        await sendEmailWithEnv({
          to: employee.email,
          subject: "Password Reset Request",
          html: `
            <h2>Password Reset</h2>
            <p>Hello ${employee.name},</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}" style="background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            <p style="color: #888; margin-top: 16px;">This link expires in 1 hour.</p>
          `,
        });
      } catch (e) {
        console.error("Failed to send reset email:", e.message);
      }
    });

    res.json({ success: true, message: "If the email exists, a reset link has been sent" });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    res.status(500).json({ success: false, error: "Failed to process request", message: error.message });
  }
};

/**
 * Reset password with token
 * POST /api/auth/employee/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!employee) {
      return res.status(400).json({ success: false, error: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ success: true, message: "Password reset successfully. You can now login." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ success: false, error: "Failed to reset password", message: error.message });
  }
};

/**
 * Get employee profile (authenticated)
 * GET /api/auth/employee/me
 */
const getEmployeeProfile = async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.userId },
      include: { role: true, department: true },
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ success: false, error: "Failed to fetch profile", message: error.message });
  }
};

module.exports = {
  verifyEmployeeEmail,
  changeEmployeePassword,
  requestPasswordReset,
  resetPassword,
  getEmployeeProfile,
};
