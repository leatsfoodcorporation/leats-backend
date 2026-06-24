const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  upload,
} = require("../../controllers/inventory/itemController");
const {
  checkItemUsage,
  checkBulkItemUsage,
} = require("../../controllers/inventory/itemUsageController");

// Item routes — GET uses dashboardAccess (lookup data for purchase, POS, products, etc.)
router.get("/", authenticateToken, requireDashboardAccess, getAllItems);
router.get("/:id", authenticateToken, requireDashboardAccess, getItemById);
router.post("/", authenticateToken, requirePermission('warehouse', 'add'), upload.single("itemImage"), createItem);
router.put("/:id", authenticateToken, requirePermission('warehouse', 'edit'), upload.single("itemImage"), updateItem);
router.delete("/:id", authenticateToken, requirePermission('warehouse', 'delete'), deleteItem);

// Item usage check routes — lookup data
router.get("/:id/usage", authenticateToken, requireDashboardAccess, checkItemUsage);
router.post("/usage/bulk", authenticateToken, requireDashboardAccess, checkBulkItemUsage);

module.exports = router;
