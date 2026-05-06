const express = require("express");
const router = express.Router();
const {
  getSalesSummaryReport,
  getPosSalesReport,
  getOnlineSalesReport,
} = require("../../controllers/finance/salesReportController");

// Sales report routes
router.get("/sales-summary", getSalesSummaryReport);
router.get("/pos-sales", getPosSalesReport);
router.get("/online-sales", getOnlineSalesReport);

module.exports = router;
