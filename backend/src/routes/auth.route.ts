import { Router } from "express";
import { randomUUID } from "node:crypto";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { requireAuth } from "../middlewares/auth";
import {
  hashToken,
  refreshTokenTtlMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { comparePassword, hashPassword } from "../utils/password";

const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  phone: z.string().min(8).max(20).optional(),
});

const registerStoreSchema = z.object({
  managerName: z.string().min(2).max(120),
  managerEmail: z.string().email(),
  managerPassword: z.string().min(8).max(64),
  managerPhone: z.string().min(8).max(20).optional(),
  storeName: z.string().min(2).max(160),
  storeAddress: z.string().min(4).max(300),
  etaMinutesMin: z.coerce.number().int().min(5).max(120).optional().default(20),
  etaMinutesMax: z.coerce.number().int().min(5).max(180).optional().default(35),
});

const registerDriverSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  phone: z.string().min(8).max(20).optional(),
  vehicleType: z.string().min(2).max(60),
  licensePlate: z.string().min(4).max(20),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

async function issueTokens(user: { id: string; email: string; role: UserRole }) {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  const tokenId = randomUUID();
  const refreshToken = signRefreshToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tokenId,
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
    },
  });

  return { accessToken, refreshToken };
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);

    const existed = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (existed) {
      throw new HttpError(StatusCodes.CONFLICT, "Email already exists");
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const tokens = await issueTokens(user);

    res.status(StatusCodes.CREATED).json({
      user,
      tokens,
    });
  }),
);

authRouter.post(
  "/register/customer",
  asyncHandler(async (req, res) => {
    req.body = {
      ...req.body,
    };
    const payload = registerSchema.parse(req.body);

    const existed = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (existed) {
      throw new HttpError(StatusCodes.CONFLICT, "Email already exists");
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        passwordHash,
        role: UserRole.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const tokens = await issueTokens(user);

    res.status(StatusCodes.CREATED).json({
      user,
      tokens,
    });
  }),
);

authRouter.post(
  "/register/store",
  asyncHandler(async (req, res) => {
    const payload = registerStoreSchema.parse(req.body);

    if (payload.etaMinutesMin > payload.etaMinutesMax) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "etaMinutesMin must be less than or equal etaMinutesMax",
      );
    }

    const existed = await prisma.user.findUnique({
      where: { email: payload.managerEmail },
    });

    if (existed) {
      throw new HttpError(StatusCodes.CONFLICT, "Manager email already exists");
    }

    const passwordHash = await hashPassword(payload.managerPassword);

    const result = await prisma.$transaction(async (tx) => {
      const manager = await tx.user.create({
        data: {
          name: payload.managerName,
          email: payload.managerEmail,
          phone: payload.managerPhone,
          passwordHash,
          role: UserRole.STORE_MANAGER,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      const store = await tx.store.create({
        data: {
          name: payload.storeName,
          slug: `${slugify(payload.storeName)}-${Date.now()}`,
          address: payload.storeAddress,
          etaMinutesMin: payload.etaMinutesMin,
          etaMinutesMax: payload.etaMinutesMax,
          isOpen: false,
          managerId: manager.id,
        },
        select: {
          id: true,
          name: true,
          address: true,
          isOpen: true,
        },
      });

      return { manager, store };
    });

    const tokens = await issueTokens(result.manager);

    res.status(StatusCodes.CREATED).json({
      user: result.manager,
      store: result.store,
      tokens,
      message:
        "Store account created. Your store is pending activation and is currently closed by default.",
    });
  }),
);

authRouter.post(
  "/register/driver",
  asyncHandler(async (req, res) => {
    const payload = registerDriverSchema.parse(req.body);

    const [emailExisted, plateExisted] = await Promise.all([
      prisma.user.findUnique({
        where: { email: payload.email },
      }),
      prisma.driverProfile.findUnique({
        where: { licensePlate: payload.licensePlate },
      }),
    ]);

    if (emailExisted) {
      throw new HttpError(StatusCodes.CONFLICT, "Email already exists");
    }

    if (plateExisted) {
      throw new HttpError(StatusCodes.CONFLICT, "License plate already exists");
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        passwordHash,
        role: UserRole.DRIVER,
        driverProfile: {
          create: {
            vehicleType: payload.vehicleType,
            licensePlate: payload.licensePlate,
            isOnline: false,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    const tokens = await issueTokens(user);

    res.status(StatusCodes.CREATED).json({
      user,
      tokens,
    });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
    }

    const isMatched = await comparePassword(payload.password, user.passwordHash);
    if (!isMatched) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
    }

    const tokens = await issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Unauthorized");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "User not found");
    }

    res.json(user);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const payload = refreshSchema.parse(req.body);

    let decoded;
    try {
      decoded = verifyRefreshToken(payload.refreshToken);
    } catch (_error) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
    }

    const tokenHash = hashToken(payload.refreshToken);

    const persisted = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            name: true,
          },
        },
      },
    });

    if (!persisted || persisted.revokedAt || persisted.expiresAt < new Date()) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Refresh token is expired or revoked");
    }

    if (persisted.userId !== decoded.sub) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Refresh token mismatch");
    }

    await prisma.refreshToken.update({
      where: { id: persisted.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await issueTokens({
      id: persisted.user.id,
      email: persisted.user.email,
      role: persisted.user.role,
    });

    res.json({
      user: persisted.user,
      tokens,
    });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const payload = refreshSchema.parse(req.body);

    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(payload.refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    res.status(StatusCodes.NO_CONTENT).send();
  }),
);

export default authRouter;
