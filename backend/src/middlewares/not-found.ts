import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../lib/http-error";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(StatusCodes.NOT_FOUND, "Endpoint not found"));
}
