const { prisma } = require("../../config/database");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { getCompanyData } = require("../../utils/email/templates/delivery-partner/helpers");
const { getInvitationEmailTemplate, getRoleAssignedEmailTemplate, getSuspendedEmailTemplate } = require("../../utils/email/templates/employee/index");
const { sendEmailWithEnv } = require("../../config/connectSMTP");
const {
  uploadEmployeeProfilePhoto,
  uploadEmployeeAadhar,
  uploadEmployeePAN,
  uploadEmployeeIdProof,
  deleteFromS3,
  getPresignedUrl,
} = require("../../utils/employee/uploadS3");

// ── Helper: Generate Employee ID (EMP-2026-001) ──
const generateEmployeeId = async () => {
  const year = new Date().getFullYear();
  const prefix = `EMP-${year}-`;
  const last = await prisma.employee.findFirst({
    where: { employeeId: { startsWith: prefix } },
    orderBy: { employeeId: "desc" },
    select: { employeeId: true },
  });
  if (!last) return `${prefix}001`;
  const lastNum = parseInt(last.employeeId.split("-")[2]);
  return `${prefix}${String(lastNum + 1).padStart(3, "0")}`;
};

// ── Helper: Generate safe temporary password ──
const generatePassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#!";
  let password = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  const all = upper + lower + digits + special;
  for (let i = 0; i < 8; i++) {
    password.push(all[Math.floor(Math.random() * all.length)]);
  }
  return password.sort(() => Math.random() - 0.5).join("");
};

// ── Helper: Add presigned URLs for documents ──
const addPresignedUrls = async (employee) => {
  const result = { ...employee };
  if (result.profilePhoto) result.profilePhotoUrl = await getPresignedUrl(result.profilePhoto);
  if (result.aadharDocument) result.aadharDocumentUrl = await getPresignedUrl(result.aadharDocument);
  if (result.panDocument) result.panDocumentUrl = await getPresignedUrl(result.panDocument);
  if (result.idProofDocument) result.idProofDocumentUrl = await getPresignedUrl(result.idProofDocument);
  return result;
};

/**
 * Create employee (draft status)
 * POST /api/employees
 */
const createEmployee = async (req, res) => {
  try {
    const {
      name, email, phone, roleId, departmentId,
      dateOfBirth, gender, address, city, state, pincode, country,
      aadharNumber, panNumber, joiningDate,
    } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, error: "Name, email, and phone are required" });
    }

    // Aadhar validation — exactly 12 digits
    if (aadharNumber && !/^\d{12}$/.test(aadharNumber.trim())) {
      return res.status(400).json({ success: false, error: "Aadhar number must be exactly 12 digits" });
    }

    // PAN validation — format: ABCDE1234F
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(panNumber.trim())) {
      return res.status(400).json({ success: false, error: "PAN number must be in format ABCDE1234F" });
    }

    // Check email uniqueness — allow User (customer) emails, block Admin/Partner/Employee duplicates
    const [existingAdmin, existingPartner, existingEmployee] = await Promise.all([
      prisma.admin.findUnique({ where: { email }, select: { id: true } }),
      prisma.deliveryPartner.findUnique({ where: { email }, select: { id: true } }),
      prisma.employee.findUnique({ where: { email }, select: { id: true } }),
    ]);

    if (existingAdmin) {
      return res.status(400).json({ success: false, error: "This email belongs to an admin account" });
    }
    if (existingPartner) {
      return res.status(400).json({ success: false, error: "This email belongs to a delivery partner account" });
    }
    if (existingEmployee) {
      return res.status(400).json({ success: false, error: "An employee with this email already exists" });
    }
    // User (customer) email is ALLOWED — same person can be both customer + employee

    // Handle file uploads
    let profilePhoto = null, aadharDocument = null, panDocument = null, idProofDocument = null;
    const tempId = Date.now().toString();

    if (req.files) {
      if (req.files.profilePhoto) profilePhoto = await uploadEmployeeProfilePhoto(req.files.profilePhoto[0], tempId);
      if (req.files.aadharDocument) aadharDocument = await uploadEmployeeAadhar(req.files.aadharDocument[0], tempId);
      if (req.files.panDocument) panDocument = await uploadEmployeePAN(req.files.panDocument[0], tempId);
      if (req.files.idProofDocument) idProofDocument = await uploadEmployeeIdProof(req.files.idProofDocument[0], tempId);
    }

    const employee = await prisma.employee.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        status: "draft",
        roleId: roleId || null,
        departmentId: departmentId || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        pincode: pincode?.trim() || null,
        country: country?.trim() || "India",
        aadharNumber: aadharNumber?.trim() || null,
        panNumber: panNumber?.trim() || null,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        profilePhoto,
        aadharDocument,
        panDocument,
        idProofDocument,
        statusHistory: [{ from: null, to: "draft", reason: "Employee created", changedAt: new Date().toISOString() }],
      },
      include: { role: true, department: true },
    });

    res.status(201).json({ success: true, message: "Employee created as draft", data: employee });
  } catch (error) {
    console.error("Error creating employee:", error);
    res.status(500).json({ success: false, error: "Failed to create employee", message: error.message });
  }
};

