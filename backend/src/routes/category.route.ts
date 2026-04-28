import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middlewares/auth";

const categoryRouter = Router();

// ── GET / — List all categories ──
categoryRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true, slug: true, iconUrl: true },
    });
    res.json({ data: categories });
  }),
);

// ── POST / — Create category (admin) ──
const createCategorySchema = z.object({
  key: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  iconUrl: z.string().trim().max(2_500_000).nullable().optional(),
});

categoryRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = createCategorySchema.parse(req.body);
    const slug = body.key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const exists = await prisma.category.findFirst({ where: { OR: [{ key: body.key }, { slug }] } });
    if (exists) throw new HttpError(StatusCodes.CONFLICT, "Mã danh mục đã tồn tại");

    const category = await prisma.category.create({
      data: { key: body.key, name: body.name, slug, iconUrl: body.iconUrl ?? null },
    });
    res.status(201).json({ data: category, message: "Đã tạo danh mục" });
  }),
);

// ── PATCH /:id — Update category (admin) ──
const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  iconUrl: z.string().trim().max(2_500_000).nullable().optional(),
});

categoryRouter.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = updateCategorySchema.parse(req.body);

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy danh mục");

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.iconUrl !== undefined ? { iconUrl: body.iconUrl } : {}),
      },
    });
    res.json({ data: updated, message: "Đã cập nhật" });
  }),
);

// ── DELETE /:id — Delete category (admin) ──
categoryRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const category = await prisma.category.findUnique({ where: { id }, include: { products: { take: 1 } } });
    if (!category) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy danh mục");
    if (category.products.length > 0) throw new HttpError(StatusCodes.CONFLICT, "Danh mục đang được dùng bởi sản phẩm");

    await prisma.category.delete({ where: { id } });
    res.json({ message: "Đã xóa danh mục" });
  }),
);

export default categoryRouter;
