import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../lib/http-error";
import { verifyAccessToken } from "../utils/jwt";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new HttpError(StatusCodes.UNAUTHORIZED, "Missing access token"));
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (_error) {
    return next(new HttpError(StatusCodes.UNAUTHORIZED, "Invalid or expired token"));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(StatusCodes.UNAUTHORIZED, "Unauthorized"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new HttpError(StatusCodes.FORBIDDEN, "Insufficient permissions"));
    }

    return next();
  };
}
