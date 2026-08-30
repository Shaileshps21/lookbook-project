/* Generates a VAPID key pair for web push (future.md Phase 10.2).
 * Usage: npm run push:keys
 * Copy the output into your .env as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
 * (and VAPID_SUBJECT, defaulting to mailto:admin@lookbook.dev).
 */
import webpush from "web-push";

const vapidKeys = webpush.generateVAPIDKeys();

// eslint-disable-next-line no-console
console.log("\nVAPID keys generated — add these to lookbook-backend/.env:\n");
// eslint-disable-next-line no-console
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
// eslint-disable-next-line no-console
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
// eslint-disable-next-line no-console
console.log("VAPID_SUBJECT=mailto:admin@lookbook.dev\n");
