import { Notification, type NotificationType } from "../models/Notification";
import { pushToUser } from "./webPush";

/** Best-effort, fire-and-forget — same pattern as logActivity/recordAuditLog.
 * Creates the in-app notification and fans out to any registered web-push
 * subscriptions (Phase 10.2). Callers that also want an email fire sendMail
 * separately — the channels stay decoupled so a user could toggle them
 * independently in future settings. */
export const notify = (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): void => {
  Notification.create({ user: userId, type, title, message, link }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn(`[notify] Failed to create notification for user ${userId}`);
  });
  pushToUser(userId, { title, body: message, url: link }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn(`[notify] Failed to push notification for user ${userId}`);
  });
};
