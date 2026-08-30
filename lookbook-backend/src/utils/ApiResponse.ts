import type { Response } from "express";

export class ApiResponse {
  static send<T>(
    res: Response,
    statusCode: number,
    data: T,
    message = "Success",
    meta?: Record<string, unknown>
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    });
  }

  static created<T>(res: Response, data: T, message = "Created successfully") {
    return this.send(res, 201, data, message);
  }

  static ok<T>(res: Response, data: T, message = "Success", meta?: Record<string, unknown>) {
    return this.send(res, 200, data, message, meta);
  }
}
