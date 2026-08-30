import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { startRentalReminderWorker } from "./queues/rentalReminderQueue";
import { startLeaderboardWorker } from "./queues/leaderboardQueue";
import { startAnalyticsWorker } from "./queues/analyticsQueue";
import { startPricingWorker } from "./queues/pricingQueue";
import { queuesEnabled } from "./queues/connection";
import { logger } from "./utils/logger";

const start = async () => {
  await connectDB();

  const app = createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] LookBook API running on port ${env.port} (${env.nodeEnv})`);
    logger.info({ port: env.port, env: env.nodeEnv }, "server started");
  });

  if (queuesEnabled) {
    startRentalReminderWorker();
    startLeaderboardWorker();
    startAnalyticsWorker();
    startPricingWorker();
    // eslint-disable-next-line no-console
    console.log("[queues] Rental reminder, leaderboard, analytics and smart-pricing workers started.");
  } else {
    // eslint-disable-next-line no-console
    console.warn("[queues] REDIS_URL not configured — background jobs disabled.");
  }

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[server] Received ${signal}. Shutting down gracefully...`);
    logger.info({ signal }, "server shutting down");
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    // eslint-disable-next-line no-console
    console.error("[server] Unhandled rejection:", reason);
    logger.error({ reason }, "unhandled rejection");
  });
};

start();
