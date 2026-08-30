import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

interface MongoDuplicateKeyError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

interface MongooseValidationError extends Error {
  name: "ValidationError";
  errors: Record<string, { message: string }>;
}

const isDuplicateKeyError = (err: unknown): err is MongoDuplicateKeyError =>
  typeof err === "object" && err !== null && (err as MongoDuplicateKeyError).code === 11000;

const isValidationError = (err: unknown): err is MongooseValidationError =>
  err instanceof Error && err.name === "ValidationError";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  let statusCode = 500;
  let message = "Something went wrong on our end.";
  let errors: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    message = `A record with this ${field} already exists.`;
  } else if (isValidationError(err)) {
    statusCode = 400;
    message = "Validation failed.";
    errors = Object.values(err.errors).map((e) => e.message);
  } else if (err instanceof Error && err.name === "CastError") {
    statusCode = 400;
    message = "Invalid identifier supplied.";
  }
  // Any other Error (driver/infra failures, etc.) keeps the generic message —
  // `.message` on those can leak internal details (e.g. a MongoDB connection
  // error exposing a server file path). The `stack` field below already
  // covers dev-only debugging; full detail is always in the server log.

  // Always logged (previously this only printed in dev, so production
  // errors — the ones that matter most — went completely unrecorded).
  logger.error({ err, statusCode, path: req.originalUrl, method: req.method }, message);

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(env.isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
};
