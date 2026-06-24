const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireDashboardAccess } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
} = require("../../controllers/inventory/warehouseController");

// Warehouse routes — GET uses dashboardAccess (lookup data for purchase, POS, etc.)
router.get("/", authenticateToken, requireDashboardAccess, getAllWarehouses);
router.get("/:id", authenticateToken, requireDashboardAccess, getWarehouseById);
router.post("/", authenticateToken, requirePermission('warehouse', 'add'), createWarehouse);
router.put("/:id", authenticateToken, requirePermission('warehouse', 'edit'), updateWarehouse);

module.exports = router;
