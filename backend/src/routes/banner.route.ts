import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middlewares/auth";

const bannerRouter = Router();

// ── GET / — List banners (public: only active, admin: all) ──
bannerRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const isAdmin = req.query.all === "true";
    const banners = await prisma.heroBanner.findMany({
      where: isAdmin ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    res.json({ data: banners });
  }),
);

// ── POST / — Create banner (admin) ──
const createBannerSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  imageUrl: z.string().trim().min(1).max(5_000_000),
  link: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

bannerRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = createBannerSchema.parse(req.body);
    const banner = await prisma.heroBanner.create({
      data: {
        title: body.title ?? null,
        imageUrl: body.imageUrl,
        link: body.link ?? null,
        sortOrder: body.sortOrder,
      },
    });
    res.status(201).json({ data: banner, message: "Đã thêm banner" });
  }),
);

// ── PATCH /:id — Update banner (admin) ──
const updateBannerSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  imageUrl: z.string().trim().min(1).max(5_000_000).optional(),
  link: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

bannerRouter.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = updateBannerSchema.parse(req.body);

    const banner = await prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy banner");

    const updated = await prisma.heroBanner.update({ where: { id }, data: body });
    res.json({ data: updated, message: "Đã cập nhật banner" });
  }),
);

// ── DELETE /:id — Delete banner (admin) ──
bannerRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const banner = await prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) throw new HttpError(StatusCodes.NOT_FOUND, "Không tìm thấy banner");

    await prisma.heroBanner.delete({ where: { id } });
    res.json({ message: "Đã xóa banner" });
  }),
);

export default bannerRouter;