/**
 * Get all employees
 * GET /api/employees
 */
const getAllEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, roleId, departmentId, search } = req.query;

    const where = {};
    if (status && status !== "all") where.status = status;
    if (roleId) where.roleId = roleId;
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeId: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: { role: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.employee.count({ where }),
    ]);

    // Stats
    const stats = await prisma.employee.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    res.json({
      success: true,
      data: employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      stats: {
        total,
        draft: stats.find(s => s.status === "draft")?._count.id || 0,
        invited: stats.find(s => s.status === "invited")?._count.id || 0,
        verified: stats.find(s => s.status === "verified")?._count.id || 0,
        active: stats.find(s => s.status === "active")?._count.id || 0,
        suspended: stats.find(s => s.status === "suspended")?._count.id || 0,
        inactive: stats.find(s => s.status === "inactive")?._count.id || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ success: false, error: "Failed to fetch employees", message: error.message });
  }
};

/**
 * Get employee by ID
 * GET /api/employees/:id
 */
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { role: true, department: true },
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const withUrls = await addPresignedUrls(employee);
    res.json({ success: true, data: withUrls });
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ success: false, error: "Failed to fetch employee", message: error.message });
  }
};

/**
 * Update employee details
 * PUT /api/employees/:id
 */
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, phone, roleId, departmentId,
      dateOfBirth, gender, address, city, state, pincode, country,
      aadharNumber, panNumber, joiningDate,
    } = req.body;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    // Aadhar validation
    if (aadharNumber && !/^\d{12}$/.test(aadharNumber.trim())) {
      return res.status(400).json({ success: false, error: "Aadhar number must be exactly 12 digits" });
    }

    // PAN validation
    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(panNumber.trim())) {
      return res.status(400).json({ success: false, error: "PAN number must be in format ABCDE1234F" });
    }

    // Handle file uploads (replace old files)
    const updateData = {};
    if (req.files) {
      if (req.files.profilePhoto) {
        if (existing.profilePhoto) await deleteFromS3(existing.profilePhoto);
        updateData.profilePhoto = await uploadEmployeeProfilePhoto(req.files.profilePhoto[0], id);
      }
      if (req.files.aadharDocument) {
        if (existing.aadharDocument) await deleteFromS3(existing.aadharDocument);
        updateData.aadharDocument = await uploadEmployeeAadhar(req.files.aadharDocument[0], id);
      }
      if (req.files.panDocument) {
        if (existing.panDocument) await deleteFromS3(existing.panDocument);
        updateData.panDocument = await uploadEmployeePAN(req.files.panDocument[0], id);
      }
      if (req.files.idProofDocument) {
        if (existing.idProofDocument) await deleteFromS3(existing.idProofDocument);
        updateData.idProofDocument = await uploadEmployeeIdProof(req.files.idProofDocument[0], id);
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone && { phone: phone.trim() }),
        ...(roleId !== undefined && { roleId: roleId || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(gender !== undefined && { gender }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(city !== undefined && { city: city?.trim() || null }),
        ...(state !== undefined && { state: state?.trim() || null }),
        ...(pincode !== undefined && { pincode: pincode?.trim() || null }),
        ...(country !== undefined && { country: country?.trim() || "India" }),
        ...(aadharNumber !== undefined && { aadharNumber: aadharNumber?.trim() || null }),
        ...(panNumber !== undefined && { panNumber: panNumber?.trim() || null }),
        ...(joiningDate !== undefined && { joiningDate: joiningDate ? new Date(joiningDate) : null }),
        ...updateData,
      },
      include: { role: true, department: true },
    });

    res.json({ success: true, message: "Employee updated successfully", data: employee });
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({ success: false, error: "Failed to update employee", message: error.message });
  }
};

