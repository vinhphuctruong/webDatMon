import { Router } from "express";
import { randomUUID } from "node:crypto";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { PartnerApplicationStatus, UserRole } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/async-handler";
import { sendOtpEmail } from "../lib/email-service";
import { issueEmailOtp, verifyEmailOtp, peekEmailOtp } from "../lib/email-otp";
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

const registerCustomerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  phone: z.string().min(8).max(20),
  otpCode: z.string().regex(/^\d{6}$/, "OTP phải gồm 6 chữ số"),
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

const imageDataUrlSchema = z
  .string()
  .refine(
    (value) =>
      /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value),
    "Ảnh phải là định dạng JPEG, PNG hoặc WEBP",
  )
  .refine((value) => value.length >= 12_000, "Chất lượng ảnh quá thấp hoặc file không hợp lệ");

const registerDriverApplicationSchema = z.object({
  fullName: z.string().min(2).max(120),
  dateOfBirth: z.coerce.date(),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  phone: z.string().min(8).max(20).optional(),
  vehicleType: z.string().min(2).max(60),
  licensePlate: z.string().min(4).max(20),
  portraitImageData: imageDataUrlSchema,
  idCardImageData: imageDataUrlSchema,
  driverLicenseImageData: imageDataUrlSchema,
  portraitQualityScore: z.coerce.number().min(110),
  idCardQualityScore: z.coerce.number().min(110),
  driverLicenseQualityScore: z.coerce.number().min(110),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64),
  role: z.nativeEnum(UserRole).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const requestEmailOtpSchema = z.object({
  email: z.string().email(),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(8).max(20).optional().nullable(),
  avatarUrl: z
    .string()
    .refine(
      (value) => /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(value),
      "Ảnh đại diện phải là JPEG, PNG hoặc WEBP",
    )
    .optional()
    .nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(64),
  newPassword: z.string().min(8).max(64),
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

    const [existedEmail] = await Promise.all([
      prisma.user.findFirst({ where: { email: payload.email, role: UserRole.CUSTOMER } }),
    ]);

    if (existedEmail) {
      throw new HttpError(StatusCodes.CONFLICT, "Email đã được đăng ký với vai trò khách hàng");
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
        avatarUrl: true,
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
    const payload = registerCustomerSchema.parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedPhone = payload.phone.trim();

    const existedEmail = await prisma.user.findFirst({
      where: { email: normalizedEmail, role: UserRole.CUSTOMER },
    });

    if (existedEmail) {
      throw new HttpError(StatusCodes.CONFLICT, "Email đã được đăng ký với vai trò khách hàng");
    }

    const verified = verifyEmailOtp(normalizedEmail, payload.otpCode);
    if (!verified.ok) {
      throw new HttpError(StatusCodes.BAD_REQUEST, verified.message);
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.user.create({
      data: {
        name: payload.name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        role: UserRole.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
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
  "/email-otp/request",
  asyncHandler(async (req, res) => {
    const payload = requestEmailOtpSchema.parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const existed = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existed) {
      throw new HttpError(StatusCodes.CONFLICT, "Email đã tồn tại, vui lòng dùng email khác");
    }

    const otp = issueEmailOtp(normalizedEmail);

    let sentByEmail = false;
    let emailDeliveryError: unknown;
    try {
      const result = await sendOtpEmail({
        toEmail: normalizedEmail,
        otpCode: otp.code,
        expiresInSeconds: otp.expiresInSeconds,
      });
      sentByEmail = result.sent;
    } catch (error) {
      emailDeliveryError = error;
      console.error("[auth][email-otp] Failed to send OTP email", error);
      if (env.NODE_ENV === "production") {
        throw new HttpError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Khong gui duoc OTP qua email. Vui long thu lai sau.",
        );
      }
    }

    if (!sentByEmail) {
      if (env.NODE_ENV === "production") {
        throw new HttpError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "He thong OTP email chua duoc cau hinh.",
        );
      }
      console.log(
        `[auth][email-otp][dev-fallback] ${normalizedEmail} => ${otp.code} (expires in ${otp.expiresInSeconds}s)${emailDeliveryError ? " due to email delivery error" : ""}`,
      );
    }

    res.json({
      message: sentByEmail
        ? "Da gui ma OTP den email. Vui long kiem tra hop thu."
        : emailDeliveryError
          ? "Khong gui duoc OTP qua email. Da chuyen sang che do local, vui long dung debugOtp de test."
          : "OTP da duoc tao (che do local). Vui long dung debugOtp de test.",
      expiresInSeconds: otp.expiresInSeconds,
      retryAfterSeconds: otp.retryAfterSeconds,
      ...(env.NODE_ENV === "production" ? {} : { debugOtp: otp.code }),
    });
  }),
);

// OTP for driver/partner application — does NOT require email to be registered or unregistered
authRouter.post(
  "/email-otp/request-any",
  asyncHandler(async (req, res) => {
    const payload = requestEmailOtpSchema.parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const otp = issueEmailOtp(normalizedEmail);

    let sentByEmail = false;
    let emailDeliveryError: unknown;
    try {
      const result = await sendOtpEmail({
        toEmail: normalizedEmail,
        otpCode: otp.code,
        expiresInSeconds: otp.expiresInSeconds,
      });
      sentByEmail = result.sent;
    } catch (error) {
      emailDeliveryError = error;
      console.error("[auth][email-otp-any] Failed to send OTP email", error);
      if (env.NODE_ENV === "production") {
        throw new HttpError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Không gửi được OTP qua email. Vui lòng thử lại sau.",
        );
      }
    }

    if (!sentByEmail && env.NODE_ENV === "production") {
      throw new HttpError(StatusCodes.INTERNAL_SERVER_ERROR, "Hệ thống OTP email chưa được cấu hình.");
    }

    if (!sentByEmail) {
      console.log(
        `[auth][email-otp-any][dev-fallback] ${normalizedEmail} => ${otp.code} (expires in ${otp.expiresInSeconds}s)`,
      );
    }

    res.json({
      message: sentByEmail
        ? "Đã gửi mã OTP đến email."
        : "OTP đã được tạo (chế độ local). Vui lòng dùng debugOtp để test.",
      expiresInSeconds: otp.expiresInSeconds,
      retryAfterSeconds: otp.retryAfterSeconds,
      ...(env.NODE_ENV === "production" ? {} : { debugOtp: otp.code }),
    });
  }),
);

// Verify OTP without requiring the user to exist
authRouter.post(
  "/email-otp/verify-any",
  asyncHandler(async (req, res) => {
    const payload = z.object({
      email: z.string().email(),
      otpCode: z.string().regex(/^\d{6}$/, "OTP phải gồm 6 chữ số"),
    }).parse(req.body);

    const normalizedEmail = payload.email.trim().toLowerCase();
    const result = peekEmailOtp(normalizedEmail, payload.otpCode);
    if (!result) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Mã OTP không hợp lệ hoặc đã hết hạn");
    }
    res.json({ verified: true, message: "OTP hợp lệ." });
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

    const existedEmail = await prisma.user.findFirst({
      where: { email: payload.managerEmail, role: UserRole.STORE_MANAGER },
    });

    if (existedEmail) {
      throw new HttpError(StatusCodes.CONFLICT, "Email đã được đăng ký với vai trò quản lý cửa hàng");
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
          avatarUrl: true,
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
      prisma.user.findFirst({
        where: { email: payload.email, role: UserRole.DRIVER },
      }),
      prisma.driverProfile.findUnique({
        where: { licensePlate: payload.licensePlate },
      }),
    ]);

    if (emailExisted) {
      throw new HttpError(StatusCodes.CONFLICT, "Email đã được đăng ký với vai trò tài xế");
    }

    if (plateExisted) {
      throw new HttpError(StatusCodes.CONFLICT, "Biển số xe đã tồn tại");
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
        avatarUrl: true,
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
  "/partner/driver-application",
  asyncHandler(async (req, res) => {
    const payload = registerDriverApplicationSchema.parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedPlate = payload.licensePlate.trim().toUpperCase();

    const minAdultAge = 18;
    const ageMs = Date.now() - payload.dateOfBirth.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < minAdultAge) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Người đăng ký phải đủ 18 tuổi trở lên");
    }

    const [emailExisted, plateExisted, pendingByEmail, pendingByPlate] = await Promise.all([
      prisma.user.findFirst({
        where: { email: normalizedEmail, role: UserRole.DRIVER },
        select: { id: true },
      }),
      prisma.driverProfile.findUnique({
        where: { licensePlate: normalizedPlate },
        select: { id: true },
      }),
      prisma.driverApplication.findFirst({
        where: {
          email: normalizedEmail,
          status: PartnerApplicationStatus.PENDING,
        },
        select: { id: true },
      }),
      prisma.driverApplication.findFirst({
        where: {
          licensePlate: normalizedPlate,
          status: PartnerApplicationStatus.PENDING,
        },
        select: { id: true },
      }),
    ]);

    if (emailExisted || pendingByEmail) {
      throw new HttpError(StatusCodes.CONFLICT, "Email đã tồn tại hoặc đang có đơn chờ duyệt");
    }

    if (plateExisted || pendingByPlate) {
      throw new HttpError(StatusCodes.CONFLICT, "Biển số xe đã tồn tại hoặc đang chờ duyệt");
    }

    const passwordHash = await hashPassword(payload.password);

    const application = await prisma.driverApplication.create({
      data: {
        fullName: payload.fullName,
        dateOfBirth: payload.dateOfBirth,
        email: normalizedEmail,
        phone: payload.phone,
        passwordHash,
        vehicleType: payload.vehicleType,
        licensePlate: normalizedPlate,
        portraitImageData: payload.portraitImageData,
        idCardImageData: payload.idCardImageData,
        driverLicenseImageData: payload.driverLicenseImageData,
        portraitQualityScore: payload.portraitQualityScore,
        idCardQualityScore: payload.idCardQualityScore,
        driverLicenseQualityScore: payload.driverLicenseQualityScore,
        status: PartnerApplicationStatus.PENDING,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(StatusCodes.CREATED).json({
      data: application,
      message: "Đơn ứng tuyển tài xế đã được gửi và đang chờ Admin duyệt",
    });
  }),
);

// ─── Forgot Password ───────────────────────────────────────────────
const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

const forgotPasswordResetSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().regex(/^\d{6}$/, "OTP phải gồm 6 chữ số"),
  newPassword: z.string().min(8).max(64),
});

authRouter.post(
  "/forgot-password/request-otp",
  asyncHandler(async (req, res) => {
    const payload = forgotPasswordRequestSchema.parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!user) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Email chưa được đăng ký trong hệ thống");
    }

    const otp = issueEmailOtp(normalizedEmail);

    let sentByEmail = false;
    let emailDeliveryError: unknown;
    try {
      const result = await sendOtpEmail({
        toEmail: normalizedEmail,
        otpCode: otp.code,
        expiresInSeconds: otp.expiresInSeconds,
      });
      sentByEmail = result.sent;
    } catch (error) {
      emailDeliveryError = error;
      console.error("[auth][forgot-password] Failed to send OTP email", error);
      if (env.NODE_ENV === "production") {
        throw new HttpError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Không gửi được OTP qua email. Vui lòng thử lại sau.",
        );
      }
    }

    if (!sentByEmail) {
      if (env.NODE_ENV === "production") {
        throw new HttpError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Hệ thống OTP email chưa được cấu hình.",
        );
      }
      console.log(
        `[auth][forgot-password][dev-fallback] ${normalizedEmail} => ${otp.code} (expires in ${otp.expiresInSeconds}s)`,
      );
    }

    res.json({
      message: sentByEmail
        ? "Đã gửi mã OTP đến email. Vui lòng kiểm tra hộp thư."
        : "OTP đã được tạo (chế độ local). Vui lòng dùng debugOtp để test.",
      expiresInSeconds: otp.expiresInSeconds,
      retryAfterSeconds: otp.retryAfterSeconds,
      ...(env.NODE_ENV === "production" ? {} : { debugOtp: otp.code }),
    });
  }),
);

