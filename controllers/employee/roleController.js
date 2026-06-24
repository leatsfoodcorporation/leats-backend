const { prisma } = require("../../config/database");
const { PERMISSION_MODULES, PERMISSION_GROUPS, isValidPermission } = require("../../utils/auth/permissionConstants");
const { sendToEmployee } = require("../../utils/socket/socketHandler");

/**
 * Get permission modules — static list for role form UI
 * GET /api/roles/modules
 */
const getPermissionModules = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        modules: PERMISSION_MODULES,
        groups: PERMISSION_GROUPS,
      },
    });
  } catch (error) {
    console.error("Error fetching permission modules:", error);
    res.status(500).json({ success: false, error: "Failed to fetch permission modules" });
  }
};

/**
 * Create role
 * POST /api/roles
 */
const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Role name is required" });
    }

    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ success: false, error: "At least one permission is required" });
    }

    // Check name uniqueness
    const existing = await prisma.role.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({ success: false, error: "Role name already exists" });
    }

    // Validate permissions
    const validatedPermissions = [];
    for (const perm of permissions) {
      if (!perm.module || !Array.isArray(perm.actions) || perm.actions.length === 0) continue;

      const validActions = perm.actions.filter(action => isValidPermission(perm.module, action));
      if (validActions.length > 0) {
        validatedPermissions.push({ module: perm.module, actions: validActions });
      }
    }

    if (validatedPermissions.length === 0) {
      return res.status(400).json({ success: false, error: "No valid permissions provided" });
    }

    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        permissions: validatedPermissions,
      },
    });

    res.status(201).json({ success: true, message: "Role created successfully", data: role });
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ success: false, error: "Failed to create role", message: error.message });
  }
};

/**
 * Get all roles
 * GET /api/roles
 */
const getAllRoles = async (req, res) => {
  try {
    const { search, isActive } = req.query;

    const where = {};
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const roles = await prisma.role.findMany({
      where,
      include: { _count: { select: { employees: true } } },
      orderBy: [{ isSystemRole: "desc" }, { createdAt: "desc" }],
    });

    res.json({
      success: true,
      data: roles.map(r => ({
        ...r,
        employeeCount: r._count.employees,
        permissionCount: Array.isArray(r.permissions)
          ? r.permissions.reduce((sum, p) => sum + (p.actions?.length || 0), 0)
          : 0,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ success: false, error: "Failed to fetch roles", message: error.message });
  }
};

/**
 * Get role by ID
 * GET /api/roles/:id
 */
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        employees: {
          select: { id: true, employeeId: true, name: true, email: true, status: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { employees: true } },
      },
    });

    if (!role) {
      return res.status(404).json({ success: false, error: "Role not found" });
    }

    res.json({ success: true, data: { ...role, employeeCount: role._count.employees } });
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ success: false, error: "Failed to fetch role", message: error.message });
  }
};

/**
 * Update role
 * PUT /api/roles/:id
 */
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, isActive } = req.body;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Role not found" });
    }

    // Cannot rename system role
    if (existing.isSystemRole && name && name.trim() !== existing.name) {
      return res.status(400).json({ success: false, error: "Cannot rename system role" });
    }

    // Check name uniqueness if changing
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.role.findUnique({ where: { name: name.trim() } });
      if (duplicate) {
        return res.status(400).json({ success: false, error: "Role name already exists" });
      }
    }

    // Validate permissions if provided
    let validatedPermissions;
    if (permissions && Array.isArray(permissions)) {
      validatedPermissions = [];
      for (const perm of permissions) {
        if (!perm.module || !Array.isArray(perm.actions) || perm.actions.length === 0) continue;
        const validActions = perm.actions.filter(action => isValidPermission(perm.module, action));
        if (validActions.length > 0) {
          validatedPermissions.push({ module: perm.module, actions: validActions });
        }
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(validatedPermissions && { permissions: validatedPermissions }),
        ...(isActive !== undefined && !existing.isSystemRole && { isActive }),
      },
    });

    // Notify all employees with this role — realtime permission refresh
    if (validatedPermissions || isActive !== undefined) {
      try {
        const employees = await prisma.employee.findMany({
          where: { roleId: id, status: "active" },
          select: { id: true },
        });
        for (const emp of employees) {
          sendToEmployee(emp.id, "employee:permissions-updated", {
            permissions: role.permissions,
            roleName: role.name,
          });
        }
      } catch (err) {
        console.error("Error notifying employees of permission change:", err);
      }
    }

    res.json({ success: true, message: "Role updated successfully", data: role });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ success: false, error: "Failed to update role", message: error.message });
  }
};

/**
 * Delete role
 * DELETE /api/roles/:id
 */
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });

    if (!role) {
      return res.status(404).json({ success: false, error: "Role not found" });
    }

    if (role.isSystemRole) {
      return res.status(400).json({ success: false, error: "Cannot delete system role" });
    }

    if (role._count.employees > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete role — ${role._count.employees} employee(s) are assigned to it`,
      });
    }

    await prisma.role.delete({ where: { id } });

    res.json({ success: true, message: "Role deleted successfully" });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ success: false, error: "Failed to delete role", message: error.message });
  }
};

module.exports = {
  getPermissionModules,
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
};
