const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const {
  getAllTransactions,
  getTransactionById,
} = require("../../controllers/finance/transactionController");

// Transaction routes
router.get("/", authenticateToken, requirePermission('transactions', 'view'), getAllTransactions);
router.get("/:transactionId", authenticateToken, requirePermission('transactions', 'view'), getTransactionById);

module.exports = router;
