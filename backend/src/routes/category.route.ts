import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { prisma } from "../db/prisma";

const categoryRouter = Router();

categoryRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        slug: true,
        iconUrl: true,
      },
    });

    res.json({ data: categories });
  }),
);

export default categoryRouter;
