import { AuditLog } from "../models/AuditLog";

/** Best-effort, fire-and-forget — same pattern as logActivity: never let a
 * logging failure break the admin action that's actually being audited. */
export const recordAuditLog = (
  adminId: string,
  action: string,
  targetType: string,
  targetId?: string,
  metadata?: Record<string, unknown>
): void => {
  AuditLog.create({ admin: adminId, action, targetType, targetId, metadata }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn(`[audit] Failed to record ${action} on ${targetType}/${targetId}`);
  });
};
