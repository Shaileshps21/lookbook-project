import { Router } from "express";
import {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController";
import {
  saveSubscription,
  deleteSubscription,
  getPushConfig,
} from "../controllers/pushController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

router.get("/", getMyNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/:id/read", markNotificationRead);
router.patch("/read-all", markAllNotificationsRead);

// Web push subscriptions (Phase 10.2)
router.get("/push-config", getPushConfig);
router.post("/subscribe", saveSubscription);
router.delete("/subscribe", deleteSubscription);

export default router;