authRouter.post(
  "/forgot-password/verify-otp",
  asyncHandler(async (req, res) => {
    const payload = z.object({
      email: z.string().email(),
      otpCode: z.string().regex(/^\d{6}$/, "OTP phải gồm 6 chữ số"),
    }).parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const result = peekEmailOtp(normalizedEmail, payload.otpCode);
    if (!result.ok) {
      throw new HttpError(StatusCodes.BAD_REQUEST, result.message);
    }

    res.json({ verified: true, message: "OTP hợp lệ. Vui lòng đặt mật khẩu mới." });
  }),
);

authRouter.post(
  "/forgot-password/reset",
  asyncHandler(async (req, res) => {
    const payload = forgotPasswordResetSchema.parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!user) {
      throw new HttpError(StatusCodes.NOT_FOUND, "Email không tồn tại");
    }

    const verified = verifyEmailOtp(normalizedEmail, payload.otpCode);
    if (!verified.ok) {
      throw new HttpError(StatusCodes.BAD_REQUEST, verified.message);
    }

    const newHash = await hashPassword(payload.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    res.json({
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.",
    });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        email: payload.email,
        ...(payload.role ? { role: payload.role } : {}),
      },
    });

    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Email hoặc mật khẩu không đúng");
    }

    const isMatched = await comparePassword(payload.password, user.passwordHash);
    if (!isMatched) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Email hoặc mật khẩu không đúng");
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
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Không tìm thấy tài khoản");
    }

    res.json(user);
  }),
);

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ");
    }

    const payload = updateProfileSchema.parse(req.body);

    if (
      payload.name === undefined &&
      payload.email === undefined &&
      payload.phone === undefined &&
      payload.avatarUrl === undefined
    ) {
      throw new HttpError(StatusCodes.BAD_REQUEST, "Vui lòng cung cấp ít nhất một trường thông tin");
    }

    const nextEmail = payload.email?.trim().toLowerCase();
    const nextPhone = payload.phone === undefined ? undefined : payload.phone?.trim() || null;

    const [emailExisted] = await Promise.all([
      nextEmail
        ? prisma.user.findFirst({
            where: {
              email: nextEmail,
              role: req.user!.role as UserRole,
              id: { not: userId },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (emailExisted) {
      throw new HttpError(StatusCodes.CONFLICT, "Email đã được sử dụng bởi tài khoản khác cùng vai trò");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
        ...(payload.avatarUrl !== undefined
          ? { avatarUrl: payload.avatarUrl?.trim() || null }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({
      data: updated,
      message: "Cập nhật thông tin thành công",
    });
  }),
);

authRouter.patch(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ");
    }

    const payload = changePasswordSchema.parse(req.body);
    if (payload.currentPassword === payload.newPassword) {
      throw new HttpError(
        StatusCodes.BAD_REQUEST,
        "New password must be different from current password",
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Không tìm thấy tài khoản");
    }

    const matched = await comparePassword(payload.currentPassword, user.passwordHash);
    if (!matched) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Mật khẩu hiện tại không đúng");
    }

    const newHash = await hashPassword(payload.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    res.json({
      message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
    });
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
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Refresh token không hợp lệ");
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
            avatarUrl: true,
          },
        },
      },
    });

    if (!persisted || persisted.revokedAt || persisted.expiresAt < new Date()) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn");
    }

    if (persisted.userId !== decoded.sub) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, "Refresh token không khớp");
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
