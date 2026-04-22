import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { StatusCodes } from "http-status-codes";
import { toProductResponse } from "../utils/mapper";
import { requireAuth } from "../middlewares/auth";

const productRouter = Router();

function isImageSource(value: string): boolean {
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value)) {
    return true;
  }

  return z.string().url().safeParse(value).success;
}

const imageSourceSchema = z
  .string()
  .trim()
  .max(2_500_000)
  .refine((value) => isImageSource(value), {
    message: "imageUrl must be a valid URL or a base64 data image",
  });

const listProductsQuerySchema = z.object({
  q: z.string().optional(),
  storeId: z.string().optional(),
  categoryKey: z.string().optional(),
  isAvailable: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === "true";
    }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const discountSchema = z
  .object({
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().int().nonnegative(),
  })
  .nullable()
  .optional();

const adminCreateProductSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  imageUrl: imageSourceSchema.optional().nullable(),
  price: z.coerce.number().int().positive(),
  deliveryFee: z.coerce.number().int().min(0).default(15000),
  categoryKeys: z.array(z.string().min(1)).min(1),
  discount: discountSchema,
  isAvailable: z.boolean().optional().default(true),
});

const adminUpdateProductSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: imageSourceSchema.optional().nullable(),
  price: z.coerce.number().int().positive().optional(),
  deliveryFee: z.coerce.number().int().min(0).optional(),
  categoryKeys: z.array(z.string().min(1)).min(1).optional(),
  discount: discountSchema,
  isAvailable: z.boolean().optional(),
});

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

productRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listProductsQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where = {
      ...(query.q
        ? {
            name: {
              contains: query.q,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(query.storeId ? { storeId: query.storeId } : {}),
      ...(query.categoryKey
        ? {
            categories: {
              some: {
                category: {
                  key: query.categoryKey,
                },
              },
            },
          }
        : {}),
      ...(query.isAvailable === undefined ? {} : { isAvailable: query.isAvailable }),
    };

    const include = {
      store: true,
      categories: {
        include: {
          category: true,
        },
      },
      optionGroups: {
        include: {
          options: true,
        },
      },
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ isAvailable: "desc" }, { createdAt: "desc" }],
        include,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products.map(toProductResponse),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  }),
);

productRouter.get(
  "/managed/my",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.STORE_MANAGER) {
      throw new HttpError(
        StatusCodes.FORBIDDEN,
        "Only store managers can access managed products",
      );
    }

    const managedStore = await prisma.store.findFirst({
      where: { managerId: req.user!.id },
      select: { id: true },
    });

    if (!managedStore) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Store manager is not assigned to a store");
    }

    const products = await prisma.product.findMany({
      where: { storeId: managedStore.id },
      include: {
        store: true,
        categories: {
          include: {
            category: true,
          },
        },
        optionGroups: {
          include: {
            options: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: products.map(toProductResponse) });
  }),
);

productRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = adminCreateProductSchema.parse(req.body);
    const userId = req.user!.id;

    if (req.user!.role !== UserRole.STORE_MANAGER) {
      throw new HttpError(
        StatusCodes.FORBIDDEN,
        "Only store managers can create products",
      );
    }

    const manager = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        managedStore: {
          select: { id: true },
        },
      },
    });

    const managerStoreId = manager?.managedStore?.id;
    if (!managerStoreId) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Store manager is not assigned to a store");
    }

    const categories = await prisma.category.findMany({
      where: {
        key: { in: payload.categoryKeys },
      },
      select: { id: true, key: true },
    });

    if (categories.length !== payload.categoryKeys.length) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "One or more categories do not exist");
    }

    const created = await prisma.product.create({
      data: {
        name: payload.name,
        slug: `${slugify(payload.name)}-${Date.now()}`,
        description: payload.description,
        imageUrl: payload.imageUrl ?? undefined,
        price: payload.price,
        deliveryFee: payload.deliveryFee,
        storeId: managerStoreId,
        isAvailable: payload.isAvailable,
        discountType: payload.discount?.type ?? null,
        discountValue: payload.discount?.value ?? null,
        categories: {
          create: payload.categoryKeys.map((key) => ({
            category: {
              connect: { key },
            },
          })),
        },
      },
      include: {
        store: true,
        categories: { include: { category: true } },
        optionGroups: { include: { options: true } },
      },
    });

    res.status(StatusCodes.CREATED).json({ data: toProductResponse(created) });
  }),
);

