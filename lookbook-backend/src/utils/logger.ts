import pino from "pino";
import { env } from "../config/env";

// Structured JSON logs, ingestible by a log aggregator / APM — replaces the
// scattered console.* calls in the request/error path. Local dev keeps
// morgan's colored one-line-per-request format alongside this for quick
// reading; this is the log stream a real deployment would ship out.
export const logger = pino({
  level: env.isProd ? "info" : "debug",
});
