const express = require("express");
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permission');

const router = express.Router();
const couponController = require("../../controllers/online/couponController");

// Public routes (frontend website needs these)
router.get("/available", couponController.getAvailableCoupons);
router.get("/promotional", couponController.getPromotionalCoupons);
router.post("/validate", couponController.validateCoupon);
router.post("/apply", couponController.applyCoupon);

// Dashboard routes - protected
router.get("/", authenticateToken, requirePermission('coupons', 'view'), couponController.getAllCoupons);
router.get("/:id/stats", authenticateToken, requirePermission('coupons', 'view'), couponController.getCouponStats);
router.get("/:id", authenticateToken, requirePermission('coupons', 'view'), couponController.getCouponById);
router.post("/", authenticateToken, requirePermission('coupons', 'add'), couponController.createCoupon);
router.put("/:id", authenticateToken, requirePermission('coupons', 'edit'), couponController.updateCoupon);
router.delete("/:id", authenticateToken, requirePermission('coupons', 'delete'), couponController.deleteCoupon);

module.exports = router;
