import webpush from "web-push";
import { env } from "../config/env";
import { PushSubscription } from "../models/PushSubscription";

/**
 * Web push fan-out (future.md Phase 10.2). Delivery requires a configured
 * VAPID key pair (generate with `npm run push:keys` and set VAPID_PUBLIC_KEY
 * / VAPID_PRIVATE_KEY). Without them every helper here is a graceful no-op:
 * in-app notifications keep working, only the browser-push leg is skipped.
 */

const configured = Boolean(env.webPush.publicKey && env.webPush.privateKey);

if (configured) {
  webpush.setVapidDetails(
    env.webPush.subject,
    env.webPush.publicKey,
    env.webPush.privateKey
  );
}

export const isPushConfigured = (): boolean => configured;

/** Send one push to a saved subscription; removes it if the endpoint is dead. */
export const sendPushToSubscription = async (
  sub: InstanceType<typeof PushSubscription>,
  payload: { title: string; body: string; url?: string }
): Promise<void> => {
  if (!configured) return;
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/",
        timestamp: new Date().toISOString(),
      }),
      { TTL: 60 * 60 * 24 }
    );
  } catch (err) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) {
      // Subscription is gone — clean it up so we don't retry a dead endpoint.
      await PushSubscription.deleteOne({ _id: sub.id }).catch(() => {});
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(`[push] sendNotification failed for ${sub.endpoint.slice(0, 40)}…: ${String(err)}`);
  }
};

/** Best-effort fan-out to every subscription a user has registered. */
export const pushToUser = async (
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> => {
  if (!configured) return;
  try {
    const subs = await PushSubscription.find({ user: userId });
    await Promise.all(subs.map((s) => sendPushToSubscription(s, payload)));
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[push] pushToUser failed");
  }
};