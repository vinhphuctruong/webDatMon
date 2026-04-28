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
      message: "Dữ liệu không hợp lệ",
      errors: err.flatten(),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[]) ?? [];
      const fieldMap: Record<string, string> = {
        email: "Email",
        phone: "Số điện thoại",
        licensePlate: "Biển số xe",
        name: "Tên",
        slug: "Đường dẫn",
        key: "Mã danh mục",
        externalId: "Mã ngoài",
      };
      const duplicatedFields = target
        .map((f) => fieldMap[f] || f)
        .join(", ");
      const message = duplicatedFields
        ? `Trùng dữ liệu: ${duplicatedFields} đã tồn tại`
        : "Dữ liệu đã tồn tại trong hệ thống";
      return res.status(StatusCodes.CONFLICT).json({
        message,
        meta: err.meta,
      });
    }

    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Yêu cầu cơ sở dữ liệu thất bại",
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
    message: "Lỗi máy chủ nội bộ",
  });
}