productRouter.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = adminUpdateProductSchema.parse(req.body);
    const { id } = req.params;
    const numericId = /^\d+$/.test(id) ? Number(id) : undefined;

    if (req.user!.role !== UserRole.STORE_MANAGER) {
      throw new HttpError(
        StatusCodes.FORBIDDEN,
        "Only store managers can update products",
      );
    }

    const manager = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        managedStore: {
          select: { id: true },
        },
      },
    });

    const managerStoreId = manager?.managedStore?.id;
    if (!managerStoreId) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Store manager is not assigned to a store");
    }

    const existing = await prisma.product.findFirst({
      where: numericId
        ? { externalId: numericId, storeId: managerStoreId }
        : { id, storeId: managerStoreId },
      select: { id: true, storeId: true },
    });

    if (!existing) {
      throw new HttpError(
        StatusCodes.NOT_FOUND,
        "Product not found in your managed store",
      );
    }

    if (payload.categoryKeys) {
      const categories = await prisma.category.findMany({
        where: { key: { in: payload.categoryKeys } },
        select: { id: true },
      });
      if (categories.length !== payload.categoryKeys.length) {
        throw new HttpError(StatusCodes.BAD_REQUEST, "One or more categories do not exist");
      }
    }

    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl || null } : {}),
        ...(payload.price !== undefined ? { price: payload.price } : {}),
        ...(payload.deliveryFee !== undefined ? { deliveryFee: payload.deliveryFee } : {}),
        ...(payload.isAvailable !== undefined ? { isAvailable: payload.isAvailable } : {}),
        ...(payload.discount !== undefined
          ? payload.discount
            ? {
                discountType: payload.discount.type,
                discountValue: payload.discount.value,
              }
            : {
                discountType: null,
                discountValue: null,
              }
          : {}),
        ...(payload.categoryKeys
          ? {
              categories: {
                deleteMany: {},
                create: payload.categoryKeys.map((key) => ({
                  category: {
                    connect: { key },
                  },
                })),
              },
            }
          : {}),
      },
      include: {
        store: true,
        categories: { include: { category: true } },
        optionGroups: { include: { options: true } },
      },
    });

    res.json({ data: toProductResponse(updated) });
  }),
);

productRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const numericId = /^\d+$/.test(id) ? Number(id) : undefined;

    if (req.user!.role !== UserRole.STORE_MANAGER) {
      throw new HttpError(
        StatusCodes.FORBIDDEN,
        "Only store managers can delete products",
      );
    }

    const manager = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        managedStore: {
          select: { id: true },
        },
      },
    });

    const managerStoreId = manager?.managedStore?.id;
    if (!managerStoreId) {
      throw new HttpError(StatusCodes.FORBIDDEN, "Store manager is not assigned to a store");
    }

    const existing = await prisma.product.findFirst({
      where: numericId
        ? { externalId: numericId, storeId: managerStoreId }
        : { id, storeId: managerStoreId },
      select: { id: true },
    });

    if (!existing) {
      throw new HttpError(
        StatusCodes.NOT_FOUND,
        "Product not found in your managed store",
      );
    }

    await prisma.product.delete({
      where: { id: existing.id },
    });

    res.status(StatusCodes.NO_CONTENT).send();
  }),
);

productRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const numericId = /^\d+$/.test(id) ? Number(id) : undefined;

    const product = await prisma.product.findFirst({
      where: numericId ? { externalId: numericId } : { id },
      include: {
        store: true,
        categories: {
          include: {
            category: true,
          },
        },
        optionGroups: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!product) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Product not found");
    }

    res.json({ data: toProductResponse(product) });
  }),
);

export default productRouter;
