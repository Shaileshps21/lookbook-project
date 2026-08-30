import { Router } from "express";
import {
  checkout,
  verifyPayment,
  cancelOrder,
  getMyOrders,
  getOrderById,
  returnItem,
  extendRental,
  verifyExtensionPayment,
  reportDamage,
  schedulePickup,
} from "../controllers/orderController";
import { protect, requireVerifiedEmail } from "../middleware/auth";
import { checkoutLimiter } from "../middleware/rateLimiters";

const router = Router();

router.use(protect);

router.post("/checkout", checkoutLimiter, requireVerifiedEmail, checkout);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);
router.post("/:id/verify-payment", verifyPayment);
router.post("/:id/cancel", cancelOrder);
router.post("/:id/items/:itemIndex/return", returnItem);
router.post("/:id/items/:itemIndex/extend", extendRental);
router.post("/:id/items/:itemIndex/verify-extension", verifyExtensionPayment);
router.post("/:id/items/:itemIndex/report-damage", reportDamage);
router.post("/:id/items/:itemIndex/schedule-pickup", schedulePickup);

export default router;
