import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth } from "../middlewares/auth";
import { calculateUnitPrice } from "../utils/pricing";
import { hashSelectedOptions } from "../utils/selected-options";
import { toProductResponse } from "../utils/mapper";

const cartRouter = Router();

const selectedOptionsSchema = z.record(
  z.union([z.string(), z.array(z.string())]),
);

const addItemSchema = z
  .object({
    productId: z.string().optional(),
    externalProductId: z.coerce.number().int().positive().optional(),
    quantity: z.coerce.number().int().min(1).max(99),
    selectedOptions: selectedOptionsSchema.optional(),
  })
  .refine((value) => Boolean(value.productId || value.externalProductId), {
    message: "productId or externalProductId is required",
    path: ["productId"],
  });

const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99),
  selectedOptions: selectedOptionsSchema.optional(),
});

const cartItemInclude = {
  product: {
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
  },
};

type CartItemWithProduct = Prisma.CartItemGetPayload<{
  include: typeof cartItemInclude;
}>;

function cartSummary(items: CartItemWithProduct[]) {
  const mappedItems = items.map((item) => {
    const { unitPrice, selectedOptions } = calculateUnitPrice(item.product, item.selectedOptions);
    const lineTotal = unitPrice * item.quantity;

    return {
      id: item.id,
      quantity: item.quantity,
      selectedOptions,
      unitPrice,
      lineTotal,
      product: toProductResponse(item.product),
    };
  });

  const subtotal = mappedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = mappedItems.length
    ? Math.max(...mappedItems.map((item) => item.product.deliveryFee))
    : 0;
  const platformFee = mappedItems.length ? 3000 : 0;

  return {
    items: mappedItems,
    subtotal,
    deliveryFee,
    platformFee,
    total: subtotal + deliveryFee + platformFee,
  };
}

cartRouter.use(requireAuth);

cartRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: cartSummary(items) });
  }),
);

cartRouter.post(
  "/items",
  asyncHandler(async (req, res) => {
    const payload = addItemSchema.parse(req.body);
    const userId = req.user!.id;

    const product = await prisma.product.findFirst({
      where: payload.productId
        ? { id: payload.productId }
        : { externalId: payload.externalProductId },
      include: {
        optionGroups: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!product || !product.isAvailable) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Product not available");
    }

    const { selectedOptions } = calculateUnitPrice(product, payload.selectedOptions);
    const optionsHash = hashSelectedOptions(selectedOptions);

    const existed = await prisma.cartItem.findUnique({
      where: {
        userId_productId_optionsHash: {
          userId,
          productId: product.id,
          optionsHash,
        },
      },
    });

    if (existed) {
      await prisma.cartItem.update({
        where: { id: existed.id },
        data: {
          quantity: Math.min(99, existed.quantity + payload.quantity),
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          userId,
          productId: product.id,
          quantity: payload.quantity,
          selectedOptions,
          optionsHash,
        },
      });
    }

    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: { createdAt: "desc" },
    });

    res.status(StatusCodes.CREATED).json({ data: cartSummary(items) });
  }),
);

cartRouter.patch(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const payload = updateItemSchema.parse(req.body);
    const userId = req.user!.id;
    const { itemId } = req.params;

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        userId,
      },
      include: {
        product: {
          include: {
            optionGroups: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!existingItem) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Cart item not found");
    }

    const { selectedOptions } = calculateUnitPrice(
      existingItem.product,
      payload.selectedOptions ?? existingItem.selectedOptions,
    );
    const optionsHash = hashSelectedOptions(selectedOptions);

    if (optionsHash === existingItem.optionsHash) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: payload.quantity,
          selectedOptions,
        },
      });
    } else {
      const duplicated = await prisma.cartItem.findUnique({
        where: {
          userId_productId_optionsHash: {
            userId,
            productId: existingItem.productId,
            optionsHash,
          },
        },
      });

      await prisma.$transaction(async (tx) => {
        if (duplicated) {
          await tx.cartItem.update({
            where: { id: duplicated.id },
            data: {
              quantity: Math.min(99, duplicated.quantity + payload.quantity),
            },
          });
          await tx.cartItem.delete({
            where: { id: existingItem.id },
          });
        } else {
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: payload.quantity,
              selectedOptions,
              optionsHash,
            },
          });
        }
      });
    }

    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: cartSummary(items) });
  }),
);

cartRouter.delete(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { itemId } = req.params;

    const existed = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        userId,
      },
      select: { id: true },
    });

    if (!existed) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Cart item not found");
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    res.status(StatusCodes.NO_CONTENT).send();
  }),
);

cartRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    await prisma.cartItem.deleteMany({ where: { userId } });
    res.status(StatusCodes.NO_CONTENT).send();
  }),
);

export default cartRouter;
