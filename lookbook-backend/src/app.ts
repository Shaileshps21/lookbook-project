import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import apiRouter from "./routes";
import { notFound, errorHandler } from "./middleware/errorHandler";
import { env } from "./config/env";
import { logger } from "./utils/logger";

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  app.use(
    express.json({
      limit: "10mb",
      // Preserves the raw body so the Razorpay webhook can verify its HMAC
      // signature, which must be computed over the exact bytes received.
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (!env.isProd) {
    app.use(morgan("dev"));
  } else {
    // Structured JSON access logs in production — morgan's colored one-liner
    // is a dev convenience only, not something a log aggregator can parse.
    app.use(pinoHttp({ logger }));
  }

  app.get("/health", (_req, res) => {
    res.json({ success: true, message: "OK", timestamp: new Date().toISOString() });
  });

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
