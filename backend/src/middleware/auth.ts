import type { NextFunction, Request, Response } from "express";

import { AppError } from "../lib/http.js";
import { verifyToken } from "../lib/jwt.js";
import type { SynodRequest } from "../types/auth.js";

export function attachAuthContext(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    (request as SynodRequest).auth = verifyToken(token);
    next();
  } catch {
    next(new AppError(401, "Invalid authentication token"));
  }
}

export function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  if (!(request as SynodRequest).auth) {
    next(new AppError(401, "Authentication required"));
    return;
  }

  next();
}
