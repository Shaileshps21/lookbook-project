import { Router } from "express";
import {
  getPendingSellerApplications,
  approveSeller,
  rejectSeller,
  getPendingDamageReports,
  resolveDamageReport,
  getDashboardMetrics,
  getUsers,
  getUserActivity,
  suspendUser,
  reinstateUser,
  getAdminOrders,
  updateOrderStatus,
  updateOrderTracking,
  refundOrder,
  getPendingPayouts,
  resolvePayout,
  getAuditLogs,
  getAnalytics,
  configureBookPricing,
  runPricingNow,
} from "../controllers/adminController";
import { searchBooksApi, importBooksApi } from "../controllers/bookImportController";
import { getProductAnalytics, getAbReport } from "../controllers/analyticsController";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from "../controllers/couponController";
import { protect, adminOnly } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createCouponSchema, updateCouponSchema } from "../validators/couponValidators";

const router = Router();

router.use(protect, adminOnly);

router.get("/dashboard", getDashboardMetrics);

router.get("/sellers/pending", getPendingSellerApplications);
router.patch("/sellers/:userId/approve", approveSeller);
router.patch("/sellers/:userId/reject", rejectSeller);

router.get("/damage-reports/pending", getPendingDamageReports);
router.patch("/damage-reports/:orderId/:itemIndex/resolve", resolveDamageReport);

router.get("/users", getUsers);
router.get("/users/:userId/activity", getUserActivity);
router.patch("/users/:userId/suspend", suspendUser);
router.patch("/users/:userId/reinstate", reinstateUser);

router.get("/orders", getAdminOrders);
router.patch("/orders/:orderId/status", updateOrderStatus);
router.patch("/orders/:orderId/tracking", updateOrderTracking);
router.post("/orders/:orderId/refund", refundOrder);

router.get("/payouts/pending", getPendingPayouts);
router.patch("/payouts/:payoutId/resolve", resolvePayout);

router.get("/audit-logs", getAuditLogs);
router.get("/analytics", getAnalytics);
router.get("/analytics/events", getProductAnalytics);
router.get("/analytics/ab-report", getAbReport);
router.post("/books/:bookId/pricing", configureBookPricing);
router.post("/pricing/run", runPricingNow);

router.get("/books-api/search", searchBooksApi);
router.post("/books-api/import", importBooksApi);

router.get("/coupons", listCoupons);
router.post("/coupons", validate(createCouponSchema), createCoupon);
router.patch("/coupons/:id", validate(updateCouponSchema), updateCoupon);
router.delete("/coupons/:id", deleteCoupon);

export default router;