/**
 * Update employee status (draft→invited, suspend, reactivate, etc.)
 * PUT /api/employees/:id/status
 */
const updateEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, suspensionReason, suspensionNote } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { role: true, department: true },
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const validTransitions = {
      draft: ["invited"],
      invited: ["draft", "suspended"],
      verified: ["active", "suspended"],
      active: ["suspended", "inactive"],
      suspended: ["active"],
      inactive: ["active"],
    };

    const allowed = validTransitions[employee.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot change status from "${employee.status}" to "${status}"`,
        allowedTransitions: allowed,
      });
    }

    const updateData = {
      status,
      statusHistory: {
        push: {
          from: employee.status,
          to: status,
          reason: suspensionReason || `Status changed to ${status}`,
          changedAt: new Date().toISOString(),
        },
      },
    };

    // ── DRAFT → INVITED: Generate credentials + send email ──
    if (employee.status === "draft" && status === "invited") {
      const employeeId = await generateEmployeeId();
      const tempPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      const verificationToken = crypto.randomBytes(32).toString("hex");

      updateData.employeeId = employeeId;
      updateData.password = hashedPassword;
      updateData.emailVerificationToken = verificationToken;

      // Send invitation email
      const companyData = await getCompanyData();
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const verificationLink = `${frontendUrl}/verify-employee?token=${verificationToken}`;

      const emailHtml = getInvitationEmailTemplate({
        employeeName: employee.name,
        employeeId,
        email: employee.email,
        tempPassword,
        verificationLink,
        roleName: employee.role?.name,
        departmentName: employee.department?.name,
        companyData,
      });

      setImmediate(async () => {
        try {
          await sendEmailWithEnv({
            to: employee.email,
            subject: `Welcome to ${companyData?.companyName || "LEATS"} — Your Account is Ready`,
            html: emailHtml,
          });
          console.log(`✅ Invitation email sent to ${employee.email}`);
        } catch (emailError) {
          console.error(`❌ Failed to send invitation email:`, emailError.message);
        }
      });
    }

    // ── SUSPEND ──
    if (status === "suspended") {
      updateData.suspensionReason = suspensionReason || null;
      updateData.suspensionNote = suspensionNote || null;
      updateData.suspendedAt = new Date();

      // Send suspension email
      const companyData = await getCompanyData();
      const emailHtml = getSuspendedEmailTemplate({
        employeeName: employee.name,
        reason: suspensionReason,
        note: suspensionNote,
        companyData,
      });

      setImmediate(async () => {
        try {
          await sendEmailWithEnv({
            to: employee.email,
            subject: "Account Suspended",
            html: emailHtml,
          });
        } catch (e) {
          console.error("Failed to send suspension email:", e.message);
        }
      });
    }

    // ── REACTIVATE from suspended ──
    if ((employee.status === "suspended" || employee.status === "inactive") && status === "active") {
      updateData.suspensionReason = null;
      updateData.suspensionNote = null;
      updateData.suspendedAt = null;
      updateData.isActive = true;
    }

    // ── DEACTIVATE ──
    if (status === "inactive") {
      updateData.isActive = false;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: { role: true, department: true },
    });

    res.json({ success: true, message: `Employee status changed to ${status}`, data: updated });
  } catch (error) {
    console.error("Error updating employee status:", error);
    res.status(500).json({ success: false, error: "Failed to update status", message: error.message });
  }
};

/**
 * Assign/change role for employee
 * PUT /api/employees/:id/assign-role
 */
const assignRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return res.status(404).json({ success: false, error: "Role not found" });
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: { roleId },
      include: { role: true, department: true },
    });

    // Send role change notification email
    const companyData = await getCompanyData();
    const emailHtml = getRoleAssignedEmailTemplate({
      employeeName: employee.name,
      roleName: role.name,
      permissions: role.permissions,
      companyData,
    });

    setImmediate(async () => {
      try {
        await sendEmailWithEnv({
          to: employee.email,
          subject: `Role Updated — ${role.name}`,
          html: emailHtml,
        });
      } catch (e) {
        console.error("Failed to send role assignment email:", e.message);
      }
    });

    res.json({ success: true, message: `Role "${role.name}" assigned to employee`, data: updated });
  } catch (error) {
    console.error("Error assigning role:", error);
    res.status(500).json({ success: false, error: "Failed to assign role", message: error.message });
  }
};

/**
 * Resend invitation email
 * POST /api/employees/:id/resend-invitation
 */
const resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { role: true, department: true },
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    if (employee.status !== "invited") {
      return res.status(400).json({ success: false, error: "Can only resend invitation for employees with 'invited' status" });
    }

    // Generate new password and token
    const tempPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await prisma.employee.update({
      where: { id },
      data: {
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        isEmailVerified: false,
        emailVerifiedAt: null,
      },
    });

    // Send email
    const companyData = await getCompanyData();
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verificationLink = `${frontendUrl}/verify-employee?token=${verificationToken}`;

    const emailHtml = getInvitationEmailTemplate({
      employeeName: employee.name,
      employeeId: employee.employeeId,
      email: employee.email,
      tempPassword,
      verificationLink,
      roleName: employee.role?.name,
      departmentName: employee.department?.name,
      companyData,
    });

    await sendEmailWithEnv({
      to: employee.email,
      subject: `Invitation Resent — ${companyData?.companyName || "LEATS"}`,
      html: emailHtml,
    });

    res.json({ success: true, message: "Invitation resent successfully" });
  } catch (error) {
    console.error("Error resending invitation:", error);
    res.status(500).json({ success: false, error: "Failed to resend invitation", message: error.message });
  }
};

/**
 * Delete (soft) employee
 * DELETE /api/employees/:id
 */
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    await prisma.employee.update({
      where: { id },
      data: {
        status: "inactive",
        isActive: false,
        statusHistory: {
          push: { from: employee.status, to: "inactive", reason: "Employee deleted", changedAt: new Date().toISOString() },
        },
      },
    });

    res.json({ success: true, message: "Employee deactivated successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ success: false, error: "Failed to delete employee", message: error.message });
  }
};

/**
 * Check email and auto-fill from User (customer) data
 * GET /api/employees/check-email?email=xxx
 */
const checkEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already exists as admin/partner/employee
    const [existingAdmin, existingPartner, existingEmployee] = await Promise.all([
      prisma.admin.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      prisma.deliveryPartner.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      prisma.employee.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    ]);

    if (existingAdmin) return res.json({ success: true, available: false, reason: "admin", message: "This email belongs to an admin account" });
    if (existingPartner) return res.json({ success: true, available: false, reason: "partner", message: "This email belongs to a delivery partner" });
    if (existingEmployee) return res.json({ success: true, available: false, reason: "employee", message: "An employee with this email already exists" });

    // Check if exists as User (customer) — auto-fill data
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true, name: true, email: true, phoneNumber: true, image: true,
        address: true, city: true, state: true, zipCode: true, country: true,
        dateOfBirth: true,
      },
    });

    if (existingUser) {
      return res.json({
        success: true,
        available: true,
        isExistingUser: true,
        message: "Existing customer found — data auto-filled",
        userData: {
          name: existingUser.name,
          email: existingUser.email,
          phone: existingUser.phoneNumber || "",
          address: existingUser.address || "",
          city: existingUser.city || "",
          state: existingUser.state || "",
          pincode: existingUser.zipCode || "",
          country: existingUser.country || "India",
          dateOfBirth: existingUser.dateOfBirth || null,
        },
      });
    }

    // New email — no existing account
    return res.json({ success: true, available: true, isExistingUser: false, message: "Email is available" });
  } catch (error) {
    console.error("Error checking email:", error);
    res.status(500).json({ success: false, error: "Failed to check email", message: error.message });
  }
};

module.exports = {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmployeeStatus,
  assignRole,
  resendInvitation,
  deleteEmployee,
  checkEmail,
};
