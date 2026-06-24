/**
 * Permission Constants — Single Source of Truth
 * 42 sub-modules following sidebar structure
 * Import this wherever permissions are needed
 */

const PERMISSION_MODULES = [
  // === MAIN ===
  { key: "dashboard", label: "Dashboard", group: "Main", actions: ["view"] },
  { key: "online_products", label: "Online Products", group: "Main", actions: ["view", "add", "edit", "delete"] },
  { key: "coupons", label: "Coupons", group: "Main", actions: ["view", "add", "edit", "delete"] },

  // === INVENTORY ===
  { key: "warehouse", label: "Warehouse", group: "Inventory", actions: ["view", "add", "edit", "delete"] },
  { key: "stock_adjustment", label: "Stock Adjustment", group: "Inventory", actions: ["view", "add"] },
  { key: "processing", label: "Processing", group: "Inventory", actions: ["view", "add"] },

  // === POS ===
  { key: "pos_products", label: "POS Products", group: "POS", actions: ["view", "add", "edit", "delete"] },
  { key: "pos_billing", label: "POS Billing", group: "POS", actions: ["view", "add"] },

  // === ORDERS ===
  { key: "online_orders", label: "Online Orders", group: "Orders", actions: ["view", "edit"] },
  { key: "pos_orders", label: "POS Orders", group: "Orders", actions: ["view"] },

  // === FINANCE ===
  { key: "online_sales", label: "Online Sales", group: "Finance", actions: ["view"] },
  { key: "pos_sales", label: "POS Sales", group: "Finance", actions: ["view"] },
  { key: "transactions", label: "Transactions", group: "Finance", actions: ["view"] },

  // === PURCHASE ===
  { key: "suppliers", label: "Suppliers", group: "Purchase", actions: ["view", "add", "edit", "delete"] },
  { key: "purchase_orders", label: "Purchase Orders", group: "Purchase", actions: ["view", "add", "edit", "delete"] },
  { key: "bills", label: "Bills / GRN", group: "Purchase", actions: ["view", "add", "edit"] },
  { key: "expenses", label: "Expenses", group: "Purchase", actions: ["view", "add", "edit", "delete"] },
  { key: "purchase_reports", label: "Purchase Reports", group: "Purchase", actions: ["view"] },

  // === DELIVERY ===
  { key: "partner_applications", label: "Partner Applications", group: "Delivery", actions: ["view", "add", "edit"] },
  { key: "partner_management", label: "Partner Management", group: "Delivery", actions: ["view", "edit"] },
  { key: "delivery_tracking", label: "Delivery Tracking", group: "Delivery", actions: ["view"] },

  // === CUSTOMERS ===
  { key: "customers", label: "Customer Management", group: "Customers", actions: ["view"] },

  // === ENQUIRIES ===
  { key: "bulk_enquiries", label: "Bulk Orders", group: "Enquiries", actions: ["view", "edit", "delete"] },
  { key: "catering_enquiries", label: "Catering Services", group: "Enquiries", actions: ["view", "edit", "delete"] },

  // === WEB SETTINGS ===
  { key: "web_logo", label: "Logo", group: "Web Settings", actions: ["view", "edit"] },
  { key: "web_banner", label: "Banner", group: "Web Settings", actions: ["view", "add", "edit", "delete"] },
  { key: "web_company", label: "Company Info", group: "Web Settings", actions: ["view", "edit"] },
  { key: "web_seo", label: "SEO", group: "Web Settings", actions: ["view", "add", "edit", "delete"] },
  { key: "web_policies", label: "Policies & FAQ", group: "Web Settings", actions: ["view", "add", "edit", "delete"] },

  // === SETTINGS ===
  { key: "settings_general", label: "General", group: "Settings", actions: ["view"] },
  { key: "settings_email", label: "Email Config", group: "Settings", actions: ["view", "edit"] },
  { key: "settings_payment", label: "Payment Gateway", group: "Settings", actions: ["view", "edit"] },
  { key: "settings_invoice", label: "Invoice", group: "Settings", actions: ["view", "edit"] },
  { key: "settings_gst", label: "GST / Tax", group: "Settings", actions: ["view", "add", "edit", "delete"] },
  { key: "settings_zones", label: "Delivery Zone", group: "Settings", actions: ["view", "add", "edit", "delete"] },
  { key: "settings_charge", label: "Delivery Charge", group: "Settings", actions: ["view", "add", "edit", "delete"] },
  { key: "settings_schedule", label: "Order Schedule", group: "Settings", actions: ["view", "edit"] },

  // === MANAGEMENT (NEW) ===
  { key: "employees", label: "Employees", group: "Management", actions: ["view", "add", "edit", "delete"] },
  { key: "roles", label: "Roles", group: "Management", actions: ["view", "add", "edit", "delete"] },
  { key: "departments", label: "Departments", group: "Management", actions: ["view", "add", "edit", "delete"] },

  // === REPORTS ===
  { key: "inventory_reports", label: "Inventory Reports", group: "Reports", actions: ["view"] },
  { key: "sales_reports", label: "Sales Reports", group: "Reports", actions: ["view"] },
  { key: "partner_reports", label: "Partner Reports", group: "Reports", actions: ["view"] },
];

// Get all unique group names (for UI grouping in role form)
const PERMISSION_GROUPS = [...new Set(PERMISSION_MODULES.map(m => m.group))];

// Generate ALL permissions for Super Admin role
const ALL_PERMISSIONS = PERMISSION_MODULES.map(m => ({
  module: m.key,
  actions: [...m.actions],
}));

// Check if a module+action combination is valid
const isValidPermission = (module, action) => {
  const mod = PERMISSION_MODULES.find(m => m.key === module);
  if (!mod) return false;
  return mod.actions.includes(action);
};

// Check if user has a specific permission
const hasPermission = (permissions, module, action) => {
  if (!permissions || !Array.isArray(permissions)) return false;
  const modulePerm = permissions.find(p => p.module === module);
  if (!modulePerm) return false;
  return Array.isArray(modulePerm.actions) && modulePerm.actions.includes(action);
};

module.exports = {
  PERMISSION_MODULES,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  isValidPermission,
  hasPermission,
};
