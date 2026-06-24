const { prisma } = require("../../config/database");

/**
 * Create department
 * POST /api/departments
 */
const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Department name is required" });
    }

    const existing = await prisma.department.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({ success: false, error: "Department name already exists" });
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    res.status(201).json({ success: true, message: "Department created successfully", data: department });
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({ success: false, error: "Failed to create department", message: error.message });
  }
};

/**
 * Get all departments
 * GET /api/departments
 */
const getAllDepartments = async (req, res) => {
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

    const departments = await prisma.department.findMany({
      where,
      include: { _count: { select: { employees: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: departments.map(d => ({
        ...d,
        employeeCount: d._count.employees,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ success: false, error: "Failed to fetch departments", message: error.message });
  }
};

/**
 * Get department by ID
 * GET /api/departments/:id
 */
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        employees: {
          select: { id: true, employeeId: true, name: true, email: true, status: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { employees: true } },
      },
    });

    if (!department) {
      return res.status(404).json({ success: false, error: "Department not found" });
    }

    res.json({ success: true, data: { ...department, employeeCount: department._count.employees } });
  } catch (error) {
    console.error("Error fetching department:", error);
    res.status(500).json({ success: false, error: "Failed to fetch department", message: error.message });
  }
};

/**
 * Update department
 * PUT /api/departments/:id
 */
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Department not found" });
    }

    // Check name uniqueness if changing
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.department.findUnique({ where: { name: name.trim() } });
      if (duplicate) {
        return res.status(400).json({ success: false, error: "Department name already exists" });
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ success: true, message: "Department updated successfully", data: department });
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({ success: false, error: "Failed to update department", message: error.message });
  }
};

/**
 * Delete department
 * DELETE /api/departments/:id
 */
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });

    if (!department) {
      return res.status(404).json({ success: false, error: "Department not found" });
    }

    if (department._count.employees > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete department — ${department._count.employees} employee(s) are assigned to it`,
      });
    }

    await prisma.department.delete({ where: { id } });

    res.json({ success: true, message: "Department deleted successfully" });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({ success: false, error: "Failed to delete department", message: error.message });
  }
};

module.exports = {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
};
