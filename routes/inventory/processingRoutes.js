const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getProcessingPool,
  getProcessingPoolItem,
  getProcessingRecipe,
} = require("../../controllers/inventory/processingPoolController");
const {
  createProcessingTransaction,
  getProcessingTransactions,
  getProcessingTransaction,
} = require("../../controllers/inventory/processingTransactionController");

// Processing Pool Routes
router.get("/processing-pool", authenticateToken, requirePermission('processing', 'view'), getProcessingPool);
router.get("/processing-pool/:id", authenticateToken, requirePermission('processing', 'view'), getProcessingPoolItem);
router.get("/processing-pool/:poolId/recipe", authenticateToken, requirePermission('processing', 'view'), getProcessingRecipe);

// Processing Transaction Routes
router.post("/processing-transactions", authenticateToken, requirePermission('processing', 'add'), createProcessingTransaction);
router.get("/processing-transactions", authenticateToken, requirePermission('processing', 'view'), getProcessingTransactions);
router.get("/processing-transactions/:id", authenticateToken, requirePermission('processing', 'view'), getProcessingTransaction);

module.exports = router;
