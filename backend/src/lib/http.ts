import type { NextFunction, Request, RequestHandler, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
  (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
