const bcrypt = require("bcrypt");
const { prisma } = require("../../config/database");

/**
 * Auto-initialize admin user on first database connection
 * This runs automatically when the server starts
 */
async function initializeAdmin() {
  try {
    console.log("🔍 Checking admin initialization...");

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log("⚠️  ADMIN_EMAIL and ADMIN_PASSWORD not set - skipping admin initialization");
      return { success: false, message: "Environment variables not set" };
    }

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log("✅ Admin user already exists");
      console.log(`   ID: ${existingAdmin.id}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.name}`);
      return { success: true, message: "Admin already exists", admin: existingAdmin };
    }

    console.log("🌱 Creating default admin user...");

    // Hash the admin password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    // Create admin user
    const adminUser = await prisma.admin.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: "Admin User",
        isVerified: true,
        isActive: true,
        provider: "local",
      },
    });

    console.log("✅ Admin user created successfully!");
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email: ${adminUser.email}`);

    // Create default working hours (24/7 operation)
    const existingWorkingHours = await prisma.workingHour.count({
      where: { adminId: adminUser.id }
    });

    if (existingWorkingHours === 0) {
      const defaultWorkingHours = [
        { day: "Monday", enabled: true, startTime: "00:00", endTime: "23:59" },
        { day: "Tuesday", enabled: true, startTime: "00:00", endTime: "23:59" },
        { day: "Wednesday", enabled: true, startTime: "00:00", endTime: "23:59" },
        { day: "Thursday", enabled: true, startTime: "00:00", endTime: "23:59" },
        { day: "Friday", enabled: true, startTime: "00:00", endTime: "23:59" },
        { day: "Saturday", enabled: true, startTime: "00:00", endTime: "23:59" },
        { day: "Sunday", enabled: true, startTime: "00:00", endTime: "23:59" },
      ];

      const workingHoursData = defaultWorkingHours.map((wh) => ({
        adminId: adminUser.id,
        day: wh.day,
        enabled: wh.enabled,
        startTime: wh.startTime,
        endTime: wh.endTime,
      }));

      await prisma.workingHour.createMany({
        data: workingHoursData,
      });

      console.log("✅ Default working hours configured");
    }

    console.log(`📧 Email: ${adminEmail}`);

    return { success: true, message: "Admin created successfully", admin: adminUser };
  } catch (error) {
    console.error("❌ Error initializing admin user:");
    console.error("   Error name:", error.name);
    console.error("   Error message:", error.message);
    if (error.code) {
      console.error("   Error code:", error.code);
    }
    if (error.meta) {
      console.error("   Error meta:", JSON.stringify(error.meta, null, 2));
    }
    console.error("   Stack trace:", error.stack);

    // Return error info instead of throwing
    return { success: false, message: error.message, error };
  }
}

/**
 * Auto-initialize Super Admin role on first server start
 */
async function initializeSuperAdminRole() {
  try {
    const existing = await prisma.role.findFirst({ where: { isSystemRole: true } });
    if (existing) {
      console.log("✅ Super Admin role already exists");
      return;
    }

    const { ALL_PERMISSIONS } = require("./permissionConstants");

    await prisma.role.create({
      data: {
        name: "Super Admin",
        description: "Full access to all modules — system role",
        permissions: ALL_PERMISSIONS,
        isSystemRole: true,
        isActive: true,
      },
    });

    console.log("✅ Super Admin role created with all permissions");
  } catch (error) {
    console.error("⚠️ Failed to initialize Super Admin role:", error.message);
  }
}

module.exports = { initializeAdmin, initializeSuperAdminRole };
