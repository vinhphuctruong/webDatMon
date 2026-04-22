import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Validation failed",
      errors: err.flatten(),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Resource already exists",
        meta: err.meta,
      });
    }

    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Database request failed",
      code: err.code,
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    });
  }

  console.error(err);

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message: "Internal server error",
  });
}
