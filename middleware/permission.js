/**
 * Permission Middleware
 * Checks if the authenticated user has the required permission
 *
 * Usage in routes:
 *   const { requirePermission } = require('../middleware/permission');
 *   router.get('/', authenticateToken, requirePermission('online_products', 'view'), getProducts);
 *   router.post('/', authenticateToken, requirePermission('online_products', 'add'), createProduct);
 */

const { hasPermission, isValidPermission } = require("../utils/auth/permissionConstants");

/**
 * Middleware factory — returns middleware that checks module+action permission
 * @param {string} module - Permission module key (e.g., 'online_products', 'warehouse')
 * @param {string} action - Permission action (e.g., 'view', 'add', 'edit', 'delete')
 */
const requirePermission = (module, action) => {
  return (req, res, next) => {
    // No user = not authenticated (should be caught by authenticateToken first)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Admin = ALWAYS pass through — hardcoded full access bypass
    if (req.user.role === "admin") {
      return next();
    }

    // Employee = check role permissions
    if (req.user.role === "employee") {
      const permissions = req.employeePermissions || [];

      if (hasPermission(permissions, module, action)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: "Permission denied",
        message: `You don't have permission to ${action} ${module.replace(/_/g, " ")}`,
        requiredPermission: { module, action },
      });
    }

    // User / DeliveryPartner = no dashboard access
    return res.status(403).json({
      success: false,
      error: "Access denied",
      message: "You don't have access to the dashboard",
    });
  };
};

/**
 * Middleware — allows any authenticated admin or employee (no specific module check)
 * Use for lookup/reference data APIs (warehouse list, item list, GST rates, categories, suppliers)
 * that are needed as dropdowns by multiple modules (purchase, POS, products, etc.)
 */
const requireDashboardAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  if (req.user.role === "admin" || req.user.role === "employee") {
    return next();
  }
  return res.status(403).json({ success: false, error: "Dashboard access required" });
};

module.exports = { requirePermission, requireDashboardAccess };
